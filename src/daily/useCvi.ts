import Daily, {
  type DailyCall,
  type DailyEventObjectAppMessage,
  type DailyParticipant,
} from '@daily-co/daily-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseCviAppMessage, type NormalizedCviEvent } from './events'
import type {
  ConnectionState,
  EmotionSignal,
  LatencySample,
  TranscriptEntry,
} from '../types/cvi'
import {
  parseAudioAnalysis,
  parseVisualAnalysis,
} from '../utils/sentiment'

/** Return the first sentence-ish fragment (capped) for a compact label. */
function firstSentence(text: string | undefined): string | undefined {
  if (!text) return undefined
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const end = trimmed.search(/[.!?]\s|$/)
  const slice = end > 0 ? trimmed.slice(0, end) : trimmed
  return slice.length > 80 ? `${slice.slice(0, 77)}…` : slice
}

export interface UseCviOptions {
  onEvent?: (event: NormalizedCviEvent) => void
}

export interface CviConnectionInfo {
  conversationId: string
  conversationUrl: string
}

export interface UseCviReturn {
  state: ConnectionState
  error: string | null
  transcript: TranscriptEntry[]
  emotions: EmotionSignal[]
  latency: LatencySample[]
  latestEvent: NormalizedCviEvent | null
  remoteVideoTrack: MediaStreamTrack | null
  remoteAudioTrack: MediaStreamTrack | null
  localVideoTrack: MediaStreamTrack | null
  replicaParticipantId: string | null
  isUserSpeaking: boolean
  isReplicaSpeaking: boolean
  join: (info: CviConnectionInfo) => Promise<void>
  leave: () => Promise<void>
  reset: () => void
}

function readVideoTrack(p?: DailyParticipant | null): MediaStreamTrack | null {
  const persistentTrack = p?.tracks?.video?.persistentTrack as
    | MediaStreamTrack
    | undefined
  if (persistentTrack && persistentTrack.readyState === 'live') {
    return persistentTrack
  }
  const track = p?.tracks?.video?.track as MediaStreamTrack | undefined
  if (track && track.readyState === 'live') return track
  return null
}

function readAudioTrack(p?: DailyParticipant | null): MediaStreamTrack | null {
  const persistentTrack = p?.tracks?.audio?.persistentTrack as
    | MediaStreamTrack
    | undefined
  if (persistentTrack && persistentTrack.readyState === 'live') {
    return persistentTrack
  }
  const track = p?.tracks?.audio?.track as MediaStreamTrack | undefined
  if (track && track.readyState === 'live') return track
  return null
}

