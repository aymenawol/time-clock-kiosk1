"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Plus, Trash2, Save, Edit2, Share2, Copy, Check, X } from 'lucide-react'

export interface SafetyMeeting {
  id: string
  date: string
  time: string
  category: 'driver' | 'coordinator' | 'fueler_washer' | 'technician'
}

export interface SafetyMeetingScheduleData {
  id?: string
  title: string
  month: string
  year: number
  instruction: string
  meetings: SafetyMeeting[]
  created_at?: string
  updated_at?: string
}

interface SafetyMeetingScheduleProps {
  initialData?: SafetyMeetingScheduleData
  editable?: boolean
  onSave?: (data: SafetyMeetingScheduleData) => Promise<void>
  onShare?: () => void
}

const CATEGORY_LABELS: Record<SafetyMeeting['category'], string> = {
  driver: 'Driver',
  coordinator: 'Coordinator',
  fueler_washer: 'Fueler/Washer',
  technician: 'Technician'
}

const CATEGORY_ORDER: SafetyMeeting['category'][] = ['driver', 'coordinator', 'fueler_washer', 'technician']

const DEFAULT_DATA: SafetyMeetingScheduleData = {
  title: "SAFETY MEETING SCHEDULES",
  month: new Date().toLocaleString('default', { month: 'long' }),
  year: new Date().getFullYear(),
  instruction: "Drivers and Coordinators - Please have vests and closed-toe shoes.",
  meetings: []
}

