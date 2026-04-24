import type { LatencySample } from '../../types/cvi'
import { Card } from '../ui/Card'
import { average, formatLatency, percentile } from '../../utils/format'

interface LatencyPanelProps {
  samples: LatencySample[]
}

export function LatencyPanel({ samples }: LatencyPanelProps) {
  const values = samples.map((s) => s.latencyMs)
  const last = values.at(-1)
  const avg = average(values)
  const p95 = percentile(values, 95)
  const best = values.length > 0 ? Math.min(...values) : 0

  // sparkline path
  const width = 260
  const height = 60
  const max = Math.max(1200, ...values, 1)
  const min = 0
  const points = values.map((v, i) => {
    const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width
    const y = height - ((v - min) / (max - min)) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const path =
    points.length > 0 ? `M ${points.join(' L ')}` : ''

  return (
    <Card
      title="Turn-around latency"
      subtitle="Δ user stop → replica start"
      accent="emerald"
    >
      <div className="px-5 py-4">
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Last" value={last !== undefined ? formatLatency(last) : '—'} highlight />
          <Stat label="Avg" value={values.length ? formatLatency(avg) : '—'} />
          <Stat label="p95" value={values.length ? formatLatency(p95) : '—'} />
          <Stat label="Best" value={values.length ? formatLatency(best) : '—'} />
        </div>

        <div className="mt-4 rounded-lg border border-white/5 bg-slate-950/40 p-3">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="lat" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
              </linearGradient>
            </defs>
            {path && (
              <>
                <path
                  d={`${path} L ${width},${height} L 0,${height} Z`}
                  fill="url(#lat)"
                />
                <path
                  d={path}
                  fill="none"
                  stroke="#6ee7b7"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}
            {points.length === 0 && (
              <text
                x={width / 2}
                y={height / 2}
                fill="rgba(255,255,255,0.25)"
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                waiting for first turn…
              </text>
            )}
          </svg>
          <p className="mt-1 text-[10px] text-white/30">
            {values.length} sample{values.length === 1 ? '' : 's'} · rolling
            window of last 30 turns
          </p>
        </div>
      </div>
    </Card>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={[
        'rounded-lg border px-2.5 py-2',
        highlight
          ? 'border-emerald-400/30 bg-emerald-500/5'
          : 'border-white/5 bg-white/[0.02]',
      ].join(' ')}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
        {value}
      </p>
    </div>
  )
}
