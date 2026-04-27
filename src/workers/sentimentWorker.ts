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

const SYSTEM_PROMPT = `You are a sentiment analyzer for a video-call demo.
You receive a free-form English description of a user's facial expression
and emotional state, produced by the Raven-1 perception model (which emits
natural language, not categorical labels). Your job is to estimate, on a
0–100 scale, how strongly each of these six Italian-labelled dimensions is
present in the description:

- fiducia: confidence, self-assurance, trust, engagement
- interesse: interest, curiosity, attentiveness, focus on the conversation
- sorpresa: surprise, shock, astonishment
- frustrazione: frustration, confusion, impatience, mild annoyance
- rabbia: anger, hostility, aggression
- neutro: neutrality, calm baseline, lack of strong emotion

Rules:
- Multiple dimensions can be present at once (e.g. fiducia+interesse).
- "neutro" should be high when the description is bland or unexpressive,
  and decrease as other dimensions activate.
- Use the full 0-100 range. Do not anchor everything around 50.
- If the description is empty or uninformative, return neutro=70 and
  others=0–10.
- "rationale" must be ONE short sentence in Italian explaining the
  dominant cue you saw (max 20 words).`

const SCHEMA = {
  name: 'sentiment_scores',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'fiducia',
      'interesse',
      'sorpresa',
      'frustrazione',
      'rabbia',
      'neutro',
      'rationale',
    ],
    properties: {
      fiducia: { type: 'integer', minimum: 0, maximum: 100 },
      interesse: { type: 'integer', minimum: 0, maximum: 100 },
      sorpresa: { type: 'integer', minimum: 0, maximum: 100 },
      frustrazione: { type: 'integer', minimum: 0, maximum: 100 },
      rabbia: { type: 'integer', minimum: 0, maximum: 100 },
      neutro: { type: 'integer', minimum: 0, maximum: 100 },
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
        fiducia: clamp(parsed.fiducia),
        interesse: clamp(parsed.interesse),
        sorpresa: clamp(parsed.sorpresa),
        frustrazione: clamp(parsed.frustrazione),
        rabbia: clamp(parsed.rabbia),
        neutro: clamp(parsed.neutro),
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
