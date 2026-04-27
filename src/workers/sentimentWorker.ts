/**
 * Off-thread sentiment scorer.
 *
 * The worker receives a Raven natural-language description for a single user
 * utterance and asks an OpenAI Chat Completions endpoint with a JSON Schema
 * to return numeric scores 0–100 for our six sentiment dimensions.
 *
 * Why a Worker:
 * - Tavus/Daily traffic must stay on the main thread for real-time WebRTC.
 * - LLM calls are slow (200ms–1.5s) and we don't want their `fetch` to
 *   contend with audio/video processing or block React renders.
 * - Cancellation: when a newer utterance arrives we abort the in-flight job
 *   so stale results never replace fresh ones.
 *
 * Privacy/security note: `VITE_OPENAI_API_KEY` is shipped in the browser
 * bundle (and therefore visible to anyone inspecting the page). Acceptable
 * for a controlled webinar/demo; for production this worker should call
 * a server-side proxy instead of OpenAI directly.
 */

import type { SentimentDimension } from '../utils/sentiment'

export interface SentimentJobRequest {
  type: 'score'
  /** Stable id for the source utterance — echoed back in the response. */
  jobId: string
  /** Raw `<user_emotions>` text, plus optional appearance for context. */
  emotions: string
  appearance?: string
  /** Optional audio descriptor (e.g. `noise`, `clear`). */
  audio?: string
  /** API key forwarded from the main thread (worker has no env access). */
  apiKey: string
  /** Model id, defaults to gpt-4o-mini. */
  model?: string
}

export interface SentimentJobResponse {
  type: 'result'
  jobId: string
  scores: Record<SentimentDimension, number>
  /** One-sentence rationale, useful for UI debugging / tooltip. */
  rationale: string
  /** Roundtrip duration in ms (for observability). */
  durationMs: number
}

export interface SentimentJobError {
  type: 'error'
  jobId: string
  message: string
}

export interface SentimentJobCancel {
  type: 'cancel'
  jobId: string
}

type WorkerInbound = SentimentJobRequest | SentimentJobCancel
type WorkerOutbound = SentimentJobResponse | SentimentJobError

const SYSTEM_PROMPT = `You are a sentiment analyzer for a live conversational
video demo. You receive free-form English descriptions of a user's visual
appearance, facial expression, posture, gaze and vocal tone, produced by
the Tavus Raven-1 perception model.

IMPORTANT — about Raven-1's output style:
Raven-1 explicitly does NOT use categorical emotion labels. It almost never
writes "angry", "happy" or "sad" outright. Instead it describes OBSERVABLE
CUES: "jaw is tight, brow is furrowed, voice elevated and sharp", "smiling
slightly with relaxed posture", "eyes shifting, pausing before answering".
Your job is to translate those observable cues into numeric scores on six
dimensions chosen to match Raven's actual vocabulary.

Dimensions (Italian labels, 0–100 each):

- coinvolgimento (engagement / attention): looking at the screen or camera,
  focused, leaning forward, attentive, listening intently, eyes fixed on
  the speaker, processing information, observing.
- positivita (positive valence): smiling, grinning, laughing, warm tone,
  cheerful, enthusiastic, animated in a positive way, open posture.
- tensione (tension / anger / frustration / discomfort): clenched jaw,
  tight lips, furrowed/knit brow, narrowed eyes, glaring, scowling,
  frowning, pursed lips, sharp/harsh/cutting tone, raised or elevated
  voice, shouting, snapping, sighing, huffing, agitated, irritated,
  exasperated, defensive, eye rolls. THIS IS WHERE STRONG NEGATIVE
  EMOTIONS LIVE — score it HIGH whenever you see physical-tension cues,
  even if Raven never writes the word "angry" or "frustrated".
- esitazione (hesitation / uncertainty): pausing, hesitant, unsure,
  uncertain, eyes shifting or darting, looking away/down, avoiding eye
  contact, fidgeting, biting lip, hedging, trailing off, lost in thought,
  confused, puzzled.
- attivazione (high arousal / surprise / alarm): eyes wide or widened,
  raised eyebrows, gasping, sharp inhale, jaw dropped, mouth agape,
  startled, shocked, stunned, alarmed, sudden movement, energized.
- calma (neutral baseline / composed): neutral expression, even tone,
  steady gaze, quiet, subdued, reserved, unexpressive, impassive, blank,
  baseline.

Scoring rules:
- Multiple dimensions can be high at once. Mixed states are normal
  (e.g. coinvolgimento=80 + esitazione=60 for a focused but uncertain user).
- USE THE FULL RANGE. Strong cues deserve strong scores: a clearly
  furrowed brow + sharp tone + clenched jaw should produce tensione ≥ 80.
  Do NOT anchor everything around 50.
- calma decreases as tensione, attivazione, or esitazione rise. Calma
  should be HIGH (70+) only when the description is bland or explicitly
  neutral.
- If the description is empty or uninformative, return calma=70 and
  the rest 0–15.
- IGNORE the user's spoken text content (transcript). Only the
  observable cues matter — a polite sentence said with clenched teeth
  is still high tensione.
- "rationale" must be ONE short Italian sentence (max 20 words) naming
  the dominant CUE you saw, not the dominant label. Example:
  "Mascella contratta e tono tagliente → tensione alta."`

