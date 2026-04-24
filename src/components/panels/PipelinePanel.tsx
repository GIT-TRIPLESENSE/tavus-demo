import type { ReactNode } from 'react'
import { Card } from '../ui/Card'

interface PipelinePanelProps {
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
  description: string
  icon: ReactNode
}

export function PipelinePanel({
  isUserSpeaking,
  isReplicaSpeaking,
  hasVideo,
  personaId,
  replicaId,
}: PipelinePanelProps) {
  const stages: Stage[] = [
    {
      key: 'perception',
      label: 'Perception',
      model: 'Raven-1',
      active: hasVideo,
      description: 'multimodal vision + audio understanding',
      icon: <Eye />,
    },
    {
      key: 'stt',
      label: 'Speech-to-text',
      model: 'Tavus STT',
      active: isUserSpeaking,
      description: 'streaming transcription of the user',
      icon: <Waveform />,
    },
    {
      key: 'turn',
      label: 'Turn-taking',
      model: 'Sparrow-1',
      active: !isReplicaSpeaking && !isUserSpeaking && hasVideo,
      description: 'decides when the replica should respond',
      icon: <Clock />,
    },
    {
      key: 'llm',
      label: 'Reasoning',
      model: 'LLM',
      active: isReplicaSpeaking,
      description: 'contextual response generation',
      icon: <Spark />,
    },
    {
      key: 'tts',
      label: 'Speech + face',
      model: 'Phoenix-4 + TTS',
      active: isReplicaSpeaking,
      description: 'emotive audio and lip-synced rendering',
      icon: <Smile />,
    },
  ]

  return (
    <Card
      title="CVI pipeline"
      subtitle="Layers reacting in real time"
      accent="cyan"
    >
      <div className="px-5 py-4">
        <ol className="space-y-2">
          {stages.map((stage, i) => (
            <StageRow
              key={stage.key}
              stage={stage}
              isFirst={i === 0}
              isLast={i === stages.length - 1}
            />
          ))}
        </ol>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/5 pt-3 text-[10px] text-white/40">
          <div>
            <span className="block uppercase tracking-wider">Persona</span>
            <code className="text-white/70">{personaId || '—'}</code>
          </div>
          <div>
            <span className="block uppercase tracking-wider">Replica</span>
            <code className="text-white/70">{replicaId || '—'}</code>
          </div>
        </div>
      </div>
    </Card>
  )
}

function StageRow({
  stage,
  isFirst,
  isLast,
}: {
  stage: Stage
  isFirst: boolean
  isLast: boolean
}) {
  return (
    <li className="relative flex items-start gap-3">
      <div className="flex flex-col items-center">
        <span
          className={[
            'relative flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition-all duration-200',
            stage.active
              ? 'bg-fuchsia-500/20 text-fuchsia-200 ring-fuchsia-400/50 shadow-[0_0_18px_-2px_rgba(217,70,239,0.6)]'
              : 'bg-white/[0.03] text-white/50 ring-white/10',
          ].join(' ')}
        >
          {stage.icon}
          {stage.active && (
            <span className="absolute inset-0 animate-ping rounded-lg ring-2 ring-fuchsia-400/40" />
          )}
        </span>
        {!isLast && (
          <span
            className={[
              'mt-1 w-px flex-1 min-h-4',
              stage.active ? 'bg-fuchsia-400/40' : 'bg-white/10',
            ].join(' ')}
          />
        )}
      </div>
      <div className={[isFirst ? '' : '', 'flex-1 pb-2'].join(' ')}>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-white">{stage.label}</span>
          <span className="text-[10px] text-white/40">{stage.model}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-white/50">
          {stage.description}
        </p>
      </div>
    </li>
  )
}

// Tiny inline SVG icons to avoid pulling a dependency.
function Eye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function Waveform() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 12h2M8 8v8M12 5v14M16 8v8M20 12h-2" />
    </svg>
  )
}
function Clock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
function Spark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v6M12 16v6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M16 12h6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
    </svg>
  )
}
function Smile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01M15 9h.01" />
    </svg>
  )
}
