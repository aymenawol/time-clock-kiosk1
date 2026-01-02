"use client"

import type React from "react"
import { useState } from "react"
import { Save } from 'lucide-react'

interface FmlaDateEntry {
  date: string
  useVacationPay: boolean | null
}

interface FmlaConversionFormProps {
  employeeName?: string
  onSubmit?: (data: Record<string, any>) => void
  onCancel?: () => void
}

export default function FmlaConversionForm({ employeeName = "", onSubmit, onCancel }: FmlaConversionFormProps) {
  const [formData, setFormData] = useState({
    employeeName: employeeName,
    mailboxNumber: "",
    date: new Date().toISOString().split("T")[0],
    employeeSignature: "",
  })

  const [fmlaDates, setFmlaDates] = useState<FmlaDateEntry[]>([
    { date: "", useVacationPay: null },
    { date: "", useVacationPay: null },
    { date: "", useVacationPay: null },
    { date: "", useVacationPay: null },
    { date: "", useVacationPay: null },
  ])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleDateChange = (index: number, value: string) => {
    const newDates = [...fmlaDates]
    newDates[index] = { ...newDates[index], date: value }
    setFmlaDates(newDates)
  }

  const handleVacationPayChange = (index: number, value: boolean) => {
    const newDates = [...fmlaDates]
    newDates[index] = { ...newDates[index], useVacationPay: value }
    setFmlaDates(newDates)
  }

  const handleSubmit = () => {
    const submissionData = {
      ...formData,
      fmlaDates: fmlaDates.filter(d => d.date !== ""),
      formType: "fmla_conversion",
      timestamp: new Date().toISOString(),
    }
    console.log("FMLA Conversion Form submitted", submissionData)
    
    if (onSubmit) {
      onSubmit(submissionData)
    } else {
      alert("FMLA Conversion Form submitted successfully!")
    }
  }

  return (
    <div className="bg-white p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="border-2 sm:border-4 border-black overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 p-4 border-b-2 border-black">
          <div className="flex items-center gap-4 mb-2">
            <div className="text-2xl font-bold italic text-gray-700">transdev</div>
            <div className="text-xs text-gray-500">the mobility company</div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-center underline">Absence/FMLA Conversion Form</h1>
        </div>

        <div className="p-4 space-y-4">
          {/* Policy Explanation */}
          <div className="bg-blue-50 border-2 border-blue-300 p-3 text-sm">
            <p>
              This form is used to convert an attendance occurrence to FMLA and is used for intermittent FMLA only. 
              The use of any PTO available will be mandated. The use of vacation time will only be used if indicated 
              on this form (otherwise will be unpaid).
            </p>
          </div>

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
          </div>

          {/* Dates to Convert to FMLA */}
          <div className="border-2 border-black p-4">
            <h2 className="font-bold text-center mb-3">I request to convert the following dates to FMLA:</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {fmlaDates.map((entry, index) => (
                <div key={index} className="text-center">
                  <label className="text-xs font-bold block mb-1">Date</label>
                  <input
                    type="date"
                    value={entry.date}
                    onChange={(e) => handleDateChange(index, e.target.value)}
                    className="w-full border-2 border-black p-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Vacation Pay Selection */}
          <div className="border-2 border-black p-4">
            <h2 className="font-bold text-center mb-3 text-sm">
              Please indicate if you would like to use vacation pay for the intermittent FMLA usage.
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {fmlaDates.map((entry, index) => (
                <div key={index} className="text-center border border-gray-300 p-2">
                  <label className="text-xs font-bold block mb-2">Vacation Pay?</label>
                  <div className="flex justify-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`vacationPay-${index}`}
                        checked={entry.useVacationPay === true}
                        onChange={() => handleVacationPayChange(index, true)}
                        className="w-4 h-4"
                        disabled={!entry.date}
                      />
                      <span className="text-xs">Yes</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`vacationPay-${index}`}
                        checked={entry.useVacationPay === false}
                        onChange={() => handleVacationPayChange(index, false)}
                        className="w-4 h-4"
                        disabled={!entry.date}
                      />
                      <span className="text-xs">No</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
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

          {/* Validation Notice */}
          <div className="bg-red-50 border-2 border-red-400 p-3 text-sm font-semibold text-center">
            Form MUST be signed and time stamped to be valid. Please verify requested dates are correct.
          </div>

          {/* For Company Use Only */}
          <div className="border-2 border-black overflow-hidden bg-gray-100">
            <h3 className="font-bold text-center py-2 bg-black text-white">For Company use only:</h3>
            <div className="p-4 space-y-4">
              {/* FMLA Approval Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {fmlaDates.map((_, index) => (
                  <div key={index} className="text-center border border-gray-300 p-2 bg-white">
                    <label className="text-xs font-bold block mb-2">FMLA Approved</label>
                    <div className="flex justify-center gap-2">
                      <label className="flex items-center gap-1">
                        <input type="radio" disabled className="w-3 h-3" />
                        <span className="text-xs">Yes</span>
                      </label>
                      <label className="flex items-center gap-1">
                        <input type="radio" disabled className="w-3 h-3" />
                        <span className="text-xs">No</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reason for Disapproval */}
              <div>
                <label className="font-bold text-sm">Reason for Disapproval:</label>
                <div className="border-b-2 border-black h-8 mt-1 bg-white"></div>
                <div className="border-b-2 border-black h-8 mt-1 bg-white"></div>
              </div>

              {/* Admin Signatures */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-sm">Entered By:</label>
                  <div className="border-b-2 border-black h-8 mt-1 bg-white"></div>
                </div>
                <div>
                  <label className="font-bold text-sm">Date:</label>
                  <div className="border-b-2 border-black h-8 mt-1 bg-white"></div>
                </div>
                <div>
                  <label className="font-bold text-sm">Approved By:</label>
                  <div className="border-b-2 border-black h-8 mt-1 bg-white"></div>
                </div>
                <div>
                  <label className="font-bold text-sm">Date:</label>
                  <div className="border-b-2 border-black h-8 mt-1 bg-white"></div>
                </div>
              </div>

              <p className="text-center text-gray-500 text-sm italic">
                This section will be completed by management after submission.
              </p>
            </div>
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
            Submit Form
          </button>
        </div>
      </div>
    </div>
  )
}
