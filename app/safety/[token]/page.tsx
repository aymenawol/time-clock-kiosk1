"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import SafetyMeetingSchedule from "@/components/safety-meeting-schedule"
import { createBrowserClient } from "@supabase/ssr"
import { Card } from "@/components/ui/card"
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
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        const { data } = await supabase
          .from("safety_meeting_schedules")
          .select("*")
          .eq("share_token", token)
          .eq("is_active", true)
          .single()
        if (data) {
          setSchedule(data as SafetyMeetingScheduleType)
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-xl text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (error || !schedule) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <h1 className="text-2xl font-bold text-foreground mb-4">Schedule Not Found</h1>
          <p className="text-muted-foreground">{error || "The schedule you're looking for doesn't exist."}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="bg-primary text-primary-foreground p-4 rounded-t-xl mb-0">
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
