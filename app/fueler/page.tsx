import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import Link from 'next/link'
import FuelerQueueClient from './fueler-queue-client'

export const dynamic = 'force-dynamic'

export default async function FuelerPage() {
  const { user } = await getServerUser()
  const supabase = await createSupabaseServerClient()
  const today = new Date().toISOString().slice(0, 10)

  // Get buses needing service (fueling, wash, or both)
  const { data: busesPending } = await supabase
    .from('buses')
    .select('id, bus_number, bus_type, status, fuel_level')
    .eq('is_active', true)
    .in('status', ['fuel', 'wash', 'fuel_wash', 'ready', 'charging'])
    .order('bus_number')

  // Today's safety meetings (v2 `safety_meetings`; legacy `safety_meeting_schedules` is the public-share table only)
  const { data: meetings } = await supabase
    .from('safety_meetings')
    .select('id, title, scheduled_date, scheduled_time, location')
    .eq('scheduled_date', today)
    .order('scheduled_time')
    .limit(5)

  const fuelingBuses = (busesPending ?? []).filter((b: any) => b.status === 'fuel')
  const washBuses    = (busesPending ?? []).filter((b: any) => b.status === 'wash')
  const bothBuses    = (busesPending ?? []).filter((b: any) => b.status === 'fuel_wash')
  const readyBuses   = (busesPending ?? []).filter((b: any) => ['ready', 'charging'].includes(b.status))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fueler / Washer Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/driver/forms" className="bg-card border border-border hover:border-gray-600 rounded-xl p-4 text-center block">
          <div className="text-2xl mb-1">📝</div>
          <div className="text-xs text-muted-foreground">Forms</div>
        </Link>
        <Link href="/driver/safety-meetings" className="bg-card border border-border hover:border-gray-600 rounded-xl p-4 text-center block">
          <div className="text-2xl mb-1">🛡️</div>
          <div className="text-xs text-muted-foreground">Safety Meetings</div>
        </Link>
        <Link href="/driver/lost-found" className="bg-card border border-border hover:border-gray-600 rounded-xl p-4 text-center block">
          <div className="text-2xl mb-1">🔎</div>
          <div className="text-xs text-muted-foreground">Lost & Found</div>
        </Link>
      </div>

      {/* Buses needing both fuel + wash */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/60 flex items-center justify-between">
          <h2 className="text-foreground font-semibold text-sm">Needs Fuel + Wash</h2>
          <span className="text-amber-400 text-xs">{bothBuses.length} bus{bothBuses.length !== 1 ? 'es' : ''}</span>
        </div>
        <FuelerQueueClient buses={bothBuses} emptyLabel="No buses queued for both services." />
      </section>

      {/* Buses needing fueling */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/60 flex items-center justify-between">
          <h2 className="text-foreground font-semibold text-sm">Needs Fueling</h2>
          <span className="text-yellow-400 text-xs">{fuelingBuses.length} bus{fuelingBuses.length !== 1 ? 'es' : ''}</span>
        </div>
        <FuelerQueueClient buses={fuelingBuses} emptyLabel="No buses queued for fueling." />
      </section>

      {/* Buses needing wash */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/60 flex items-center justify-between">
          <h2 className="text-foreground font-semibold text-sm">Needs Wash</h2>
          <span className="text-blue-400 text-xs">{washBuses.length} bus{washBuses.length !== 1 ? 'es' : ''}</span>
        </div>
        <FuelerQueueClient buses={washBuses} emptyLabel="No buses queued for washing." />
      </section>

      {/* Ready fleet overview */}
      <section className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/60">
          <h2 className="text-foreground font-semibold text-sm">Ready Fleet ({readyBuses.length})</h2>
        </div>
        {readyBuses.length === 0 ? (
          <p className="text-gray-600 text-sm px-4 py-3">No ready buses.</p>
        ) : (
          <div className="divide-y divide-border max-h-48 overflow-y-auto">
            {readyBuses.map((b: any) => (
              <div key={b.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="text-foreground">Bus #{b.bus_number}</span>
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">{b.bus_type}</span>
                  {b.fuel_level != null && (
                    <span className={`text-xs font-medium ${b.fuel_level >= 50 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {b.fuel_level.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Today's safety meetings */}
      {meetings && meetings.length > 0 && (
        <section className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/60">
            <h2 className="text-foreground font-semibold text-sm">Today's Safety Meetings</h2>
          </div>
          <div className="divide-y divide-border">
            {meetings.map((m: any) => (
              <div key={m.id} className="px-4 py-3">
                <p className="text-foreground text-sm font-medium">{m.title}</p>
                <p className="text-muted-foreground text-xs">
                  {m.location ?? 'TBD'}{m.scheduled_time ? ` · ${m.scheduled_time.slice(0, 5)}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
