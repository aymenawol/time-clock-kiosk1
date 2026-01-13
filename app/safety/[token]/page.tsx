"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import SafetyMeetingSchedule from "@/components/safety-meeting-schedule"
import { getSafetyMeetingScheduleByShareToken } from "@/lib/api"
import type { SafetyMeetingSchedule as SafetyMeetingScheduleType } from "@/lib/supabase"

export default function SafetyMeetingPage() {
  const params = useParams()
  const token = params.token as string
  const [schedule, setSchedule] = useState<SafetyMeetingScheduleType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSchedule() {
      try {
        const data = await getSafetyMeetingScheduleByShareToken(token)
        if (data) {
          setSchedule(data)
        } else {
          setError("Schedule not found or has been removed.")
        }
      } catch (err) {
        setError("Failed to load schedule.")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadSchedule()
    }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    )
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8 shadow-lg text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Schedule Not Found</h1>
          <p className="text-gray-600">{error || "The schedule you're looking for doesn't exist."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="bg-[#E31E24] text-white p-4 rounded-t-xl mb-0">
          <h1 className="text-2xl font-bold">Safety Meeting Schedule</h1>
        </header>

        {/* Schedule Content */}
        <SafetyMeetingSchedule
          initialData={{
            id: schedule.id,
            title: schedule.title,
            month: schedule.month,
            year: schedule.year,
            instruction: schedule.instruction,
            meetings: schedule.meetings || [],
            created_at: schedule.created_at,
            updated_at: schedule.updated_at
          }}
          editable={false}
        />
      </div>
    </div>
  )
}
