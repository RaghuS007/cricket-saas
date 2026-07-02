import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  iconClassName?: string
  showWordmark?: boolean
}

export function Logo({ className, iconClassName, showWordmark = true }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        viewBox="0 0 32 32"
        className={cn('h-7 w-7 shrink-0', iconClassName)}
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="15" fill="var(--primary)" />
        <path
          d="M16 3.5c2.1 3.6 3.2 7.9 3.2 12.5S18.1 24.9 16 28.5"
          stroke="var(--primary-foreground)"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        <path
          d="M8.5 10.5c2.3 1.7 5 2.7 7.5 2.7s5.2-1 7.5-2.7M8.5 21.5c2.3-1.7 5-2.7 7.5-2.7s5.2 1 7.5 2.7"
          stroke="var(--primary-foreground)"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        <circle cx="16" cy="16" r="3.4" fill="var(--gold)" />
      </svg>
      {showWordmark && (
        <span className="text-base font-bold tracking-tight">
          Cricket<span className="text-primary">SaaS</span>
        </span>
      )}
    </span>
  )
}
