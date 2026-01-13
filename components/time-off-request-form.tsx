"use client"

import type React from "react"
import { useState } from "react"
import { Save } from 'lucide-react'

interface TimeOffRequestFormProps {
  employeeName?: string
  onSubmit?: (data: Record<string, any>) => void
  onCancel?: () => void
}

export default function TimeOffRequestForm({ employeeName = "", onSubmit, onCancel }: TimeOffRequestFormProps) {
  const [formData, setFormData] = useState({
    employeeName: employeeName,
    mailboxNumber: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "",
    // Leave types
    vacationPto: false,
    juryDuty: false,
    bereavement: false,
    birthday: false,
    // Signature
    employeeSignature: "",
    cancelFormInitials: "",
  })

  const [requestedDates, setRequestedDates] = useState<string[]>(["", "", "", "", ""])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData({ 
      ...formData, 
      [name]: type === "checkbox" ? checked : value 
    })
  }

  const handleDateChange = (index: number, value: string) => {
    const newDates = [...requestedDates]
    newDates[index] = value
    setRequestedDates(newDates)
  }

  const handleSubmit = () => {
    const submissionData = {
      ...formData,
      requestedDates: requestedDates.filter(d => d !== ""),
      formType: "time_off_request",
      timestamp: new Date().toISOString(),
    }
    console.log("Time Off Request submitted", submissionData)
    
    if (onSubmit) {
      onSubmit(submissionData)
    } else {
      alert("Time Off Request submitted successfully!")
    }
  }

  return (
    <div className="bg-white p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="border-2 sm:border-4 border-black overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 p-4 border-b-2 border-black">
          <h1 className="text-xl sm:text-2xl font-bold text-center underline">TIME OFF REQUEST FORM</h1>
        </div>

        <div className="p-4 space-y-4">
          {/* Employee Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="font-bold text-sm">Employee Name:</label>
              <input
                type="text"
                name="employeeName"
                value={formData.employeeName}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-bold text-sm">Mailbox #:</label>
              <input
                type="text"
                name="mailboxNumber"
                value={formData.mailboxNumber}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-bold text-sm">Date:</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-bold text-sm">Start Time:</label>
              <input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-bold text-sm">Stamp:</label>
              <input
                type="text"
                disabled
                value={new Date().toLocaleString()}
                className="w-full border-b-2 border-black p-2 mt-1 bg-gray-100 text-gray-600"
              />
            </div>
          </div>

          {/* Dates Requested Off */}
          <div className="border-2 border-black p-4 mt-4">
            <h2 className="font-bold text-center mb-3 underline">Dates Requested Off (Must be continuous)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {requestedDates.map((date, index) => (
                <div key={index}>
                  <label className="text-xs font-bold text-center block">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => handleDateChange(index, e.target.value)}
                    className="w-full border-2 border-black p-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Policy Notice */}
          <div className="bg-yellow-50 border-2 border-yellow-400 p-3 text-xs">
            <p className="font-semibold">
              All time off must be submitted no earlier than 30-days and no sooner than 5 days from the date requested 
              (date of submission does not count). If multiple days in a row are requested the first day must meet these requirements.
            </p>
          </div>

          {/* Leave Type Selection */}
          <div className="border-2 border-black p-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 p-2 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="vacationPto"
                  checked={formData.vacationPto}
                  onChange={handleInputChange}
                  className="w-5 h-5"
                />
                <span className="font-semibold text-sm">Vacation / PTO:</span>
              </label>
              <label className="flex items-center gap-2 p-2 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="juryDuty"
                  checked={formData.juryDuty}
                  onChange={handleInputChange}
                  className="w-5 h-5"
                />
                <span className="font-semibold text-sm">Jury Duty (Proof of service required)</span>
              </label>
              <label className="flex items-center gap-2 p-2 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="bereavement"
                  checked={formData.bereavement}
                  onChange={handleInputChange}
                  className="w-5 h-5"
                />
                <span className="font-semibold text-sm">Bereavement (Documentation must be submitted for pay)</span>
              </label>
              <label className="flex items-center gap-2 p-2 border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="birthday"
                  checked={formData.birthday}
                  onChange={handleInputChange}
                  className="w-5 h-5"
                />
                <span className="font-semibold text-sm">Birthday (Between actual birthday and 90 days after birthday)</span>
              </label>
            </div>
          </div>

          {/* Cancel Form Section */}
          <div className="border-2 border-black p-3 bg-gray-50">
            <label className="font-bold text-sm">
              IF ALL DAYS ARE NOT AVAILABLE PLEASE CANCEL THIS DAY OFF REQUEST FORM (INIT):
            </label>
            <input
              type="text"
              name="cancelFormInitials"
              value={formData.cancelFormInitials}
              onChange={handleInputChange}
              className="w-20 border-2 border-black p-1 ml-2 text-center focus:outline-none focus:border-blue-500"
              maxLength={5}
            />
          </div>

          {/* Employee Signature */}
          <div>
            <label className="font-bold text-sm">Employee Signature:</label>
            <input
              type="text"
              name="employeeSignature"
              value={formData.employeeSignature}
              onChange={handleInputChange}
              className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500 italic"
              placeholder="Type your full name as signature"
            />
          </div>

          {/* Notice */}
          <div className="bg-red-50 border-2 border-red-400 p-3 text-sm font-semibold text-center">
            Form MUST be signed and time stamped to be valid. Please verify requested dates are correct.
          </div>

          {/* For Company Use Only - Read Only Display */}
          <div className="border-2 border-black p-4 bg-gray-100">
            <h3 className="font-bold text-center mb-3 bg-black text-white py-1">For Company use only:</h3>
            <p className="text-center text-gray-500 text-sm italic">
              This section will be completed by management after submission.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gray-100 p-4 border-t-2 border-black flex gap-4 justify-end">
          {onCancel && (
            <button
              onClick={onCancel}
              className="bg-gray-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            className="bg-[#E31E24] text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Save size={20} />
            Submit Request
          </button>
        </div>
      </div>
    </div>
  )
}
