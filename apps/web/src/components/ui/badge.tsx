import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "bg-secondary text-secondary-foreground",
        live: "bg-primary/15 text-primary dark:bg-primary/25",
        warning: "bg-gold/20 text-gold-foreground dark:bg-gold/25",
        muted: "bg-muted text-muted-foreground",
        destructive: "bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props}>
      {dot && (
        <span className="relative flex size-1.5">
          {variant === "live" && (
            <span className="animate-pulse-ring absolute inline-flex size-1.5 rounded-full bg-primary" />
          )}
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
