/**
 * Drives the off-thread LLM sentiment scorer.
 *
 * - Owns a single Web Worker for the lifetime of the component.
 * - For each new transcript entry with a Raven `visualAnalysis`, it queues a
 *   scoring job. While the job is in flight, `pendingJobId` exposes the
 *   utterance id so the panel can show a loading state.
 * - When a newer utterance arrives before the previous job finished, the old
 *   job is cancelled (the worker aborts its fetch) so stale results never
 *   overwrite fresher ones.
 * - The keyword scorer remains the instant fallback and is computed in the
 *   panel itself; this hook only surfaces LLM-derived scores when present.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { TranscriptEntry } from '../types/cvi'
import {
  parseAudioAnalysis,
  parseVisualAnalysis,
  type SentimentScores,
} from '../utils/sentiment'
import type {
  SentimentJobError,
  SentimentJobRequest,
  SentimentJobResponse,
} from '../workers/sentimentWorker'

export interface SentimentLLMResult {
  scores: SentimentScores
  rationale: string
  durationMs: number
}

export interface UseSentimentLLMOptions {
  apiKey?: string
  model?: string
}

export interface UseSentimentLLMReturn {
  /** LLM-derived score for the latest user utterance, if available. */
  latest: SentimentLLMResult | null
  /** True while a scoring request is in flight for the latest utterance. */
  pending: boolean
  /** Last error message from the worker, cleared on the next success. */
  error: string | null
  /** Whether the LLM scorer is wired up at all (api key present). */
  enabled: boolean
}

export function useSentimentLLM(
  entries: TranscriptEntry[],
  { apiKey, model }: UseSentimentLLMOptions = {},
): UseSentimentLLMReturn {
  const enabled = Boolean(apiKey)
  const workerRef = useRef<Worker | null>(null)
  // Map from utterance id → result, so we can show prior scores while a new
  // job is pending and never replay scores for re-rendered entries.
  const cacheRef = useRef<Map<string, SentimentLLMResult>>(new Map())
  const [latest, setLatest] = useState<SentimentLLMResult | null>(null)
  const [pendingJobId, setPendingJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Find the most recent user entry that carries Raven analysis.
  const target = useMemo(() => findLatestAnalysisEntry(entries), [entries])

  // Lazy-instantiate the worker only if the LLM scorer is enabled.
  useEffect(() => {
    if (!enabled) return
    const worker = new Worker(
      new URL('../workers/sentimentWorker.ts', import.meta.url),
      { type: 'module' },
    )
    workerRef.current = worker

    const onMessage = (evt: MessageEvent<SentimentJobResponse | SentimentJobError>) => {
      const msg = evt.data
      if (msg.type === 'result') {
        const result: SentimentLLMResult = {
          scores: msg.scores,
          rationale: msg.rationale,
          durationMs: msg.durationMs,
        }
        cacheRef.current.set(msg.jobId, result)
        setLatest(result)
        setError(null)
        setPendingJobId((current) => (current === msg.jobId ? null : current))
      } else if (msg.type === 'error') {
        setError(msg.message)
        setPendingJobId((current) => (current === msg.jobId ? null : current))
      }
    }
    worker.addEventListener('message', onMessage)
    return () => {
      worker.removeEventListener('message', onMessage)
      worker.terminate()
      workerRef.current = null
    }
  }, [enabled])

  // Dispatch a job whenever the target utterance changes.
  const lastDispatchedId = useRef<string | null>(null)
  useEffect(() => {
    if (!enabled) return
    if (!target) return
    if (lastDispatchedId.current === target.id) return
    lastDispatchedId.current = target.id

    // Cancel any previous pending job — its result would be stale.
    setPendingJobId((prev) => {
      if (prev && workerRef.current) {
        workerRef.current.postMessage({ type: 'cancel', jobId: prev })
      }
      return target.id
    })

    // If we already scored this utterance previously, surface the cached
    // result without sending a new request.
    const cached = cacheRef.current.get(target.id)
    if (cached) {
      setLatest(cached)
      setPendingJobId(null)
      return
    }

    const visual = parseVisualAnalysis(target.visualAnalysis)
    const audio = parseAudioAnalysis(target.audioAnalysis)
    const job: SentimentJobRequest = {
      type: 'score',
      jobId: target.id,
      emotions: visual.emotions ?? visual.raw,
      appearance: visual.appearance,
      audio: audio.tags.length > 0 ? audio.tags.join(', ') : audio.text || undefined,
      apiKey: apiKey!,
      model,
    }
    workerRef.current?.postMessage(job)
  }, [enabled, target, apiKey, model])

  return {
    latest,
    pending: pendingJobId !== null,
    error,
    enabled,
  }
}

function findLatestAnalysisEntry(
  entries: TranscriptEntry[],
): TranscriptEntry | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]
    if (e.role !== 'user') continue
    if (e.visualAnalysis || e.audioAnalysis) return e
  }
  return null
}
