import { useEffect, useMemo, useRef, useState } from 'react'
import { createConversation, endConversation } from '../api/tavus'
import type { TavusCreateConversationResponse } from '../types/cvi'
import { useCvi } from '../daily/useCvi'
import { ConnectPanel, type ConnectFormValues } from './ConnectPanel'
import { AvatarStage } from './AvatarStage'
import { TranscriptPanel } from './panels/TranscriptPanel'
import { SentimentPanel } from './panels/SentimentPanel'
import { LatencyPanel } from './panels/LatencyPanel'
import { PipelinePanel } from './panels/PipelinePanel'
import { Badge } from './ui/Badge'
import { formatDuration } from '../utils/format'

interface LiveDemoProps {
  onExit: () => void
}

export function LiveDemo({ onExit }: LiveDemoProps) {
  const defaults: ConnectFormValues = useMemo(
    () => ({
      apiKey: import.meta.env.VITE_TAVUS_API_KEY ?? '',
      replicaId:
        import.meta.env.VITE_TAVUS_REPLICA_ID ?? 'rf4e9d9790f0',
      personaId:
        import.meta.env.VITE_TAVUS_PERSONA_ID ?? 'pcb7a34da5fe',
      customGreeting: 'Ciao! Sono qui per raccontarti Tavus CVI e Raven.',
      conversationalContext:
        'Sei un presentatore durante un webinar dal vivo su avatar AI emotivamente intelligenti. Rispondi in modo conciso, amichevole e curioso.',
    }),
    [],
  )

  const [apiError, setApiError] = useState<string | null>(null)
  const [conversation, setConversation] =
    useState<TavusCreateConversationResponse | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const [persona, setPersona] = useState<string | undefined>(undefined)
  const [replica, setReplica] = useState<string | undefined>(undefined)
  const [creating, setCreating] = useState(false)
  const keyRef = useRef<string>('')

  const cvi = useCvi()

  useEffect(() => {
    if (!startedAt) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [startedAt])

  async function handleStart(values: ConnectFormValues) {
    setApiError(null)
    cvi.reset()
    setCreating(true)
    keyRef.current = values.apiKey
    setPersona(values.personaId || undefined)
    setReplica(values.replicaId || undefined)
    try {
      const conv = await createConversation(
        {
          replica_id: values.replicaId,
          persona_id: values.personaId || undefined,
          custom_greeting: values.customGreeting || undefined,
          conversational_context:
            values.conversationalContext || undefined,
          conversation_name: 'Tavus Webinar Demo',
        },
        { apiKey: values.apiKey },
      )
      setConversation(conv)
      await cvi.join({
        conversationId: conv.conversation_id,
        conversationUrl: conv.conversation_url,
      })
      setStartedAt(Date.now())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setApiError(msg)
    } finally {
      setCreating(false)
    }
  }

  async function handleEnd() {
    const conv = conversation
    const key = keyRef.current
    await cvi.leave()
    if (conv && key) {
      try {
        await endConversation(conv.conversation_id, { apiKey: key })
      } catch {
        // best-effort — the timer/usage cleanup will still kick in
      }
    }
    setConversation(null)
    setStartedAt(null)
  }

  if (!conversation && cvi.state === 'idle') {
    return (
      <div className="relative">
        <TopBackLink onClick={onExit} />
        <ConnectPanel
          initialValues={defaults}
          busy={creating}
          error={apiError}
          onSubmit={handleStart}
        />
      </div>
    )
  }

  const connectionLabel =
    cvi.state === 'live'
      ? 'LIVE'
      : cvi.state === 'joining' || creating
        ? 'Connecting'
        : cvi.state === 'ending'
          ? 'Ending'
          : cvi.state === 'error'
            ? 'Error'
            : 'Idle'

  const connectionTone =
    cvi.state === 'live'
      ? ('live' as const)
      : cvi.state === 'error'
        ? ('warn' as const)
        : ('info' as const)

  const duration = startedAt ? formatDuration(now - startedAt) : '0:00'

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_800px_at_10%_-200px,rgba(217,70,239,0.12),transparent),radial-gradient(900px_600px_at_90%_110%,rgba(34,211,238,0.08),transparent)] bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="text-xs text-white/40 transition hover:text-white/80"
          >
            ← back
          </button>
          <span className="h-4 w-px bg-white/10" />
          <h1 className="text-sm font-semibold tracking-tight">
            Tavus CVI · Raven live demo
          </h1>
          <Badge tone={connectionTone} dot>
            {connectionLabel}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {conversation && (
            <code className="hidden rounded bg-white/5 px-2 py-1 text-[10px] text-white/50 sm:inline-block">
              {conversation.conversation_id}
            </code>
          )}
          <button
            onClick={handleEnd}
            disabled={!conversation && cvi.state === 'idle'}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/[0.07] disabled:opacity-40"
          >
            End demo
          </button>
        </div>
      </header>

      {(apiError || cvi.error) && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-6 py-2 text-xs text-red-200">
          {apiError || cvi.error}
        </div>
      )}

      <main className="grid gap-4 p-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(340px,1fr)]">
        <section className="space-y-4">
          <AvatarStage
            videoTrack={cvi.remoteVideoTrack}
            audioTrack={cvi.remoteAudioTrack}
            localVideoTrack={cvi.localVideoTrack}
            connectionLabel={connectionLabel}
            connectionTone={connectionTone}
            durationLabel={duration}
            isUserSpeaking={cvi.isUserSpeaking}
            isReplicaSpeaking={cvi.isReplicaSpeaking}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <LatencyPanel samples={cvi.latency} />
            <PipelinePanel
              isUserSpeaking={cvi.isUserSpeaking}
              isReplicaSpeaking={cvi.isReplicaSpeaking}
              hasVideo={Boolean(cvi.remoteVideoTrack)}
              personaId={persona}
              replicaId={replica}
            />
          </div>
        </section>
        <aside className="space-y-4">
          <SentimentPanel
            entries={cvi.transcript}
            openaiApiKey={import.meta.env.VITE_OPENAI_API_KEY}
            openaiModel={import.meta.env.VITE_OPENAI_SENTIMENT_MODEL}
          />
          <TranscriptPanel entries={cvi.transcript} />
        </aside>
      </main>
    </div>
  )
}

function TopBackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed left-6 top-6 z-20 text-xs text-white/40 transition hover:text-white/80"
    >
      ← back to welcome
    </button>
  )
}
