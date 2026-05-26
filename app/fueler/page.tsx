import { createSupabaseServerClient, getServerUser } from '@/lib/supabase-server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function FuelerPage() {
  const { user } = await getServerUser()
  const supabase = await createSupabaseServerClient()
  const today = new Date().toISOString().slice(0, 10)

  // Get buses needing service (fueling or wash)
  const { data: busesPending } = await supabase
    .from('buses')
    .select('id, bus_number, bus_type, status, fuel_level')
    .eq('is_active', true)
    .in('status', ['fuel', 'wash', 'ready', 'charging'])
    .order('bus_number')

  // Today's safety meetings
  const { data: meetings } = await supabase
    .from('safety_meeting_schedules')
    .select('id, title, scheduled_date, location, duration_minutes')
    .eq('scheduled_date', today)
    .order('scheduled_date')
    .limit(5)

  const fuelingBuses = (busesPending ?? []).filter((b: any) => b.status === 'fuel')
  const washBuses    = (busesPending ?? []).filter((b: any) => b.status === 'wash')
  const readyBuses   = (busesPending ?? []).filter((b: any) => ['ready', 'charging'].includes(b.status))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Fueler / Washer Dashboard</h1>
        <p className="text-gray-500 text-sm">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/driver/forms" className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 text-center block">
          <div className="text-2xl mb-1">📝</div>
          <div className="text-xs text-gray-400">Forms</div>
        </Link>
        <Link href="/driver/safety-meetings" className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 text-center block">
          <div className="text-2xl mb-1">🛡️</div>
          <div className="text-xs text-gray-400">Safety Meetings</div>
        </Link>
        <Link href="/driver/lost-found" className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 text-center block">
          <div className="text-2xl mb-1">🔎</div>
          <div className="text-xs text-gray-400">Lost & Found</div>
        </Link>
      </div>

      {/* Buses needing fueling */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-800/60 flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Needs Fueling</h2>
          <span className="text-yellow-400 text-xs">{fuelingBuses.length} bus{fuelingBuses.length !== 1 ? 'es' : ''}</span>
        </div>
        {fuelingBuses.length === 0 ? (
          <p className="text-gray-600 text-sm px-4 py-3">No buses queued for fueling.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {fuelingBuses.map((b: any) => (
              <div key={b.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Bus #{b.bus_number}</p>
                  <p className="text-gray-500 text-xs">{b.bus_type}</p>
                </div>
                {b.fuel_level != null && (
                  <span className="text-yellow-400 text-sm">{b.fuel_level.toFixed(0)}%</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Buses needing wash */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-800/60 flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm">Needs Wash</h2>
          <span className="text-blue-400 text-xs">{washBuses.length} bus{washBuses.length !== 1 ? 'es' : ''}</span>
        </div>
        {washBuses.length === 0 ? (
          <p className="text-gray-600 text-sm px-4 py-3">No buses queued for washing.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {washBuses.map((b: any) => (
              <div key={b.id} className="px-4 py-3">
                <p className="text-white font-medium">Bus #{b.bus_number}</p>
                <p className="text-gray-500 text-xs">{b.bus_type}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ready fleet overview */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-800/60">
          <h2 className="text-white font-semibold text-sm">Ready Fleet ({readyBuses.length})</h2>
        </div>
        {readyBuses.length === 0 ? (
          <p className="text-gray-600 text-sm px-4 py-3">No ready buses.</p>
        ) : (
          <div className="divide-y divide-gray-800 max-h-48 overflow-y-auto">
            {readyBuses.map((b: any) => (
              <div key={b.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                <span className="text-gray-300">Bus #{b.bus_number}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">{b.bus_type}</span>
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
        <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-800/60">
            <h2 className="text-white font-semibold text-sm">Today's Safety Meetings</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {meetings.map((m: any) => (
              <div key={m.id} className="px-4 py-3">
                <p className="text-white text-sm font-medium">{m.title}</p>
                <p className="text-gray-500 text-xs">
                  {m.location ?? 'TBD'} · {m.duration_minutes ? `${m.duration_minutes} min` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
