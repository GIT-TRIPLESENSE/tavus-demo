import { useMemo } from 'react'
import type { TranscriptEntry } from '../../types/cvi'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import {
  SENTIMENT_DIMENSIONS,
  buildSentimentReadout,
  type SentimentDimension,
} from '../../utils/sentiment'

interface SentimentPanelProps {
  /** Full transcript — the panel reads the latest user entry. */
  entries: TranscriptEntry[]
}

const DIMENSION_LABEL: Record<SentimentDimension, string> = {
  fiducia: 'fiducia',
  interesse: 'interesse',
  sorpresa: 'sorpresa',
  frustrazione: 'frustrazione',
  rabbia: 'rabbia',
  neutro: 'neutro',
}

const DIMENSION_COLOR: Record<
  SentimentDimension,
  { bar: string; bg: string; text: string }
> = {
  fiducia: {
    bar: 'bg-emerald-400',
    bg: 'bg-emerald-400/10',
    text: 'text-emerald-300',
  },
  interesse: {
    bar: 'bg-sky-400',
    bg: 'bg-sky-400/10',
    text: 'text-sky-300',
  },
  sorpresa: {
    bar: 'bg-amber-400',
    bg: 'bg-amber-400/10',
    text: 'text-amber-300',
  },
  frustrazione: {
    bar: 'bg-orange-400',
    bg: 'bg-orange-400/10',
    text: 'text-orange-300',
  },
  rabbia: {
    bar: 'bg-rose-500',
    bg: 'bg-rose-500/10',
    text: 'text-rose-300',
  },
  neutro: {
    bar: 'bg-white/40',
    bg: 'bg-white/[0.04]',
    text: 'text-white/60',
  },
}

export function SentimentPanel({ entries }: SentimentPanelProps) {
  const latestUserEntry = useMemo(
    () =>
      [...entries].reverse().find((e) => e.role === 'user' && hasAnalysis(e)),
    [entries],
  )

  const readout = useMemo(
    () =>
      buildSentimentReadout(
        latestUserEntry?.visualAnalysis,
        latestUserEntry?.audioAnalysis,
      ),
    [latestUserEntry],
  )

  const { scores, dominant, visual, audio } = readout
  const hasSignal = Boolean(latestUserEntry)

  return (
    <Card
      title="Sentiment"
      subtitle="Raven · user appearance + emotions (derived client-side)"
      accent="fuchsia"
      className="flex h-full flex-col"
      titleTrailing={
        <Badge tone={hasSignal ? 'live' : 'neutral'} dot>
          {hasSignal ? DIMENSION_LABEL[dominant] : 'idle'}
        </Badge>
      }
    >
      <div className="space-y-4 px-5 py-4">
        {!hasSignal && (
          <p className="text-xs text-white/40">
            Sentiment values appear as soon as the first user turn arrives with
            a Raven visual analysis. If the persona isn't Raven-enabled, no
            signal will be emitted.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {SENTIMENT_DIMENSIONS.map((dim) => (
            <ScoreBar
              key={dim}
              dim={dim}
              value={scores[dim]}
              isDominant={hasSignal && dim === dominant}
            />
          ))}
        </div>

        {hasSignal && (
          <>
            <Section title="Emozioni (Raven)" accent="fuchsia">
              {visual.emotions ? (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-white/80">
                  {visual.emotions}
                </p>
              ) : (
                <p className="text-xs italic text-white/40">
                  Nessun blocco <code>&lt;user_emotions&gt;</code> nel payload.
                </p>
              )}
            </Section>
            <Section title="Aspetto" accent="cyan">
              {visual.appearance ? (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-white/70">
                  {visual.appearance}
                </p>
              ) : (
                <p className="text-xs italic text-white/40">
                  Nessun blocco <code>&lt;user_appearance&gt;</code>.
                </p>
              )}
            </Section>
            {(audio.tags.length > 0 || audio.text) && (
              <Section title="Audio" accent="amber">
                <div className="flex flex-wrap gap-1.5">
                  {audio.tags.map((t, i) => (
                    <Badge key={`${t}-${i}`} tone="warn">
                      {t}
                    </Badge>
                  ))}
                  {audio.text && (
                    <span className="text-xs text-white/60">
                      {audio.text}
                    </span>
                  )}
                </div>
              </Section>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

function hasAnalysis(e: TranscriptEntry): boolean {
  return Boolean(e.visualAnalysis || e.audioAnalysis)
}

interface ScoreBarProps {
  dim: SentimentDimension
  value: number
  isDominant: boolean
}

function ScoreBar({ dim, value, isDominant }: ScoreBarProps) {
  const colors = DIMENSION_COLOR[dim]
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div
      className={[
        'rounded-lg border px-3 py-2 transition',
        isDominant
          ? 'border-white/20 bg-white/[0.05]'
          : 'border-white/5 bg-white/[0.02]',
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={[
            'text-[11px] font-medium uppercase tracking-wider',
            colors.text,
          ].join(' ')}
        >
          {DIMENSION_LABEL[dim]}
        </span>
        <span
          className={[
            'font-mono text-[11px] tabular-nums',
            isDominant ? 'text-white' : 'text-white/60',
          ].join(' ')}
        >
          {pct}%
        </span>
      </div>
      <div
        className={[
          'mt-2 h-1.5 w-full overflow-hidden rounded-full',
          colors.bg,
        ].join(' ')}
      >
        <div
          className={[
            'h-full rounded-full transition-[width] duration-500',
            colors.bar,
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Section({
  title,
  accent,
  children,
}: {
  title: string
  accent: 'fuchsia' | 'cyan' | 'amber'
  children: React.ReactNode
}) {
  const border =
    accent === 'fuchsia'
      ? 'border-fuchsia-400/15'
      : accent === 'cyan'
        ? 'border-cyan-400/15'
        : 'border-amber-400/15'
  return (
    <div
      className={[
        'rounded-xl border bg-white/[0.02] px-3 py-2.5',
        border,
      ].join(' ')}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        {title}
      </p>
      {children}
    </div>
  )
}
