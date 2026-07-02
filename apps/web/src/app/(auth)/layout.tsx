import { Logo } from '@/components/logo'

const FEATURES = [
  { label: 'Live bidding', detail: 'Real-time bids with animated purse tracking' },
  { label: 'IPL-style auctions', detail: 'Draft your squads lot by lot, just like the big leagues' },
  { label: 'Built for organisers', detail: 'Multi-team, multi-league, fully self-serve' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="bg-pitch-pattern pointer-events-none absolute inset-0" />
        <Logo className="relative text-primary-foreground" iconClassName="ring-2 ring-primary-foreground/20 rounded-full" />

        <div className="relative space-y-8">
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Run auctions that feel like game day.
          </h1>
          <ul className="space-y-5">
            {FEATURES.map((f) => (
              <li key={f.label} className="flex gap-3">
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-gold-foreground">
                  ✓
                </span>
                <div>
                  <p className="font-semibold">{f.label}</p>
                  <p className="text-sm text-primary-foreground/75">{f.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          IPL-style fantasy auction platform for league organisers
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background p-4">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  )
}
