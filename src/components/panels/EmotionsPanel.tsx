import type { EmotionSignal } from '../../types/cvi'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

interface EmotionsPanelProps {
  signals: EmotionSignal[]
}

const sourceLabel: Record<EmotionSignal['source'], string> = {
  user_audio_analysis: 'Audio · Raven',
  user_visual_analysis: 'Vision · Raven',
  perception_tool_call: 'Perception tool',
}

export function EmotionsPanel({ signals }: EmotionsPanelProps) {
  const latest = signals[0]
  return (
    <Card
      title="Emotions & perception"
      subtitle="Raven multimodal signals"
      accent="fuchsia"
      className="flex h-full flex-col"
    >
      <div className="space-y-4 px-5 py-4">
        {!latest && (
          <p className="text-xs text-white/40">
            Emotion signals will appear as soon as Raven emits analysis events.
            Make sure the selected persona has <code>raven-0</code> or{' '}
            <code>raven-1</code> configured.
          </p>
        )}
        {latest && (
          <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-4">
            <div className="flex items-center justify-between">
              <Badge tone="info">{sourceLabel[latest.source]}</Badge>
              <span className="text-[10px] text-white/40">
                {new Date(latest.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {latest.label}
            </p>
            {latest.detail && (
              <p className="mt-1 text-xs text-white/60">{latest.detail}</p>
            )}
            {latest.imagePreview && (
              <img
                src={latest.imagePreview}
                alt="Perception frame"
                className="mt-3 w-full max-h-32 rounded-lg object-cover ring-1 ring-white/10"
              />
            )}
          </div>
        )}

        {signals.length > 1 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Recent signals
            </p>
            <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
              {signals.slice(1, 12).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] px-2.5 py-1.5 text-xs"
                >
                  <span className="truncate text-white/80">{s.label}</span>
                  <span className="shrink-0 text-[10px] text-white/40">
                    {sourceLabel[s.source]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}
