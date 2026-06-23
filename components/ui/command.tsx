'use client'

import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground',
      className
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

function CommandDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[15%] z-50 w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          aria-label="Command menu"
        >
          <DialogPrimitive.Title className="sr-only">Search and navigate</DialogPrimitive.Title>
          <Command className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            {children}
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-2 border-b border-border px-3" cmdk-input-wrapper="">
    <Search className="size-4 shrink-0 text-muted-foreground" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'flex h-12 w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  </div>
))
CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn('max-h-[60vh] overflow-y-auto overflow-x-hidden scrollbar-thin p-1.5', className)}
    {...props}
  />
))
CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-8 text-center text-sm text-muted-foreground" {...props} />
))
CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group ref={ref} className={cn('overflow-hidden p-1 text-foreground', className)} {...props} />
))
CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground data-[selected=true]:[&_svg]:text-foreground',
      className
    )}
    {...props}
  />
))
CommandItem.displayName = CommandPrimitive.Item.displayName

export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem }
