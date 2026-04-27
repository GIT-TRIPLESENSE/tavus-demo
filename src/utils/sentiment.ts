/**
 * Sentiment derivation utilities — aligned to Raven-1's natural-language
 * output domain.
 *
 * Raven-1 explicitly does NOT emit categorical labels ("happy", "angry"); it
 * emits descriptive natural-language summaries of *observable cues* — facial
 * micro-expressions, posture, gaze direction, vocal tone and prosody,
 * hesitation, attention shifts. (See Tavus' Raven-1 announcement and the
 * perception docs.)
 *
 * Earlier versions of this scorer used Ekman-style internal-state labels
 * (fiducia / rabbia / sorpresa…). That worked for surprise but failed for
 * "strong" emotions like anger because Raven almost never writes "angry";
 * it writes "jaw is tight, brow furrowed, voice slightly raised, tone
 * sharp". We now map directly to six axes that match Raven's actual
 * vocabulary:
 *
 * - coinvolgimento  — engagement / attention (gaze, focus, leaning in)
 * - positivita      — positive valence (smile, warmth, relaxed posture)
 * - tensione        — tension / anger / frustration / discomfort
 *                     (clenched jaw, furrowed brow, sharp or harsh tone,
 *                     raised voice, sighing, fidgeting under stress)
 * - esitazione      — hesitation / uncertainty (pauses, hedging, gaze
 *                     shifts, "lost in thought")
 * - attivazione     — high arousal / surprise / alarm (eyes wide, sharp
 *                     inhale, eyebrows raised, sudden movement)
 * - calma           — neutral baseline / composed / unexpressive
 *
 * The keyword scorer here is the *fallback* path used when the LLM scorer
 * (`sentimentWorker.ts`) is disabled or still in flight. Both paths use the
 * same dimension set and the same naming, so the UI never sees a mismatch.
 */

import type {
  UserAudioAnalysis,
  UserVisualAnalysis,
} from '../types/cvi'

export type SentimentDimension =
  | 'coinvolgimento'
  | 'positivita'
  | 'tensione'
  | 'esitazione'
  | 'attivazione'
  | 'calma'

export const SENTIMENT_DIMENSIONS: readonly SentimentDimension[] = [
  'coinvolgimento',
  'positivita',
  'tensione',
  'esitazione',
  'attivazione',
  'calma',
] as const

export type SentimentScores = Record<SentimentDimension, number>

export interface VisualAnalysisParts {
  /** Raw `<user_appearance>` text, trimmed. */
  appearance?: string
  /** Raw `<user_emotions>` text, trimmed. */
  emotions?: string
  /** Whatever wasn't inside a known tag. */
  other?: string
  /** Original input as a string (for fallback rendering). */
  raw: string
}

export interface AudioAnalysisParts {
  raw: string
  /** Inline tags like `((noise))`, `((clear))`. */
  tags: string[]
  /** Text remaining after tags are stripped. */
  text: string
}

/**
 * Coerce a Raven visual-analysis payload into a plain string. Strings are
 * returned as-is; objects are stringified into a best-effort flat form.
 */
export function visualAnalysisToString(
  value: UserVisualAnalysis | undefined,
): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join('\n')
  }
  return String(value)
}

export function audioAnalysisToString(
  value: UserAudioAnalysis | undefined,
): string {
  return visualAnalysisToString(value as UserVisualAnalysis | undefined)
}

const TAG_PATTERN = /<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g

/** Extract `<user_appearance>` and `<user_emotions>` sections. */
export function parseVisualAnalysis(
  raw: UserVisualAnalysis | undefined,
): VisualAnalysisParts {
  const str = visualAnalysisToString(raw)
  const result: VisualAnalysisParts = { raw: str }
  if (!str) return result

  let remaining = str
  let match: RegExpExecArray | null
  TAG_PATTERN.lastIndex = 0
  while ((match = TAG_PATTERN.exec(str)) !== null) {
    const [full, tag, body] = match
    const clean = body.trim()
    if (tag === 'user_appearance') result.appearance = clean
    else if (tag === 'user_emotions') result.emotions = clean
    remaining = remaining.replace(full, '')
  }
  const leftover = remaining.trim()
  if (leftover) result.other = leftover
  return result
}

