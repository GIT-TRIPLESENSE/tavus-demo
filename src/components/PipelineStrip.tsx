import type { ReactNode } from 'react'

interface PipelineStripProps {
  isUserSpeaking: boolean
  isReplicaSpeaking: boolean
  hasVideo: boolean
  personaId?: string
  replicaId?: string
}

interface Stage {
  key: string
  label: string
  model: string
  active: boolean
  icon: ReactNode
}

/**
 * Compact horizontal CVI pipeline indicator, designed to sit directly under
 * the avatar stage. Replaces the larger Card-based PipelinePanel.
 */
export function PipelineStrip({
  isUserSpeaking,
  isReplicaSpeaking,
  hasVideo,
  personaId,
  replicaId,
}: PipelineStripProps) {
  const stages: Stage[] = [
    {
      key: 'perception',
      label: 'Perception',
      model: 'Raven-1',
      active: hasVideo,
      icon: <Eye />,
    },
    {
      key: 'stt',
      label: 'STT',
      model: 'Tavus STT',
      active: isUserSpeaking,
      icon: <Waveform />,
    },
    {
      key: 'turn',
      label: 'Turn-taking',
      model: 'Sparrow-1',
      active: !isReplicaSpeaking && !isUserSpeaking && hasVideo,
      icon: <Clock />,
    },
    {
      key: 'llm',
      label: 'Reasoning',
      model: 'LLM',
      active: isReplicaSpeaking,
      icon: <Spark />,
    },
    {
      key: 'tts',
      label: 'Speech + face',
      model: 'Phoenix-4',
      active: isReplicaSpeaking,
      icon: <Smile />,
    },
  ]

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-1 overflow-x-auto">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-1">
            <StagePill stage={stage} />
            {i < stages.length - 1 && (
              <span
                className={[
                  'h-px w-3 shrink-0 transition',
                  stage.active || stages[i + 1].active
                    ? 'bg-fuchsia-400/40'
                    : 'bg-white/10',
                ].join(' ')}
              />
            )}
          </div>
        ))}
        <div className="ml-auto hidden shrink-0 gap-3 pl-3 text-[10px] text-white/40 lg:flex">
          <Meta label="Persona" value={personaId} />
          <Meta label="Replica" value={replicaId} />
        </div>
      </div>
    </div>
  )
}

function StagePill({ stage }: { stage: Stage }) {
  return (
    <div
      title={`${stage.label} · ${stage.model}`}
      className={[
        'flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-all duration-200',
        stage.active
          ? 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-100 shadow-[0_0_18px_-4px_rgba(217,70,239,0.55)]'
          : 'border-white/10 bg-white/[0.02] text-white/55',
      ].join(' ')}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        {stage.icon}
        {stage.active && (
          <span className="absolute inset-[-2px] animate-ping rounded-md ring-1 ring-fuchsia-400/40" />
        )}
      </span>
      <span className="font-medium tracking-tight">{stage.label}</span>
    </div>
  )
}

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="uppercase tracking-wider text-white/30">{label}</span>
      <code className="text-white/70">{value}</code>
    </div>
  )
}

// Tiny inline SVG icons (12x12)
function Eye() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function Waveform() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 12h-2" />
    </svg>
  )
}
function Clock() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
function Spark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
    </svg>
  )
}
function Smile() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
  )
}