export function useCvi({ onEvent }: UseCviOptions = {}): UseCviReturn {
  const callRef = useRef<DailyCall | null>(null)
  const [state, setState] = useState<ConnectionState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [emotions, setEmotions] = useState<EmotionSignal[]>([])
  const [latency, setLatency] = useState<LatencySample[]>([])
  const [latestEvent, setLatestEvent] = useState<NormalizedCviEvent | null>(null)
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStreamTrack | null>(null)
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<MediaStreamTrack | null>(null)
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null)
  const [replicaParticipantId, setReplicaParticipantId] = useState<string | null>(null)
  const [isUserSpeaking, setUserSpeaking] = useState(false)
  const [isReplicaSpeaking, setReplicaSpeaking] = useState(false)

  const lastUserStoppedAt = useRef<number | null>(null)
  const latestTurnIdx = useRef<number>(-1)
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const pushEmotion = useCallback((signal: EmotionSignal) => {
    setEmotions((prev) => [signal, ...prev].slice(0, 50))
  }, [])

  const handleAppMessage = useCallback(
    (evt: DailyEventObjectAppMessage) => {
      const parsed = parseCviAppMessage(evt.data)
      if (!parsed) return
      setLatestEvent(parsed)
      onEventRef.current?.(parsed)

      switch (parsed.kind) {
        case 'utterance': {
          setTranscript((prev) => [
            ...prev,
            {
              id: `${parsed.turnIdx ?? prev.length}-${parsed.role}-${Date.now()}`,
              role: parsed.role,
              text: parsed.text,
              timestamp: Date.now(),
              audioAnalysis: parsed.audioAnalysis,
              visualAnalysis: parsed.visualAnalysis,
            },
          ])
          if (parsed.audioAnalysis) {
            const audio = parseAudioAnalysis(parsed.audioAnalysis)
            const label = audio.tags[0] ?? audio.text.slice(0, 40) ?? 'audio'
            pushEmotion({
              id: `${Date.now()}-audio`,
              timestamp: Date.now(),
              source: 'user_audio_analysis',
              modality: 'audio',
              label: label || 'audio',
              detail: audio.text && audio.text !== label ? audio.text : undefined,
            })
          }
          if (parsed.visualAnalysis) {
            const visual = parseVisualAnalysis(parsed.visualAnalysis)
            const label = firstSentence(visual.emotions) ?? 'visual'
            pushEmotion({
              id: `${Date.now()}-visual`,
              timestamp: Date.now(),
              source: 'user_visual_analysis',
              modality: 'vision',
              label,
              detail: visual.appearance,
            })
          }
          break
        }
        case 'perception-tool-call': {
          const args = parsed.properties.arguments
          let detail: string | undefined
          if (typeof args === 'string') {
            detail = args
          } else if (args && typeof args === 'object') {
            detail = Object.entries(args)
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(' · ')
          }
          const firstFrame = parsed.properties.frames?.[0]
          pushEmotion({
            id: `${Date.now()}-perception`,
            timestamp: Date.now(),
            source: 'perception_tool_call',
            modality: parsed.properties.modality,
            label: parsed.properties.name ?? 'perception tool',
            detail,
            imagePreview: firstFrame
              ? `data:${firstFrame.mime_type};base64,${firstFrame.data}`
              : undefined,
          })
          break
        }
        case 'user-started-speaking':
          setUserSpeaking(true)
          if (parsed.turnIdx !== undefined) latestTurnIdx.current = parsed.turnIdx
          break
        case 'user-stopped-speaking':
          setUserSpeaking(false)
          lastUserStoppedAt.current = parsed.timestamp
          if (parsed.turnIdx !== undefined) latestTurnIdx.current = parsed.turnIdx
          break
        case 'replica-started-speaking': {
          setReplicaSpeaking(true)
          const stoppedAt = lastUserStoppedAt.current
          if (stoppedAt && parsed.timestamp > stoppedAt) {
            const sample: LatencySample = {
              turnIdx: parsed.turnIdx ?? latestTurnIdx.current,
              userStoppedAt: stoppedAt,
              replicaStartedAt: parsed.timestamp,
              latencyMs: parsed.timestamp - stoppedAt,
            }
            setLatency((prev) => [...prev, sample].slice(-30))
            lastUserStoppedAt.current = null
          }
          break
        }
        case 'replica-stopped-speaking':
          setReplicaSpeaking(false)
          break
        default:
          break
      }
    },
    [pushEmotion],
  )

  const refreshRemoteTracks = useCallback((call: DailyCall) => {
    const participants = call.participants()
    const remote = Object.values(participants).find((p) => !p.local)
    const local = participants.local
    if (remote) {
      setReplicaParticipantId(remote.session_id)
      setRemoteVideoTrack(readVideoTrack(remote))
      setRemoteAudioTrack(readAudioTrack(remote))
    } else {
      setRemoteVideoTrack(null)
      setRemoteAudioTrack(null)
      setReplicaParticipantId(null)
    }
    setLocalVideoTrack(readVideoTrack(local))
  }, [])

  const attachListeners = useCallback(
    (call: DailyCall) => {
      const handleParticipantChange = () => refreshRemoteTracks(call)

      call.on('app-message', handleAppMessage)
      call.on('participant-joined', handleParticipantChange)
      call.on('participant-updated', handleParticipantChange)
      call.on('participant-left', handleParticipantChange)
      call.on('track-started', handleParticipantChange)
      call.on('track-stopped', handleParticipantChange)
      call.on('joined-meeting', () => {
        setState('live')
        refreshRemoteTracks(call)
      })
      call.on('left-meeting', () => {
        setState((s) => (s === 'ending' ? 'idle' : s))
      })
      call.on('error', (evt) => {
        setError(evt?.errorMsg ?? 'Daily call error')
        setState('error')
      })
    },
    [handleAppMessage, refreshRemoteTracks],
  )

  const join = useCallback(
    async ({ conversationUrl }: CviConnectionInfo) => {
      setError(null)
      setState('joining')
      // Daily does not allow multiple call-objects per page, so reuse if possible.
      let call = callRef.current
      if (!call) {
        call = Daily.createCallObject({
          audioSource: true,
          videoSource: true,
        })
        callRef.current = call
        attachListeners(call)
      }
      try {
        await call.join({
          url: conversationUrl,
          startAudioOff: false,
          startVideoOff: false,
        })
        setState('live')
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setState('error')
        throw e
      }
    },
    [attachListeners],
  )

  const leave = useCallback(async () => {
    const call = callRef.current
    if (!call) return
    setState('ending')
    try {
      await call.leave()
    } catch {
      // best-effort
    }
    try {
      await call.destroy()
    } catch {
      // best-effort
    }
    callRef.current = null
    setState('idle')
    setRemoteVideoTrack(null)
    setRemoteAudioTrack(null)
    setLocalVideoTrack(null)
    setReplicaParticipantId(null)
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setTranscript([])
    setEmotions([])
    setLatency([])
    setLatestEvent(null)
    setUserSpeaking(false)
    setReplicaSpeaking(false)
    lastUserStoppedAt.current = null
    latestTurnIdx.current = -1
  }, [])

  useEffect(() => {
    return () => {
      const call = callRef.current
      if (call) {
        call.leave().catch(() => {})
        call.destroy().catch(() => {})
        callRef.current = null
      }
    }
  }, [])

  return useMemo(
    () => ({
      state,
      error,
      transcript,
      emotions,
      latency,
      latestEvent,
      remoteVideoTrack,
      remoteAudioTrack,
      localVideoTrack,
      replicaParticipantId,
      isUserSpeaking,
      isReplicaSpeaking,
      join,
      leave,
      reset,
    }),
    [
      state,
      error,
      transcript,
      emotions,
      latency,
      latestEvent,
      remoteVideoTrack,
      remoteAudioTrack,
      localVideoTrack,
      replicaParticipantId,
      isUserSpeaking,
      isReplicaSpeaking,
      join,
      leave,
      reset,
    ],
  )
}