/** Extract `((tags))` and plain text from an audio-analysis payload. */
export function parseAudioAnalysis(
  raw: UserAudioAnalysis | undefined,
): AudioAnalysisParts {
  const str = audioAnalysisToString(raw)
  const tags: string[] = []
  const tagPattern = /\(\(([^()]+)\)\)/g
  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(str)) !== null) {
    tags.push(match[1].trim())
  }
  const text = str.replace(tagPattern, '').trim()
  return { raw: str, tags, text }
}

type KeywordMap = ReadonlyArray<
  readonly [RegExp, Partial<SentimentScores>]
>

/**
 * Cue → dimension contributions, calibrated against Raven-1 sample outputs.
 * Each entry is a regex matched against the concatenation of user_emotions,
 * user_appearance and audio descriptors. Weights are in raw 0–1.5 space and
 * are summed across hits, then compressed to 0–100 via a saturating curve.
 *
 * Important: the cues are written in Raven's idiom, not a clinical idiom.
 * For "tensione" we lean heavily on physical-tension words (jaw, brow,
 * sharp, raised voice, sighing) because Raven rarely uses "angry" outright.
 */
const LEXICON: KeywordMap = [
  // ─── coinvolgimento — engagement / attention ───────────────────────────
  [/\bengaged\b/i, { coinvolgimento: 1.2 }],
  [/\battentive(ly)?\b/i, { coinvolgimento: 1.0 }],
  [/\bfocused\b/i, { coinvolgimento: 1.0 }],
  [/\blistening\s+(intently|attentively|carefully)\b/i, { coinvolgimento: 1.2 }],
  [/\bleaning\s+(in|forward|toward)\b/i, { coinvolgimento: 1.0 }],
  [/\bmaintaining\s+eye\s+contact\b/i, { coinvolgimento: 1.0 }],
  [/\b(eyes|gaze)\s+(directed|fixed)\s+(at|on|toward|towards)\s+(the\s+)?(camera|screen|speaker)\b/i, { coinvolgimento: 1.0 }],
  [/\blooking\s+(at|toward|towards)\s+(the\s+)?(camera|screen|speaker)\b/i, { coinvolgimento: 0.8 }],
  [/\bobserving\b/i, { coinvolgimento: 0.6 }],
  [/\bprocessing\s+(information|what)\b/i, { coinvolgimento: 0.8, esitazione: 0.3 }],
  [/\bengrossed\b/i, { coinvolgimento: 1.1 }],
  [/\babsorbed\b/i, { coinvolgimento: 1.0 }],
  [/\binterested\b/i, { coinvolgimento: 1.0 }],
  [/\bcurious\b/i, { coinvolgimento: 0.9, attivazione: 0.3 }],
  [/\binquisitive\b/i, { coinvolgimento: 0.9 }],

  // ─── positivita — positive valence ─────────────────────────────────────
  [/\bsmiling\b/i, { positivita: 1.3 }],
  [/\bsmile\b/i, { positivita: 0.9 }],
  [/\bgrinning\b/i, { positivita: 1.2 }],
  [/\b(warm|warmth)\b/i, { positivita: 0.8 }],
  [/\bfriendly\b/i, { positivita: 0.9 }],
  [/\benthusiastic(ally)?\b/i, { positivita: 1.1, attivazione: 0.4 }],
  [/\bexcited(ly)?\b/i, { positivita: 0.9, attivazione: 0.7 }],
  [/\banimated(ly)?\b/i, { positivita: 0.7, attivazione: 0.6 }],
  [/\bcheerful\b/i, { positivita: 1.1 }],
  [/\bjoyful\b/i, { positivita: 1.2 }],
  [/\blaughing\b/i, { positivita: 1.2, attivazione: 0.5 }],
  [/\blaugh(s|ed)?\b/i, { positivita: 0.8 }],
  [/\bchuckl(es|ing|ed)\b/i, { positivita: 0.9 }],
  [/\brelaxed\b/i, { positivita: 0.6, calma: 0.5 }],
  [/\bcomfortable\b/i, { positivita: 0.6, calma: 0.4 }],
  [/\bopen\s+(posture|body\s+language)\b/i, { positivita: 0.7 }],
  [/\bbright(\s+expression)?\b/i, { positivita: 0.8 }],
  [/\bplayful(ly)?\b/i, { positivita: 0.8 }],

  // ─── tensione — tension / anger / frustration / discomfort ─────────────
  // Strong physical-tension cues that Raven actually emits. Each pattern is
  // written in BOTH adjective→noun ("clenched jaw") and noun→adjective
  // ("jaw is clenched") form, because Raven mixes the two freely.
  [/\bclenched\s+(jaw|fists?|teeth)\b/i, { tensione: 1.5 }],
  [/\b(jaw|fists?|teeth)\s+(is|are|seems?|appears?)\s+(tightly\s+|firmly\s+)?clenched\b/i, { tensione: 1.5 }],
  [/\b(tight|tense)(ly)?\s+(jaw|lips?|mouth|shoulders|posture)\b/i, { tensione: 1.3 }],
  [/\b(jaw|brow|forehead|shoulders|posture|lips?|mouth)\s+(is|are|seems?|appears?)\s+(deeply\s+|visibly\s+|noticeably\s+|slightly\s+)?(tight(ened)?|tense|tightened|stiff)\b/i, { tensione: 1.2 }],
  [/\b(furrowed|knit(ted)?)\s+brows?\b/i, { tensione: 1.2 }],
  [/\bbrows?\s+(is|are|seems?|appears?)?\s*(deeply\s+|visibly\s+|slightly\s+)?(furrowed|knitted|drawn\s+together|knotted)\b/i, { tensione: 1.2 }],
  [/\bnarrowed\s+eyes\b/i, { tensione: 1.0 }],
  [/\beyes\s+(are|seem|appear)?\s*narrowed\b/i, { tensione: 1.0 }],
  [/\bglaring\b/i, { tensione: 1.3 }],
  [/\bscowling\b/i, { tensione: 1.3 }],
  [/\bfrowning\b/i, { tensione: 0.9 }],
  [/\bpursed\s+lips?\b/i, { tensione: 0.9 }],
  [/\blips?\s+(is|are|seem|appear)?\s*(tightly\s+)?pursed\b/i, { tensione: 0.9 }],
  [/\bgrimac(ing|e|ed)\b/i, { tensione: 1.0 }],
  // Vocal cues — again, both orders:
  [/\bharsh\s+(tone|voice|delivery)\b/i, { tensione: 1.3 }],
  [/\b(tone|voice|delivery)\s+(is|has\s+become|sounds|seems|turns)\s+(more\s+)?harsh\b/i, { tensione: 1.3 }],
  [/\b(sharp|cutting|biting)\s+(tone|voice|edge)\b/i, { tensione: 1.2 }],
  [/\b(tone|voice)\s+(is|has\s+become|sounds|seems|turns)\s+(more\s+)?(sharp|cutting|biting|sharper)\b/i, { tensione: 1.2 }],
  [/\b(raised|elevated|louder?|booming)\s+voice\b/i, { tensione: 1.0 }],
  [/\bvoice\s+(is|has\s+become|gets|grows|turns)\s+(more\s+)?(raised|elevated|louder?|sharp(er)?)\b/i, { tensione: 1.0 }],
  [/\bshouting\b/i, { tensione: 1.3, attivazione: 0.6 }],
  [/\byelling\b/i, { tensione: 1.3, attivazione: 0.6 }],
  [/\bsnapping\b/i, { tensione: 1.1 }],
  [/\bcurt\b/i, { tensione: 0.8 }],
  [/\bclipped\s+(speech|tone|response)\b/i, { tensione: 0.8 }],
  [/\bsigh(ing|ed)?\b/i, { tensione: 0.7 }],
  [/\b(huffing|huff)\b/i, { tensione: 0.9 }],
  // Internal-state words (when Raven does use them):
  [/\bangry\b/i, { tensione: 1.4 }],
  [/\banger\b/i, { tensione: 1.3 }],
  [/\bfurious\b/i, { tensione: 1.5 }],
  [/\benraged\b/i, { tensione: 1.5 }],
  [/\bhostile\b/i, { tensione: 1.2 }],
  [/\baggressive(ly)?\b/i, { tensione: 1.2 }],
  [/\birritated\b/i, { tensione: 1.2 }],
  [/\bannoyed\b/i, { tensione: 1.1 }],
  [/\bfrustrated\b/i, { tensione: 1.3 }],
  [/\bfrustration\b/i, { tensione: 1.2 }],
  [/\bexasperated\b/i, { tensione: 1.3 }],
  [/\bimpatien(t|ce|tly)\b/i, { tensione: 1.0 }],
  [/\bagitated\b/i, { tensione: 1.0, attivazione: 0.4 }],
  [/\bdistressed\b/i, { tensione: 1.0 }],
  [/\bupset\b/i, { tensione: 1.0 }],
  [/\bstressed\b/i, { tensione: 1.0 }],
  [/\banxious\b/i, { tensione: 0.9, esitazione: 0.4 }],
  [/\bdefensive(ly)?\b/i, { tensione: 0.9 }],
  [/\b(rolling|rolled)\s+(his|her|their)?\s*eyes\b/i, { tensione: 1.0 }],

  // ─── esitazione — hesitation / uncertainty ─────────────────────────────
  [/\bhesitant(ly)?\b/i, { esitazione: 1.3 }],
  [/\bhesitating\b/i, { esitazione: 1.2 }],
  [/\bhesitation\b/i, { esitazione: 1.1 }],
  [/\bunsure\b/i, { esitazione: 1.2 }],
  [/\buncertain(ty|ly)?\b/i, { esitazione: 1.2 }],
  [/\bdoubtful\b/i, { esitazione: 1.0 }],
  [/\bpondering\b/i, { esitazione: 0.7, coinvolgimento: 0.3 }],
  [/\bthoughtful(ly)?\b/i, { esitazione: 0.5, coinvolgimento: 0.3 }],
  [/\blost\s+in\s+thought\b/i, { esitazione: 0.7 }],
  [/\bpaus(ing|es|ed)\s+(before|to)\b/i, { esitazione: 0.9 }],
  [/\bpaus(ing|e|es|ed)\b/i, { esitazione: 0.6 }],
  [/\btrailing\s+off\b/i, { esitazione: 1.0 }],
  [/\b(eyes|gaze)\s+(shift(ing|ed)?|dart(ing|ed)?|wandering|moving\s+around)\b/i, { esitazione: 1.0 }],
  [/\blooking\s+(away|down|aside|elsewhere)\b/i, { esitazione: 0.7 }],
  [/\bavoiding\s+(eye\s+contact|the\s+camera)\b/i, { esitazione: 1.0 }],
  [/\bfidget(ing|y|ed)\b/i, { esitazione: 0.8, tensione: 0.3 }],
  [/\bbiting\s+(his|her|their)?\s*(lip|nail)/i, { esitazione: 0.9 }],
  [/\btentative(ly)?\b/i, { esitazione: 1.0 }],
  [/\bhedging\b/i, { esitazione: 1.1 }],
  [/\bconfused\b/i, { esitazione: 0.8, tensione: 0.3 }],
  [/\bpuzzled\b/i, { esitazione: 0.7, coinvolgimento: 0.3 }],
  [/\bperplexed\b/i, { esitazione: 0.8 }],

  // ─── attivazione — high arousal / surprise / alarm ─────────────────────
  [/\bsurprised\b/i, { attivazione: 1.3 }],
  [/\bsurprise\b/i, { attivazione: 1.0 }],
  [/\bshocked\b/i, { attivazione: 1.4 }],
  [/\bstartled\b/i, { attivazione: 1.3 }],
  [/\bamazed\b/i, { attivazione: 1.1, positivita: 0.4 }],
  [/\bastonished\b/i, { attivazione: 1.2 }],
  [/\bstunned\b/i, { attivazione: 1.2 }],
  [/\bwide[- ]eyed\b/i, { attivazione: 1.2 }],
  [/\beyes\s+(wide|widened|opened\s+wide)\b/i, { attivazione: 1.2 }],
  [/\beyebrows?\s+raised\b/i, { attivazione: 1.0 }],
  [/\braised\s+eyebrows?\b/i, { attivazione: 1.0 }],
  [/\bgasp(ing|ed|s)?\b/i, { attivazione: 1.1 }],
  [/\b(sharp|sudden)\s+inhale\b/i, { attivazione: 1.0 }],
  [/\bmouth\s+(slightly\s+)?(open|agape)\b/i, { attivazione: 0.5 }],
  [/\bjaw\s+drop(ped|ping)?\b/i, { attivazione: 1.2 }],
  [/\balarmed\b/i, { attivazione: 1.2, tensione: 0.4 }],
  [/\bunexpected(ly)?\b/i, { attivazione: 0.6 }],
  [/\bsudden(ly)?\b/i, { attivazione: 0.5 }],
  [/\benergized\b/i, { attivazione: 0.8, positivita: 0.3 }],

  // ─── calma — neutral baseline / composed ───────────────────────────────
  [/\bneutral\b/i, { calma: 1.2 }],
  [/\bcomposed\b/i, { calma: 1.1 }],
  [/\bcalm(ly)?\b/i, { calma: 1.2 }],
  [/\beven\s+(tone|voice|keel)\b/i, { calma: 1.0 }],
  [/\bsteady\s+(tone|voice|gaze)\b/i, { calma: 0.9 }],
  [/\bquiet(ly)?\b/i, { calma: 0.6 }],
  [/\bsubdued\b/i, { calma: 0.7 }],
  [/\breserved\b/i, { calma: 0.7 }],
  [/\bunexpressive\b/i, { calma: 1.0 }],
  [/\bimpassive\b/i, { calma: 1.0 }],
  [/\bblank\s+expression\b/i, { calma: 0.9 }],
  [/\bbaseline\b/i, { calma: 0.7 }],
]

