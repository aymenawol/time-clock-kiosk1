'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // Base: layout, focus ring, disabled, icon sizing. Pointer cursor comes from globals.
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,border-color,box-shadow,transform] active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border',
        outline:
          'border border-border bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        success:
          'bg-ok text-brand-fg shadow-sm hover:bg-ok/90',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-10 px-4',
        lg: 'h-11 px-6 text-base',
        xl: 'h-14 px-8 text-lg rounded-xl', // big touch targets for tablets/kiosk
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
