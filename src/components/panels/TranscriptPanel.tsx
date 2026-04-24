import { useEffect, useRef } from 'react'
import type { TranscriptEntry } from '../../types/cvi'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { capitalize } from '../../utils/format'
import {
  parseAudioAnalysis,
  parseVisualAnalysis,
} from '../../utils/sentiment'

interface TranscriptPanelProps {
  entries: TranscriptEntry[]
}

export function TranscriptPanel({ entries }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [entries.length])

  return (
    <Card
      title="Transcription"
      subtitle="Real-time STT + LLM response stream"
      accent="cyan"
      className="flex h-full flex-col"
    >
      <div
        ref={scrollRef}
        className="max-h-[42vh] min-h-[220px] space-y-3 overflow-y-auto px-5 py-4"
      >
        {entries.length === 0 && (
          <p className="text-xs text-white/40">
            Transcript will appear here as soon as the conversation starts.
          </p>
        )}
        {entries.map((entry) => (
          <TranscriptRow key={entry.id} entry={entry} />
        ))}
      </div>
    </Card>
  )
}

function summarize(text: string | undefined): string | undefined {
  if (!text) return undefined
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const end = trimmed.search(/[.!?]\s|$/)
  const slice = end > 0 ? trimmed.slice(0, end) : trimmed
  return slice.length > 40 ? `${slice.slice(0, 37)}…` : slice
}

function TranscriptRow({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === 'user'
  return (
    <div
      className={[
        'flex flex-col gap-1.5',
        isUser ? 'items-end text-right' : 'items-start',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <Badge tone={isUser ? 'info' : 'neutral'}>
          {isUser ? 'User' : capitalize(entry.role)}
        </Badge>
        <span className="text-[10px] text-white/30">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <p
        className={[
          'max-w-[92%] rounded-xl px-3 py-2 text-sm leading-relaxed',
          isUser
            ? 'bg-cyan-400/10 text-cyan-50 ring-1 ring-cyan-400/20'
            : 'bg-white/[0.05] text-white/90 ring-1 ring-white/10',
        ].join(' ')}
      >
        {entry.text || <span className="text-white/30">(no speech)</span>}
      </p>
      {(entry.audioAnalysis || entry.visualAnalysis) && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {entry.audioAnalysis &&
            (() => {
              const audio = parseAudioAnalysis(entry.audioAnalysis)
              const label = audio.tags[0] ?? audio.text.slice(0, 32)
              if (!label) return null
              return <Badge tone="warn">audio · {label}</Badge>
            })()}
          {entry.visualAnalysis &&
            (() => {
              const visual = parseVisualAnalysis(entry.visualAnalysis)
              const label = summarize(visual.emotions) ?? 'vision'
              return <Badge tone="warn">vision · {label}</Badge>
            })()}
        </div>
      )}
    </div>
  )
}