/** Logistic compression 0..inf → 0..100. */
function compress(x: number): number {
  if (x <= 0) return 0
  // 1.0 raw ≈ 50, 2.0 raw ≈ 76, 3.0 raw ≈ 88
  return Math.round(100 * (1 - Math.exp(-x * 0.7)))
}

/**
 * Score the 6 sentiment dimensions from a free-form description. Pass both
 * the visual-emotions text and any audio hints if available — they are
 * concatenated for matching.
 */
export function scoreSentiment(...sources: Array<string | undefined>): SentimentScores {
  const haystack = sources.filter(Boolean).join(' \n ')
  const raw: SentimentScores = {
    coinvolgimento: 0,
    positivita: 0,
    tensione: 0,
    esitazione: 0,
    attivazione: 0,
    calma: 0,
  }
  if (!haystack.trim()) {
    return { ...raw, calma: 50 }
  }
  for (const [regex, contrib] of LEXICON) {
    // count matches to let repeated cues amplify the signal
    const matches = haystack.match(new RegExp(regex.source, regex.flags.replace('g', '') + 'g'))
    const count = matches?.length ?? 0
    if (count === 0) continue
    for (const dim of SENTIMENT_DIMENSIONS) {
      const w = contrib[dim]
      if (w) raw[dim] += w * count
    }
  }

  const scores: SentimentScores = {
    coinvolgimento: compress(raw.coinvolgimento),
    positivita: compress(raw.positivita),
    tensione: compress(raw.tensione),
    esitazione: compress(raw.esitazione),
    attivazione: compress(raw.attivazione),
    calma: compress(raw.calma),
  }

  // Calma decays as activation/tension/hesitation rise — those imply the
  // subject is *not* at baseline. Engagement and positivita are compatible
  // with a calm baseline so they don't suppress it.
  const activeMax = Math.max(
    scores.tensione,
    scores.attivazione,
    scores.esitazione,
  )
  if (
    scores.coinvolgimento === 0 &&
    scores.positivita === 0 &&
    activeMax === 0 &&
    scores.calma === 0
  ) {
    scores.calma = 50
  } else if (scores.calma === 0) {
    scores.calma = Math.max(0, 100 - activeMax)
  }
  return scores
}

export interface SentimentReadout {
  scores: SentimentScores
  dominant: SentimentDimension
  visual: VisualAnalysisParts
  audio: AudioAnalysisParts
}

export function buildSentimentReadout(
  visual: UserVisualAnalysis | undefined,
  audio: UserAudioAnalysis | undefined,
): SentimentReadout {
  const v = parseVisualAnalysis(visual)
  const a = parseAudioAnalysis(audio)
  const scores = scoreSentiment(v.emotions, v.other, v.appearance, a.text)
  const dominant = pickDominant(scores)
  return { scores, dominant, visual: v, audio: a }
}

function pickDominant(scores: SentimentScores): SentimentDimension {
  let best: SentimentDimension = 'calma'
  let bestVal = -1
  for (const dim of SENTIMENT_DIMENSIONS) {
    // calma only wins if nothing else breaks the tie
    if (dim === 'calma') continue
    if (scores[dim] > bestVal) {
      bestVal = scores[dim]
      best = dim
    }
  }
  if (bestVal <= 5) return 'calma'
  return best
}
