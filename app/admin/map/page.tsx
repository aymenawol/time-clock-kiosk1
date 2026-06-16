import { createSupabaseServerClient } from '@/lib/supabase-server'

export default async function MapPage() {
  const supabase = await createSupabaseServerClient()

  // Load all active shifts with their assigned bus and latest position
  const { data: activeShifts } = await supabase
    .from('shifts')
    .select(`
      id,
      bus_id,
      employee_id,
      buses!inner(id, bus_number, bus_type),
      employees!inner(id, name)
    `)
    .eq('status', 'active')

  // Batch-load latest position per bus
  const busIds = (activeShifts ?? []).map(s => (s as Record<string, unknown>).bus_id as string).filter(Boolean)

  let latestPositions: Record<string, unknown>[] = []
  if (busIds.length > 0) {
    const { data: positions } = await supabase
      .from('latest_bus_positions')
      .select('*')
      .in('bus_id', busIds)
    latestPositions = positions ?? []
  }

  const posMap = Object.fromEntries(latestPositions.map(p => [(p as Record<string, unknown>).bus_id as string, p]))

  const initialBuses = (activeShifts ?? []).map((s: Record<string, unknown>) => {
    const bus = s.buses as Record<string, unknown>
    const emp = s.employees as Record<string, unknown>
    return {
      bus_id: (bus as Record<string, unknown>).id as string,
      bus_number: (bus as Record<string, unknown>).bus_number as string,
      bus_type: (bus as Record<string, unknown>).bus_type as string,
      driver_name: ((emp as Record<string, unknown>).name as string) ?? 'Unknown',
      shift_id: s.id as string,
      position: posMap[(bus as Record<string, unknown>).id as string] ?? null,
    }
  })

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null

  const { default: MapClient } = await import('./map-client')

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="px-6 py-3 border-b border-border bg-background flex items-center gap-4">
        <h1 className="text-foreground font-bold text-lg">Live GPS Map</h1>
        <span className="text-muted-foreground text-sm">Harry Reid International Airport</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <MapClient initialBuses={initialBuses as unknown as Parameters<typeof MapClient>[0]['initialBuses']} apiKey={apiKey} />
      </div>
    </div>
  )
}
