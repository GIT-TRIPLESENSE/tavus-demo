import { useEffect, useRef } from 'react'
import { Badge } from './ui/Badge'

interface AvatarStageProps {
  videoTrack: MediaStreamTrack | null
  audioTrack: MediaStreamTrack | null
  /** Local webcam track for the picture-in-picture self-view. */
  localVideoTrack: MediaStreamTrack | null
  connectionLabel: string
  connectionTone: 'live' | 'info' | 'warn' | 'neutral'
  durationLabel: string
  isUserSpeaking: boolean
  isReplicaSpeaking: boolean
}

export function AvatarStage({
  videoTrack,
  audioTrack,
  localVideoTrack,
  connectionLabel,
  connectionTone,
  durationLabel,
  isUserSpeaking,
  isReplicaSpeaking,
}: AvatarStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (videoTrack) {
      const stream = new MediaStream([videoTrack])
      el.srcObject = stream
      el.play().catch(() => {})
    } else {
      el.srcObject = null
    }
  }, [videoTrack])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (audioTrack) {
      const stream = new MediaStream([audioTrack])
      el.srcObject = stream
      el.play().catch(() => {})
    } else {
      el.srcObject = null
    }
  }, [audioTrack])

  useEffect(() => {
    const el = localVideoRef.current
    if (!el) return
    if (localVideoTrack) {
      const stream = new MediaStream([localVideoTrack])
      el.srcObject = stream
      el.play().catch(() => {})
    } else {
      el.srcObject = null
    }
  }, [localVideoTrack])

  const ringColor = isReplicaSpeaking
    ? 'ring-fuchsia-400/60 shadow-[0_0_60px_-10px_rgba(217,70,239,0.7)]'
    : isUserSpeaking
      ? 'ring-cyan-300/60 shadow-[0_0_60px_-10px_rgba(34,211,238,0.7)]'
      : 'ring-white/10'

  return (
    <div className="relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 pt-14">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Badge tone={connectionTone} dot>
            {connectionLabel}
          </Badge>
          {isReplicaSpeaking && (
            <Badge tone="info">Replica speaking</Badge>
          )}
          {isUserSpeaking && (
            <Badge tone="info">User speaking</Badge>
          )}
        </div>
        <Badge tone="neutral">{durationLabel}</Badge>
      </div>

      <div
        className={[
          'relative mx-auto mt-2 aspect-video w-[94%] max-w-[1280px] overflow-hidden rounded-xl bg-black ring-2 transition-all duration-300',
          ringColor,
        ].join(' ')}
      >
        {videoTrack ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/40">
            <div className="h-12 w-12 animate-pulse rounded-full bg-gradient-to-br from-fuchsia-500/40 to-cyan-400/40" />
            <p className="text-sm">Waiting for avatar video stream…</p>
          </div>
        )}
        {/* Hidden <audio> so remote audio is played even if <video> is muted */}
        <audio ref={audioRef} autoPlay playsInline className="hidden" />

        <SelfView
          ref={localVideoRef}
          active={Boolean(localVideoTrack)}
          highlight={isUserSpeaking}
        />
      </div>
    </div>
  )
}

interface SelfViewProps {
  active: boolean
  highlight: boolean
  ref: React.RefObject<HTMLVideoElement | null>
}

function SelfView({ ref, active, highlight }: SelfViewProps) {
  return (
    <div
      className={[
        'absolute bottom-3 right-3 z-10 aspect-video w-40 overflow-hidden rounded-lg border bg-black/80 shadow-lg ring-1 transition-all duration-300 sm:w-48 md:w-56',
        highlight
          ? 'border-cyan-300/60 ring-cyan-300/40 shadow-[0_0_32px_-8px_rgba(34,211,238,0.6)]'
          : 'border-white/15 ring-black/20',
      ].join(' ')}
    >
      {active ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className="h-full w-full -scale-x-100 object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-white/40">
          Webcam off
        </div>
      )}
      <div className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/80">
        You
      </div>
    </div>
  )
}
