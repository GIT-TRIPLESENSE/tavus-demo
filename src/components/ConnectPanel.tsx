import { useState, type FormEvent } from 'react'
import { Badge } from './ui/Badge'

export interface ConnectFormValues {
  apiKey: string
  replicaId: string
  personaId: string
  customGreeting: string
  conversationalContext: string
}

interface ConnectPanelProps {
  initialValues: ConnectFormValues
  busy: boolean
  error: string | null
  onSubmit: (values: ConnectFormValues) => void
}

export function ConnectPanel({
  initialValues,
  busy,
  error,
  onSubmit,
}: ConnectPanelProps) {
  const [values, setValues] = useState<ConnectFormValues>(initialValues)

  const canSubmit =
    values.apiKey.trim().length > 0 && values.replicaId.trim().length > 0 && !busy

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit(values)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_50%_-100px,rgba(217,70,239,0.15),transparent),radial-gradient(900px_500px_at_80%_110%,rgba(34,211,238,0.12),transparent)] bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-stretch justify-center px-6 py-16">
        <div className="mb-8 flex items-center gap-3">
          <Badge tone="info" dot>
            Tavus CVI · Raven
          </Badge>
          <span className="text-xs text-white/40">
            Live avatar webinar demo
          </span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Emotionally intelligent
          <br />
          <span className="bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-300 bg-clip-text text-transparent">
            avatar stage
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
          Start a real Tavus Conversational Video Interface session, powered by
          the Raven perception model. The avatar streams live over WebRTC while
          telemetry panels surface emotions, latency, transcription and the
          underlying pipeline.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-10 space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur"
        >
          <Field
            label="Tavus API key"
            hint="Injected from VITE_TAVUS_API_KEY. Stays in your browser session."
            required
          >
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={values.apiKey}
              onChange={(e) =>
                setValues((v) => ({ ...v, apiKey: e.target.value }))
              }
              placeholder="tvs-…"
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-fuchsia-400/60 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Replica ID"
              hint="Phoenix-4 Pro stock replica recommended."
              required
            >
              <input
                type="text"
                value={values.replicaId}
                onChange={(e) =>
                  setValues((v) => ({ ...v, replicaId: e.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-fuchsia-400/60 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
              />
            </Field>

            <Field
              label="Persona ID"
              hint="Use a Raven-1 persona to populate emotion panels."
            >
              <input
                type="text"
                value={values.personaId}
                onChange={(e) =>
                  setValues((v) => ({ ...v, personaId: e.target.value }))
                }
                className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-fuchsia-400/60 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
              />
            </Field>
          </div>

          <Field
            label="Custom greeting"
            hint="First line the avatar will speak when the user joins."
          >
            <input
              type="text"
              value={values.customGreeting}
              onChange={(e) =>
                setValues((v) => ({ ...v, customGreeting: e.target.value }))
              }
              className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-fuchsia-400/60 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
            />
          </Field>

          <Field
            label="Conversation context"
            hint="Extra context the LLM receives for this session."
          >
            <textarea
              rows={3}
              value={values.conversationalContext}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  conversationalContext: e.target.value,
                }))
              }
              className="w-full resize-none rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white focus:border-fuchsia-400/60 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/20"
            />
          </Field>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-[11px] text-white/40">
              Calls hit{' '}
              <code className="rounded bg-white/5 px-1.5 py-0.5 text-[10px]">
                POST /v2/conversations
              </code>{' '}
              then join the returned Daily room.
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_6px_24px_-8px_rgba(217,70,239,0.6)] transition enabled:hover:shadow-[0_10px_30px_-6px_rgba(217,70,239,0.7)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Starting…' : 'Start live demo'}
              <span
                aria-hidden
                className="transition group-enabled:group-hover:translate-x-0.5"
              >
                →
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium tracking-wide text-white/70 uppercase">
          {label}
          {required && <span className="text-fuchsia-300"> *</span>}
        </span>
        {hint && <span className="text-[11px] text-white/40">{hint}</span>}
      </span>
      {children}
    </label>
  )
}
