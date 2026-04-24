export type CviRole = 'user' | 'replica' | 'system'

export interface TavusCreateConversationRequest {
  replica_id: string
  persona_id?: string
  conversation_name?: string
  conversational_context?: string
  custom_greeting?: string
}

export interface TavusCreateConversationResponse {
  conversation_id: string
  conversation_name?: string
  conversation_url: string
  status: string
  callback_url?: string
  created_at: string
}

/**
 * Raven attaches its analysis as a free-form string (XML-like tags such as
 * `<user_appearance>` / `<user_emotions>`) or, in some SDK versions, as a
 * structured object. We accept both shapes and normalize them downstream.
 */
export type UserVisualAnalysis = string | Record<string, unknown>
export type UserAudioAnalysis = string | Record<string, unknown>

export interface UtteranceProperties {
  role?: CviRole
  speech?: string
  user_audio_analysis?: UserAudioAnalysis
  user_visual_analysis?: UserVisualAnalysis
  [key: string]: unknown
}

export interface PerceptionToolCallProperties {
  name?: string
  modality?: 'audio' | 'vision'
  arguments?: string | Record<string, unknown>
  frames?: Array<{ data: string; mime_type: string }>
  [key: string]: unknown
}

export interface CviAppMessage<
  P extends Record<string, unknown> = Record<string, unknown>,
> {
  message_type?: string
  event_type?: string
  /** Some events nest the event under `data.event_type` with the same shape. */
  eventType?: string
  data?: {
    event_type?: string
    message_type?: string
    conversation_id?: string
    seq?: number
    turn_idx?: number
    properties?: P
    [key: string]: unknown
  }
  conversation_id?: string
  inference_id?: string
  seq?: number
  turn_idx?: number
  properties?: P
  [key: string]: unknown
}

export type CviEventType =
  | 'conversation.utterance'
  | 'conversation.utterance.streaming'
  | 'conversation.perception_tool_call'
  | 'conversation.perception_analysis'
  | 'conversation.user.started_speaking'
  | 'conversation.user.stopped_speaking'
  | 'conversation.replica.started_speaking'
  | 'conversation.replica.stopped_speaking'
  | 'conversation.tool_call'
  | 'conversation.error'

export interface TranscriptEntry {
  id: string
  role: CviRole
  text: string
  timestamp: number
  audioAnalysis?: UserAudioAnalysis
  visualAnalysis?: UserVisualAnalysis
}

export interface EmotionSignal {
  id: string
  timestamp: number
  source: 'user_audio_analysis' | 'user_visual_analysis' | 'perception_tool_call'
  modality?: 'audio' | 'vision'
  label: string
  detail?: string
  /** Optional base64 preview when the signal came from a vision tool call. */
  imagePreview?: string
}

export interface LatencySample {
  turnIdx: number
  userStoppedAt: number
  replicaStartedAt: number
  /** Turn-around latency in milliseconds. */
  latencyMs: number
}

export type PipelineStage =
  | 'perception'
  | 'stt'
  | 'llm'
  | 'tts'
  | 'turn-taking'
  | 'render'

export type ConnectionState =
  | 'idle'
  | 'creating-conversation'
  | 'joining'
  | 'live'
  | 'ending'
  | 'error'
