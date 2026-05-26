import { getBusDetailAction } from '../actions'
import { notFound } from 'next/navigation'
import BusDetailClient from './bus-detail-client'

export const dynamic = 'force-dynamic'

export default async function BusDetailPage({ params }: { params: { id: string } }) {
  const { bus, history, shifts, repairs, error } = await getBusDetailAction(params.id)

  if (!bus) notFound()

  return (
    <div className="p-6">
      <BusDetailClient bus={bus} history={history} shifts={shifts} repairs={repairs} />
    </div>
  )
}
