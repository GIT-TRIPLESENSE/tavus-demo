import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  subtitle?: ReactNode
  accent?: 'fuchsia' | 'cyan' | 'emerald' | 'amber' | 'none'
  tone?: 'default' | 'muted'
}

const accentRing: Record<NonNullable<CardProps['accent']>, string> = {
  fuchsia: 'before:from-fuchsia-500/30',
  cyan: 'before:from-cyan-400/30',
  emerald: 'before:from-emerald-400/30',
  amber: 'before:from-amber-400/30',
  none: 'before:from-transparent',
}

export function Card({
  title,
  subtitle,
  accent = 'none',
  tone = 'default',
  className = '',
  children,
  ...rest
}: CardProps) {
  const base =
    tone === 'muted'
      ? 'bg-white/[0.02] border-white/5'
      : 'bg-white/[0.03] border-white/10'
  return (
    <div
      {...rest}
      className={[
        'relative rounded-2xl border backdrop-blur-sm overflow-hidden',
        base,
        'before:content-[""] before:absolute before:inset-0 before:rounded-2xl before:pointer-events-none',
        'before:bg-gradient-to-br before:to-transparent',
        accentRing[accent],
        className,
      ].join(' ')}
    >
      {(title || subtitle) && (
        <div className="relative px-5 pt-4 pb-3 border-b border-white/5 flex items-baseline justify-between gap-3">
          <div>
            {title && (
              <h3 className="text-sm font-semibold tracking-tight text-white/90">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      )}
      <div className="relative">{children}</div>
    </div>
  )
}
