import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Variants map to the OKLCH operational ramps (ok/warn/danger/hazard/info/neutral)
// so a single <Badge variant="warn"> reads correctly in both light and dark.
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-none transition-colors whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        ok: 'border-ok-border bg-ok-surface text-ok',
        warn: 'border-warn-border bg-warn-surface text-warn',
        danger: 'border-danger-border bg-danger-surface text-danger',
        hazard: 'border-hazard-border bg-hazard-surface text-hazard',
        info: 'border-info-border bg-info-surface text-info',
        neutral: 'border-neutral-border bg-neutral-surface text-neutral',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
