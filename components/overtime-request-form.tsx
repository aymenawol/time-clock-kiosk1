"use client"

import type React from "react"
import { useState } from "react"
import { Save, Plus, Trash2 } from 'lucide-react'

interface ShiftEntry {
  shiftNumber: string
  dateOfShift: string
  startTime: string
  endTime: string
  payHours: string
}

interface OvertimeRequestFormProps {
  employeeName?: string
  onSubmit?: (data: Record<string, any>) => void
  onCancel?: () => void
}

export default function OvertimeRequestForm({ employeeName = "", onSubmit, onCancel }: OvertimeRequestFormProps) {
  const [formData, setFormData] = useState({
    seniorityNumber: "",
    timeStamp: new Date().toLocaleString(),
    employeeName: employeeName,
    dateTimeSubmitted: new Date().toISOString().slice(0, 16),
    employeeSignature: "",
    dispatcherName: "",
  })

  const [shifts, setShifts] = useState<ShiftEntry[]>([
    { shiftNumber: "", dateOfShift: "", startTime: "", endTime: "", payHours: "" }
  ])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleShiftChange = (index: number, field: keyof ShiftEntry, value: string) => {
    const newShifts = [...shifts]
    newShifts[index] = { ...newShifts[index], [field]: value }
    
    // Auto-calculate pay hours if start and end time are provided
    if (field === "startTime" || field === "endTime") {
      const shift = newShifts[index]
      if (shift.startTime && shift.endTime) {
        const start = new Date(`2000-01-01T${shift.startTime}`)
        let end = new Date(`2000-01-01T${shift.endTime}`)
        if (end < start) {
          end = new Date(`2000-01-02T${shift.endTime}`) // Next day
        }
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        newShifts[index].payHours = hours.toFixed(2)
      }
    }
    
    setShifts(newShifts)
  }

  const addShift = () => {
    setShifts([...shifts, { shiftNumber: "", dateOfShift: "", startTime: "", endTime: "", payHours: "" }])
  }

  const removeShift = (index: number) => {
    if (shifts.length > 1) {
      setShifts(shifts.filter((_, i) => i !== index))
    }
  }

  const handleSubmit = () => {
    const submissionData = {
      ...formData,
      shifts: shifts.filter(s => s.shiftNumber || s.dateOfShift),
      formType: "overtime_request",
      timestamp: new Date().toISOString(),
    }
    console.log("Overtime Request submitted", submissionData)
    
    if (onSubmit) {
      onSubmit(submissionData)
    } else {
      alert("Overtime Request submitted successfully!")
    }
  }

  return (
    <div className="bg-white p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="border-2 sm:border-4 border-black overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 p-4 border-b-2 border-black">
          <h1 className="text-xl sm:text-2xl font-bold text-center underline">OVERTIME WORK REQUEST FORM</h1>
        </div>

        <div className="p-4 space-y-4">
          {/* Top Info Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-sm">Seniority #:</label>
              <input
                type="text"
                name="seniorityNumber"
                value={formData.seniorityNumber}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-bold text-sm">Time Stamp:</label>
              <input
                type="text"
                value={formData.timeStamp}
                disabled
                className="w-full border-b-2 border-black p-2 mt-1 bg-gray-100 text-gray-600"
              />
            </div>
          </div>

          {/* Employee Name */}
          <div>
            <label className="font-bold text-sm">Employee Name:</label>
            <input
              type="text"
              name="employeeName"
              value={formData.employeeName}
              onChange={handleInputChange}
              className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Date and Time Submitted */}
          <div>
            <label className="font-bold text-sm">Date and Time Submitted:</label>
            <input
              type="datetime-local"
              name="dateTimeSubmitted"
              value={formData.dateTimeSubmitted}
              onChange={handleInputChange}
              className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Policy Statement */}
          <div className="bg-yellow-50 border-2 border-yellow-400 p-3 text-sm">
            <p>
              I hereby request to work the below indicated shift. I understand that if I am awarded the shift, 
              I may not cancel the request and the Attendance Policy applies.
            </p>
          </div>

          {/* Shift Table */}
          <div className="border-2 border-black overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border border-black p-2 text-sm font-bold">Shift #</th>
                  <th className="border border-black p-2 text-sm font-bold">Date of Shift</th>
                  <th className="border border-black p-2 text-sm font-bold">Start Time</th>
                  <th className="border border-black p-2 text-sm font-bold">End Time</th>
                  <th className="border border-black p-2 text-sm font-bold">Pay Hours</th>
                  <th className="border border-black p-2 text-sm font-bold w-12"></th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift, index) => (
                  <tr key={index}>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={shift.shiftNumber}
                        onChange={(e) => handleShiftChange(index, "shiftNumber", e.target.value)}
                        className="w-full p-2 text-center focus:outline-none focus:bg-blue-50"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="date"
                        value={shift.dateOfShift}
                        onChange={(e) => handleShiftChange(index, "dateOfShift", e.target.value)}
                        className="w-full p-2 text-center focus:outline-none focus:bg-blue-50"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="time"
                        value={shift.startTime}
                        onChange={(e) => handleShiftChange(index, "startTime", e.target.value)}
                        className="w-full p-2 text-center focus:outline-none focus:bg-blue-50"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="time"
                        value={shift.endTime}
                        onChange={(e) => handleShiftChange(index, "endTime", e.target.value)}
                        className="w-full p-2 text-center focus:outline-none focus:bg-blue-50"
                      />
                    </td>
                    <td className="border border-black p-1">
                      <input
                        type="text"
                        value={shift.payHours}
                        onChange={(e) => handleShiftChange(index, "payHours", e.target.value)}
                        className="w-full p-2 text-center focus:outline-none focus:bg-blue-50"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="border border-black p-1 text-center">
                      {shifts.length > 1 && (
                        <button
                          onClick={() => removeShift(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={addShift}
              className="w-full bg-gray-100 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add Another Shift
            </button>
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

          {/* Dispatcher Name */}
          <div>
            <label className="font-bold text-sm">Dispatcher Name:</label>
            <input
              type="text"
              name="dispatcherName"
              value={formData.dispatcherName}
              onChange={handleInputChange}
              className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Validation Notice */}
          <div className="bg-red-50 border-2 border-red-400 p-3 text-sm font-bold text-center underline">
            This form is not valid unless time-stamped by dispatch.
          </div>

          {/* For Company Use Only */}
          <div className="border-2 border-black p-4 bg-gray-100">
            <h3 className="font-bold text-center mb-3">Scheduling Department Review:</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-black p-4 bg-white text-center">
                <span className="font-bold">OT Awarded</span>
              </div>
              <div className="border-2 border-black p-4 bg-white text-center">
                <span className="font-bold">OT Not Awarded</span>
              </div>
            </div>
            <div className="mt-4">
              <label className="font-bold text-sm">Manager Signature:</label>
              <div className="border-b-2 border-black h-8 mt-1 bg-white"></div>
            </div>
            <p className="text-center text-gray-500 text-sm italic mt-3">
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
