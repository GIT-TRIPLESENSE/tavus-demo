/**
 * Sentiment derivation utilities.
 *
 * Raven-1 emits descriptive text for the user's visual and audio state, not
 * numeric scores. We derive client-side, heuristic scores for 6 dimensions by
 * matching a curated keyword lexicon against the raw description. The goal is
 * a presentation-friendly readout for a webinar, not a clinical measurement —
 * the UI labels these values as "derived client-side" to avoid implying the
 * model itself returned them.
 */

import type {
  UserAudioAnalysis,
  UserVisualAnalysis,
} from '../types/cvi'

export type SentimentDimension =
  | 'fiducia'
  | 'interesse'
  | 'sorpresa'
  | 'frustrazione'
  | 'rabbia'
  | 'neutro'

export const SENTIMENT_DIMENSIONS: readonly SentimentDimension[] = [
  'fiducia',
  'interesse',
  'sorpresa',
  'frustrazione',
  'rabbia',
  'neutro',
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
 * Keyword → dimension-weight contributions. Weights are in the "raw" 0–1.5
 * space; they are summed across matches and then compressed to 0–100 via a
 * saturating curve so a single strong signal doesn't saturate instantly.
 *
 * Word boundaries are used where helpful to avoid false positives.
 */
const LEXICON: KeywordMap = [
  // fiducia / confidence / engagement
  [/\bconfident(ly)?\b/i, { fiducia: 1.2 }],
  [/\bassured\b/i, { fiducia: 1.0 }],
  [/\bself-assured\b/i, { fiducia: 1.2 }],
  [/\bengaged\b/i, { fiducia: 0.6, interesse: 0.8 }],
  [/\battentive\b/i, { fiducia: 0.5, interesse: 0.9 }],
  [/\bfocused\b/i, { fiducia: 0.6, interesse: 0.7 }],
  [/\bcomposed\b/i, { fiducia: 0.8 }],
  [/\brelaxed\b/i, { fiducia: 0.5, neutro: 0.3 }],
  [/\bsmiling\b/i, { fiducia: 0.8 }],
  [/\bsmile\b/i, { fiducia: 0.5 }],
  [/\bcomfortable\b/i, { fiducia: 0.6, neutro: 0.3 }],

  // interesse / interest / curiosity
  [/\binterested\b/i, { interesse: 1.2 }],
  [/\bcurious\b/i, { interesse: 1.0 }],
  [/\blistening\s+intently\b/i, { interesse: 1.2 }],
  [/\bleaning\s+in\b/i, { interesse: 0.9 }],
  [/\battentively\b/i, { interesse: 0.9 }],
  [/\bthoughtful(ly)?\b/i, { interesse: 0.6 }],
  [/\bpondering\b/i, { interesse: 0.6 }],
  [/\bprocessing\s+information\b/i, { interesse: 0.7 }],
  [/\bobserving\b/i, { interesse: 0.6 }],
  [/\bengrossed\b/i, { interesse: 1.0 }],
  [/\babsorbed\b/i, { interesse: 0.9 }],

  // sorpresa / surprise / shock
  [/\bsurprised\b/i, { sorpresa: 1.3 }],
  [/\bshock(ed)?\b/i, { sorpresa: 1.3, frustrazione: 0.2 }],
  [/\bamazed\b/i, { sorpresa: 1.1 }],
  [/\bastonished\b/i, { sorpresa: 1.2 }],
  [/\bwide[- ]eyed\b/i, { sorpresa: 1.0 }],
  [/\beyebrows?\s+raised\b/i, { sorpresa: 0.9 }],
  [/\bgasp(ing|ed)?\b/i, { sorpresa: 1.0 }],
  [/\bmouth\s+(slightly\s+)?open\b/i, { sorpresa: 0.4 }],
  [/\bunexpected\b/i, { sorpresa: 0.7 }],

  // frustrazione / frustration / confusion / stress (not anger yet)
  [/\bfrustrated\b/i, { frustrazione: 1.3, rabbia: 0.3 }],
  [/\bfrustration\b/i, { frustrazione: 1.2 }],
  [/\bannoyed\b/i, { frustrazione: 1.1, rabbia: 0.4 }],
  [/\birritated\b/i, { frustrazione: 1.0, rabbia: 0.5 }],
  [/\bconfused\b/i, { frustrazione: 0.8 }],
  [/\bpuzzled\b/i, { frustrazione: 0.6, interesse: 0.3 }],
  [/\bexasperated\b/i, { frustrazione: 1.2, rabbia: 0.4 }],
  [/\bimpatien(t|ce)\b/i, { frustrazione: 1.0, rabbia: 0.3 }],
  [/\bdisappointed\b/i, { frustrazione: 0.9 }],
  [/\bsighing\b/i, { frustrazione: 0.7 }],
  [/\brolling\s+(his|her|their)?\s*eyes\b/i, { frustrazione: 1.0, rabbia: 0.3 }],
  [/\btense\b/i, { frustrazione: 0.8 }],
  [/\bworried\b/i, { frustrazione: 0.6 }],
  [/\bstressed\b/i, { frustrazione: 1.0 }],
  [/\banxious\b/i, { frustrazione: 0.9 }],
  [/\bupset\b/i, { frustrazione: 0.9, rabbia: 0.6 }],

  // rabbia / anger
  [/\bangry\b/i, { rabbia: 1.4 }],
  [/\banger\b/i, { rabbia: 1.2 }],
  [/\bfurious\b/i, { rabbia: 1.5 }],
  [/\benraged\b/i, { rabbia: 1.5 }],
  [/\bhostile\b/i, { rabbia: 1.2 }],
  [/\baggressive\b/i, { rabbia: 1.1 }],
  [/\bglaring\b/i, { rabbia: 1.0 }],
  [/\bscowling\b/i, { rabbia: 1.1, frustrazione: 0.6 }],
  [/\bfrowning\b/i, { rabbia: 0.4, frustrazione: 0.7 }],
  [/\bclenched\s+(jaw|fists?|teeth)\b/i, { rabbia: 1.2, frustrazione: 0.6 }],
  [/\bshouting\b/i, { rabbia: 1.2 }],
  [/\braised\s+voice\b/i, { rabbia: 0.9 }],
  [/\bharsh\s+tone\b/i, { rabbia: 0.9, frustrazione: 0.5 }],

  // neutro / neutral / distracted
  [/\bneutral\b/i, { neutro: 1.2 }],
  [/\bcalm\b/i, { neutro: 0.6, fiducia: 0.3 }],
  [/\bunexpressive\b/i, { neutro: 1.1 }],
  [/\bimpassive\b/i, { neutro: 1.0 }],
  [/\bblank\s+expression\b/i, { neutro: 0.9 }],
  [/\bdistracted\b/i, { neutro: 0.7 }],
  [/\blost\s+in\s+thought\b/i, { neutro: 0.6, interesse: 0.3 }],
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
    fiducia: 0,
    interesse: 0,
    sorpresa: 0,
    frustrazione: 0,
    rabbia: 0,
    neutro: 0,
  }
  if (!haystack.trim()) {
    return { ...raw, neutro: 50 }
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
    fiducia: compress(raw.fiducia),
    interesse: compress(raw.interesse),
    sorpresa: compress(raw.sorpresa),
    frustrazione: compress(raw.frustrazione),
    rabbia: compress(raw.rabbia),
    neutro: compress(raw.neutro),
  }

  // If nothing triggered, infer a neutral baseline from the text presence.
  const activeMax = Math.max(
    scores.fiducia,
    scores.interesse,
    scores.sorpresa,
    scores.frustrazione,
    scores.rabbia,
  )
  if (activeMax === 0 && scores.neutro === 0) {
    scores.neutro = 50
  } else if (scores.neutro === 0) {
    // Neutro decays as other dimensions rise: baseline 100 minus the strongest
    // active emotion, floored at 0.
    scores.neutro = Math.max(0, 100 - activeMax)
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
  let best: SentimentDimension = 'neutro'
  let bestVal = -1
  for (const dim of SENTIMENT_DIMENSIONS) {
    // neutro only wins if nothing else breaks the tie
    if (dim === 'neutro') continue
    if (scores[dim] > bestVal) {
      bestVal = scores[dim]
      best = dim
    }
  }
  if (bestVal <= 5) return 'neutro'
  return best
}
