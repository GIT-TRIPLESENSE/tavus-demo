import { useEffect, useRef } from 'react'
import { Badge } from './ui/Badge'

interface AvatarStageProps {
  videoTrack: MediaStreamTrack | null
  audioTrack: MediaStreamTrack | null
  connectionLabel: string
  connectionTone: 'live' | 'info' | 'warn' | 'neutral'
  durationLabel: string
  isUserSpeaking: boolean
  isReplicaSpeaking: boolean
}

export function AvatarStage({
  videoTrack,
  audioTrack,
  connectionLabel,
  connectionTone,
  durationLabel,
  isUserSpeaking,
  isReplicaSpeaking,
}: AvatarStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

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

  const ringColor = isReplicaSpeaking
    ? 'ring-fuchsia-400/60 shadow-[0_0_60px_-10px_rgba(217,70,239,0.7)]'
    : isUserSpeaking
      ? 'ring-cyan-300/60 shadow-[0_0_60px_-10px_rgba(34,211,238,0.7)]'
      : 'ring-white/10'

  return (
    <div className="relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
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
          'relative m-auto aspect-video w-[94%] max-w-[1280px] overflow-hidden rounded-xl bg-black ring-2 transition-all duration-300',
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
      </div>
    </div>
  )
}
