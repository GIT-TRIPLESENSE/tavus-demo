import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  tone?: 'neutral' | 'live' | 'info' | 'warn'
  dot?: boolean
  className?: string
}

const toneClass: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-white/5 text-white/70 ring-white/10',
  live: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  info: 'bg-cyan-500/15 text-cyan-200 ring-cyan-400/30',
  warn: 'bg-amber-500/15 text-amber-200 ring-amber-400/30',
}

const dotClass: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-white/40',
  live: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]',
  info: 'bg-cyan-300',
  warn: 'bg-amber-300',
}

export function Badge({
  children,
  tone = 'neutral',
  dot,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide ring-1',
        toneClass[tone],
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          className={[
            'h-1.5 w-1.5 rounded-full',
            dotClass[tone],
            tone === 'live' ? 'animate-pulse' : '',
          ].join(' ')}
        />
      )}
      {children}
    </span>
  )
}
