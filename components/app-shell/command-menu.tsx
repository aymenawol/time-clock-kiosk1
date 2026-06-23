'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import type { NavGroup } from '@/lib/navigation'

export function CommandMenu({
  groups,
  open,
  onOpenChange,
}: {
  groups: NavGroup[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  // Global ⌘K / Ctrl+K toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  function go(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.label} heading={group.label}>
            {group.items.map((item) => {
              const Icon = item.icon
              return (
                <CommandItem
                  key={item.href + item.label}
                  value={`${item.label} ${item.keywords ?? ''} ${item.description ?? ''}`}
                  onSelect={() => go(item.href)}
                >
                  <Icon />
                  <span className="flex-1">{item.label}</span>
                  {item.description && (
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                      {item.description}
                    </span>
                  )}
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