const SCHEMA = {
  name: 'sentiment_scores',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'coinvolgimento',
      'positivita',
      'tensione',
      'esitazione',
      'attivazione',
      'calma',
      'rationale',
    ],
    properties: {
      coinvolgimento: { type: 'integer', minimum: 0, maximum: 100 },
      positivita: { type: 'integer', minimum: 0, maximum: 100 },
      tensione: { type: 'integer', minimum: 0, maximum: 100 },
      esitazione: { type: 'integer', minimum: 0, maximum: 100 },
      attivazione: { type: 'integer', minimum: 0, maximum: 100 },
      calma: { type: 'integer', minimum: 0, maximum: 100 },
      rationale: { type: 'string', maxLength: 200 },
    },
  },
  strict: true,
} as const

type ScoreShape = Record<SentimentDimension, number> & { rationale: string }

const inflight = new Map<string, AbortController>()

self.addEventListener('message', async (evt: MessageEvent<WorkerInbound>) => {
  const msg = evt.data
  if (!msg) return

  if (msg.type === 'cancel') {
    inflight.get(msg.jobId)?.abort()
    inflight.delete(msg.jobId)
    return
  }

  if (msg.type !== 'score') return

  const controller = new AbortController()
  inflight.set(msg.jobId, controller)
  const startedAt = performance.now()

  try {
    const userMessage = buildUserMessage(msg)
    const body = {
      model: msg.model ?? 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      temperature: 0,
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${msg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await safeText(res)
      throw new Error(`OpenAI ${res.status} — ${text.slice(0, 200)}`)
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = json.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')

    const parsed = JSON.parse(content) as ScoreShape
    const out: SentimentJobResponse = {
      type: 'result',
      jobId: msg.jobId,
      scores: {
        coinvolgimento: clamp(parsed.coinvolgimento),
        positivita: clamp(parsed.positivita),
        tensione: clamp(parsed.tensione),
        esitazione: clamp(parsed.esitazione),
        attivazione: clamp(parsed.attivazione),
        calma: clamp(parsed.calma),
      },
      rationale: parsed.rationale ?? '',
      durationMs: Math.round(performance.now() - startedAt),
    }
    post(out)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    const err: SentimentJobError = {
      type: 'error',
      jobId: msg.jobId,
      message: e instanceof Error ? e.message : String(e),
    }
    post(err)
  } finally {
    inflight.delete(msg.jobId)
  }
})

function buildUserMessage(msg: SentimentJobRequest): string {
  const parts: string[] = []
  parts.push('Raven user_emotions:\n' + (msg.emotions || '(empty)'))
  if (msg.appearance) {
    parts.push('Raven user_appearance (context only):\n' + msg.appearance)
  }
  if (msg.audio) {
    parts.push('Audio cues: ' + msg.audio)
  }
  return parts.join('\n\n')
}

function clamp(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, Math.round(v)))
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

function post(msg: WorkerOutbound) {
  ;(self as unknown as Worker).postMessage(msg)
}

export {}
