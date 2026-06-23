import { getBusesAction } from './actions'
import BusesClient from './buses-client'

export const dynamic = 'force-dynamic'

export default async function BusesPage() {
  const { buses, error } = await getBusesAction()

  return <BusesClient initialBuses={buses} serverError={error} />
}
