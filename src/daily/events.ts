import type {
  CviAppMessage,
  PerceptionToolCallProperties,
  UtteranceProperties,
} from '../types/cvi'

export type NormalizedCviEvent =
  | {
      kind: 'utterance'
      conversationId?: string
      seq?: number
      turnIdx?: number
      role: 'user' | 'replica' | 'system'
      text: string
      audioAnalysis?: UtteranceProperties['user_audio_analysis']
      visualAnalysis?: UtteranceProperties['user_visual_analysis']
      raw: CviAppMessage
    }
  | {
      kind: 'utterance-streaming'
      conversationId?: string
      seq?: number
      turnIdx?: number
      role: 'user' | 'replica' | 'system'
      text: string
      raw: CviAppMessage
    }
  | {
      kind: 'perception-tool-call'
      conversationId?: string
      seq?: number
      turnIdx?: number
      properties: PerceptionToolCallProperties
      raw: CviAppMessage
    }
  | {
      kind: 'user-started-speaking'
      timestamp: number
      turnIdx?: number
      raw: CviAppMessage
    }
  | {
      kind: 'user-stopped-speaking'
      timestamp: number
      turnIdx?: number
      raw: CviAppMessage
    }
  | {
      kind: 'replica-started-speaking'
      timestamp: number
      turnIdx?: number
      raw: CviAppMessage
    }
  | {
      kind: 'replica-stopped-speaking'
      timestamp: number
      turnIdx?: number
      raw: CviAppMessage
    }
  | {
      kind: 'perception-analysis'
      properties: Record<string, unknown>
      raw: CviAppMessage
    }
  | {
      kind: 'tool-call'
      properties: Record<string, unknown>
      raw: CviAppMessage
    }
  | {
      kind: 'unknown'
      eventType?: string
      raw: CviAppMessage
    }

/**
 * CVI app-messages can arrive in a few shapes across different SDK versions:
 * - Flat: `{ event_type, properties, conversation_id, ... }`
 * - Wrapped: `{ eventType, data: { event_type, properties, ... } }`
 * This helper normalizes both.
 */
function unwrap(msg: CviAppMessage) {
  const eventType =
    msg.event_type ?? msg.eventType ?? msg.data?.event_type ?? undefined
  const properties =
    (msg.properties as Record<string, unknown> | undefined) ??
    msg.data?.properties ??
    {}
  const conversationId =
    msg.conversation_id ?? msg.data?.conversation_id ?? undefined
  const seq = msg.seq ?? msg.data?.seq
  const turnIdx = msg.turn_idx ?? msg.data?.turn_idx
  return { eventType, properties, conversationId, seq, turnIdx }
}

export function parseCviAppMessage(
  raw: unknown,
): NormalizedCviEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const msg = raw as CviAppMessage
  const { eventType, properties, conversationId, seq, turnIdx } = unwrap(msg)
  if (!eventType) return null

  switch (eventType) {
    case 'conversation.utterance': {
      const p = properties as UtteranceProperties
      return {
        kind: 'utterance',
        conversationId,
        seq,
        turnIdx,
        role: (p.role as 'user' | 'replica' | 'system') ?? 'system',
        text: (p.speech as string) ?? '',
        audioAnalysis: p.user_audio_analysis,
        visualAnalysis: p.user_visual_analysis,
        raw: msg,
      }
    }
    case 'conversation.utterance.streaming': {
      const p = properties as UtteranceProperties
      return {
        kind: 'utterance-streaming',
        conversationId,
        seq,
        turnIdx,
        role: (p.role as 'user' | 'replica' | 'system') ?? 'replica',
        text: (p.speech as string) ?? '',
        raw: msg,
      }
    }
    case 'conversation.perception_tool_call': {
      return {
        kind: 'perception-tool-call',
        conversationId,
        seq,
        turnIdx,
        properties: properties as PerceptionToolCallProperties,
        raw: msg,
      }
    }
    case 'conversation.perception_analysis': {
      return {
        kind: 'perception-analysis',
        properties,
        raw: msg,
      }
    }
    case 'conversation.user.started_speaking':
      return { kind: 'user-started-speaking', timestamp: Date.now(), turnIdx, raw: msg }
    case 'conversation.user.stopped_speaking':
      return { kind: 'user-stopped-speaking', timestamp: Date.now(), turnIdx, raw: msg }
    case 'conversation.replica.started_speaking':
      return { kind: 'replica-started-speaking', timestamp: Date.now(), turnIdx, raw: msg }
    case 'conversation.replica.stopped_speaking':
      return { kind: 'replica-stopped-speaking', timestamp: Date.now(), turnIdx, raw: msg }
    case 'conversation.tool_call':
      return { kind: 'tool-call', properties, raw: msg }
    default:
      return { kind: 'unknown', eventType, raw: msg }
  }
}
