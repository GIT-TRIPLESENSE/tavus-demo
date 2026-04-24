import type {
  TavusCreateConversationRequest,
  TavusCreateConversationResponse,
} from '../types/cvi'

/**
 * In dev mode we hit the Vite proxy (`/tavus`) to avoid CORS.
 * In production builds we hit the public Tavus API directly. If CORS
 * is an issue in production, route this through your own backend.
 */
const API_BASE = import.meta.env.DEV ? '/tavus' : 'https://tavusapi.com'

interface CallOptions {
  apiKey: string
  signal?: AbortSignal
}

async function request<T>(
  path: string,
  { apiKey, signal }: CallOptions,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `Tavus API ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`,
    )
  }

  return (await response.json()) as T
}

export function createConversation(
  body: TavusCreateConversationRequest,
  opts: CallOptions,
): Promise<TavusCreateConversationResponse> {
  return request<TavusCreateConversationResponse>('/v2/conversations', opts, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function endConversation(
  conversationId: string,
  opts: CallOptions,
): Promise<void> {
  await request<unknown>(
    `/v2/conversations/${conversationId}/end`,
    opts,
    { method: 'POST' },
  )
}