export default function SafetyMeetingSchedule({ 
  initialData = DEFAULT_DATA, 
  editable = false,
  onSave,
  onShare
}: SafetyMeetingScheduleProps) {
  const [data, setData] = useState<SafetyMeetingScheduleData>(initialData)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [newMeeting, setNewMeeting] = useState<Partial<SafetyMeeting>>({
    category: 'driver',
    date: '',
    time: ''
  })
  const [initialized, setInitialized] = useState(false)

  // Only sync from initialData on first mount or when id changes (editing different schedule)
  useEffect(() => {
    if (!initialized) {
      setData(initialData)
      setInitialized(true)
    } else if (initialData.id && initialData.id !== data.id) {
      // Switching to a different existing schedule
      setData(initialData)
    }
  }, [initialData.id, initialized])

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const formatTime = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes}`
  }

  const getMeetingsByCategory = (category: SafetyMeeting['category']) => {
    return data.meetings
      .filter(m => m.category === category)
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date)
        if (dateCompare !== 0) return dateCompare
        return a.time.localeCompare(b.time)
      })
  }

  const handleAddMeeting = () => {
    if (!newMeeting.date || !newMeeting.time || !newMeeting.category) return

    const meeting: SafetyMeeting = {
      id: crypto.randomUUID(),
      date: newMeeting.date,
      time: newMeeting.time,
      category: newMeeting.category
    }

    setData(prev => ({
      ...prev,
      meetings: [...prev.meetings, meeting]
    }))

    setNewMeeting({
      category: newMeeting.category,
      date: '',
      time: ''
    })
  }

  const handleDeleteMeeting = (id: string) => {
    setData(prev => ({
      ...prev,
      meetings: prev.meetings.filter(m => m.id !== id)
    }))
  }

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      await onSave(data)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyLink = async () => {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportText = () => {
    let text = `${data.title}\n${data.month} ${data.year}\n\n${data.instruction}\n\n`
    
    CATEGORY_ORDER.forEach(category => {
      const meetings = getMeetingsByCategory(category)
      if (meetings.length > 0) {
        text += `${CATEGORY_LABELS[category]}:\n`
        meetings.forEach(m => {
          text += `  ${formatDate(m.date)} - ${formatTime(m.time)}\n`
        })
        text += '\n'
      }
    })

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white p-6 border-b-4 border-black">
        {isEditing ? (
          <input
            type="text"
            value={data.title}
            onChange={(e) => setData(prev => ({ ...prev, title: e.target.value }))}
            className="text-2xl sm:text-3xl font-bold text-center w-full border-2 border-gray-300 rounded p-2 mb-4"
          />
        ) : (
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-4">{data.title}</h1>
        )}
        
        {isEditing ? (
          <div className="flex justify-center gap-4 mb-4">
            <select
              value={data.month}
              onChange={(e) => setData(prev => ({ ...prev, month: e.target.value }))}
              className="border-2 border-gray-300 rounded p-2 text-lg"
            >
              {['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              type="number"
              value={data.year}
              onChange={(e) => setData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
              className="w-24 border-2 border-gray-300 rounded p-2 text-lg text-center"
            />
          </div>
        ) : (
          <p className="text-xl text-center text-gray-700 mb-4">{data.month} {data.year}</p>
        )}
        
        {isEditing ? (
          <input
            type="text"
            value={data.instruction}
            onChange={(e) => setData(prev => ({ ...prev, instruction: e.target.value }))}
            className="w-full bg-yellow-200 p-3 text-center font-semibold border-2 border-yellow-400 rounded"
          />
        ) : (
          <div className="bg-yellow-200 p-3 text-center font-semibold border-2 border-yellow-400 rounded">
            {data.instruction}
          </div>
        )}
      </div>

      {/* Meeting Sections */}
      <div className="p-4 sm:p-6 space-y-6">
        {CATEGORY_ORDER.map(category => {
          const meetings = getMeetingsByCategory(category)
          
          return (
            <div key={category} className="border-2 border-black rounded-lg overflow-hidden">
              <div className="bg-black text-yellow-400 px-4 py-3 font-bold text-lg">
                {CATEGORY_LABELS[category]}
              </div>
              <div className="p-4 space-y-2">
                {meetings.length === 0 && !isEditing && (
                  <p className="text-gray-500 italic text-center py-4">No meetings scheduled</p>
                )}
                {meetings.map(meeting => (
                  <div key={meeting.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded hover:bg-gray-100">
                    <span className="text-sm sm:text-base">
                      {formatDate(meeting.date)} - {formatTime(meeting.time)}
                    </span>
                    {isEditing && (
                      <button
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
                
                {/* Add meeting form when editing */}
                {isEditing && (
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-300">
                    <input
                      type="date"
                      value={newMeeting.category === category ? newMeeting.date : ''}
                      onChange={(e) => setNewMeeting({ ...newMeeting, category, date: e.target.value })}
                      className="border-2 border-gray-300 rounded p-2 text-sm flex-1 min-w-[140px]"
                    />
                    <input
                      type="time"
                      value={newMeeting.category === category ? newMeeting.time : ''}
                      onChange={(e) => setNewMeeting({ ...newMeeting, category, time: e.target.value })}
                      className="border-2 border-gray-300 rounded p-2 text-sm w-28"
                    />
                    <button
                      onClick={() => {
                        if (newMeeting.category === category && newMeeting.date && newMeeting.time) {
                          handleAddMeeting()
                        }
                      }}
                      disabled={newMeeting.category !== category || !newMeeting.date || !newMeeting.time}
                      className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      <Plus size={16} />
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Action Buttons */}
      {editable && (
        <div className="bg-gray-100 p-4 border-t-2 border-black flex flex-wrap gap-3 justify-between">
          <div className="flex gap-3">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                <Edit2 size={18} />
                Edit Schedule
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setData(initialData)
                    setIsEditing(false)
                  }}
                  className="bg-gray-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <X size={18} />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-[#E31E24] text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-red-700 disabled:bg-gray-400 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Save size={18} />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
          
          {!isEditing && (
            <div className="flex gap-3">
              <button
                onClick={handleExportText}
                className="bg-gray-700 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center gap-2 shadow-sm"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy Text'}
              </button>
              {onShare && (
                <button
                  onClick={onShare}
                  className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Share2 size={18} />
                  Share Link
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
