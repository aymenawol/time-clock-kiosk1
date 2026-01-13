"use client"

import type React from "react"
import { useState } from "react"
import { Save } from 'lucide-react'

interface IncidentReportFormProps {
  employeeName?: string
  onSubmit?: (data: Record<string, any>) => void
  onCancel?: () => void
}

export default function IncidentReportForm({ employeeName = "", onSubmit, onCancel }: IncidentReportFormProps) {
  const [formData, setFormData] = useState({
    employeeName: employeeName,
    incidentDate: new Date().toISOString().split("T")[0],
    incidentTime: "",
    incidentLocation: "",
    busNumber: "",
    supervisorContacted: "",
    detailsOfEvent: "",
    witnesses: "",
    passengerName: "",
    passengerAddress: "",
    passengerCityStateZip: "",
    passengerPhone: "",
    employeeSignature: "",
    dateCompleted: new Date().toISOString().split("T")[0],
    timeCompleted: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = () => {
    const submissionData = {
      ...formData,
      formType: "incident_report",
      timestamp: new Date().toISOString(),
    }
    console.log("Incident Report submitted", submissionData)
    
    if (onSubmit) {
      onSubmit(submissionData)
    } else {
      alert("Incident Report submitted successfully!")
    }
  }

  return (
    <div className="bg-white p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="border-2 sm:border-4 border-black overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 p-4 border-b-2 border-black">
          <h1 className="text-xl sm:text-2xl font-bold text-center underline">EMPLOYEE INCIDENT REPORT</h1>
        </div>

        <div className="p-4 space-y-4">
          {/* Employee Name */}
          <div>
            <label className="font-bold text-sm">Employee Name (Please Print):</label>
            <input
              type="text"
              name="employeeName"
              value={formData.employeeName}
              onChange={handleInputChange}
              className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Incident Date and Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-sm">Incident Date:</label>
              <input
                type="date"
                name="incidentDate"
                value={formData.incidentDate}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-bold text-sm">Incident Time:</label>
              <input
                type="time"
                name="incidentTime"
                value={formData.incidentTime}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Incident Location and Bus # */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-sm">Incident Location:</label>
              <input
                type="text"
                name="incidentLocation"
                value={formData.incidentLocation}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-bold text-sm">Bus #:</label>
              <input
                type="text"
                name="busNumber"
                value={formData.busNumber}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Supervisor Contacted */}
          <div>
            <label className="font-bold text-sm">Supervisor Contacted (Name):</label>
            <input
              type="text"
              name="supervisorContacted"
              value={formData.supervisorContacted}
              onChange={handleInputChange}
              className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Details of Event */}
          <div>
            <label className="font-bold text-sm">Details of Event (Facts Only – No Speculation):</label>
            <textarea
              name="detailsOfEvent"
              value={formData.detailsOfEvent}
              onChange={handleInputChange}
              rows={8}
              className="w-full border-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Describe the incident in detail..."
            />
          </div>

          {/* Witnesses */}
          <div>
            <label className="font-bold text-sm">Witnesses (Print Names):</label>
            <input
              type="text"
              name="witnesses"
              value={formData.witnesses}
              onChange={handleInputChange}
              className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              placeholder="Enter witness names separated by commas"
            />
          </div>

          {/* Passenger Information Section */}
          <div className="border-t-2 border-black pt-4 mt-4">
            <div className="mb-2">
              <label className="font-bold text-sm">Passenger Name (If Applicable):</label>
              <input
                type="text"
                name="passengerName"
                value={formData.passengerName}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="mb-2">
              <label className="font-bold text-sm">Passenger Address:</label>
              <input
                type="text"
                name="passengerAddress"
                value={formData.passengerAddress}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="mb-2">
              <label className="font-bold text-sm">Passenger City, State, Zip Code:</label>
              <input
                type="text"
                name="passengerCityStateZip"
                value={formData.passengerCityStateZip}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="font-bold text-sm">Passenger Telephone Number:</label>
              <input
                type="tel"
                name="passengerPhone"
                value={formData.passengerPhone}
                onChange={handleInputChange}
                className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Signature Section */}
          <div className="border-t-2 border-black pt-4 mt-4">
            <div className="mb-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-bold text-sm">Date Completed:</label>
                <input
                  type="date"
                  name="dateCompleted"
                  value={formData.dateCompleted}
                  onChange={handleInputChange}
                  className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="font-bold text-sm">Time Completed:</label>
                <input
                  type="time"
                  name="timeCompleted"
                  value={formData.timeCompleted}
                  onChange={handleInputChange}
                  className="w-full border-b-2 border-black p-2 mt-1 focus:outline-none focus:border-blue-500"
                />
              </div>
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
            Submit Report
          </button>
        </div>
      </div>
    </div>
  )
}
