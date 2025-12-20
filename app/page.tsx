"use client"

import { useState, useEffect } from "react"
import { Search, Delete, Home } from 'lucide-react'
import DVIForm from "@/components/dvi-form"
import TimesheetForm from "@/components/timesheet-form"
import {
  getEmployeeByEmployeeId,
  getCurrentTimeEntry,
  clockIn,
  clockOut,
  getDviForTimeEntry,
  submitDvi,
  submitTimesheet,
  formatClockTime,
  getActiveClockIns,
  getAllEmployees,
  createEmployee,
  updateEmployee,
  getTimesheets,
  getDVIRecords,
} from "@/lib/api"
import type { Employee, TimeEntry, ActiveClockIn, Timesheet, DviRecord } from "@/lib/supabase"

type ViewState = "login" | "employeeIdEntry" | "actionSelect" | "dvi" | "timesheet" | "clockout" | "admin" | "adminLogin"
type FormType = "dvi" | "timesheet"
type AdminTab = "dashboard" | "employees" | "timesheets" | "dvi"

// Admin PIN - change this to your desired admin password
const ADMIN_PIN = "9999"

export default function TimeClockKiosk() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<ViewState>("login")
  const [activeForm, setActiveForm] = useState<FormType>("dvi")
  const [enteredId, setEnteredId] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null)
  const [currentTimeEntry, setCurrentTimeEntry] = useState<TimeEntry | null>(null)
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false)
  const [employeeData, setEmployeeData] = useState({
    name: "",
    id: "",
    visibleId: "",
    clockedIn: false,
    dviCompleted: false,
    timesheetCompleted: false,
    clockInTime: "",
  })

  // Admin state
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard")
  const [activeClockIns, setActiveClockIns] = useState<ActiveClockIn[]>([])
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const [timesheets, setTimesheets] = useState<Timesheet[]>([])
  const [dviRecords, setDviRecords] = useState<DviRecord[]>([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [showEmployeeModal, setShowEmployeeModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("")
  const [adminStartDate, setAdminStartDate] = useState('')
  const [adminEndDate, setAdminEndDate] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [adminPinError, setAdminPinError] = useState<string | null>(null)
  const [selectedDviRecord, setSelectedDviRecord] = useState<DviRecord | null>(null)
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    // Set initial values on client side to avoid hydration mismatch
    setMounted(true)
    setCurrentTime(new Date())
    
    // Initialize admin date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7)
    setAdminStartDate(startDate.toISOString().split('T')[0])
    setAdminEndDate(endDate.toISOString().split('T')[0])
    
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--:-- --'
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'Loading...'
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const handleDashboard = () => {
    setView("login")
    setCurrentEmployee(null)
    setCurrentTimeEntry(null)
    setError(null)
    setEmployeeData({
      name: "",
      id: "",
      visibleId: "",
      clockedIn: false,
      dviCompleted: false,
      timesheetCompleted: false,
      clockInTime: "",
    })
  }

  const handleIdCardLogin = () => {
    setView("employeeIdEntry")
    setEnteredId("")
  }

  const handleAdminLoginClick = () => {
    setView("adminLogin")
    setAdminPin("")
    setAdminPinError(null)
  }

  const handleAdminPinSubmit = () => {
    if (adminPin === ADMIN_PIN) {
      setView("admin")
      setAdminTab("dashboard")
      setAdminPin("")
      setAdminPinError(null)
      loadAdminData("dashboard")
    } else {
      setAdminPinError("Invalid PIN. Please try again.")
      setAdminPin("")
    }
  }

  const handleEmployeeIdLogin = () => {
    setView("admin")
    setAdminTab("dashboard")
    loadAdminData("dashboard")
  }

  const loadAdminData = async (tab: AdminTab) => {
    setAdminLoading(true)
    try {
      if (tab === "dashboard") {
        const clockIns = await getActiveClockIns()
        setActiveClockIns(clockIns)
      } else if (tab === "employees") {
        const emps = await getAllEmployees()
        setAllEmployees(emps)
      } else if (tab === "timesheets") {
        const sheets = await getTimesheets(undefined, adminStartDate, adminEndDate)
        setTimesheets(sheets)
      } else if (tab === "dvi") {
        const records = await getDVIRecords(adminStartDate, adminEndDate)
        setDviRecords(records)
      }
    } catch (err) {
      console.error("Error loading admin data:", err)
    }
    setAdminLoading(false)
  }

  const handleAdminTabChange = (tab: AdminTab) => {
    setAdminTab(tab)
    setCurrentPage(1) // Reset pagination when switching tabs
    loadAdminData(tab)
  }

  const handleSaveEmployee = async (employeeFormData: {
    employee_id: string
    name: string
    pin: string
    is_active: boolean
  }) => {
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, employeeFormData)
      } else {
        await createEmployee(employeeFormData)
      }
      setShowEmployeeModal(false)
      setEditingEmployee(null)
      loadAdminData("employees")
    } catch (err) {
      console.error("Error saving employee:", err)
    }
  }

  const filteredEmployees = allEmployees.filter(emp => 
    emp.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    emp.employee_id.includes(employeeSearchTerm)
  )

  const formatAdminDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const handleKeypadPress = (digit: string) => {
    if (enteredId.length < 10) {
      setEnteredId(enteredId + digit)
    }
  }

  const handleClear = () => {
    setEnteredId("")
  }

  const handleBackspace = () => {
    setEnteredId(enteredId.slice(0, -1))
  }

  const handleSubmitEmployeeId = async () => {
    if (enteredId.length > 0) {
      setIsLoading(true)
      setError(null)
      
      // Prevent using admin PIN for driver login
      if (enteredId === ADMIN_PIN) {
        setError("This is an admin PIN. Please use the ADMIN button to login as admin.")
        setIsLoading(false)
        return
      }
      
      try {
        // Look up employee in Supabase
        const employee = await getEmployeeByEmployeeId(enteredId)
        
        if (!employee) {
          setError("Employee not found. Please check your ID.")
          setIsLoading(false)
          return
        }
        
        // Check if this is an admin-only account
        if ((employee as any).is_admin && !(employee as any).is_driver) {
          setError("This is an admin account. Please use the ADMIN button.")
          setIsLoading(false)
          return
        }
        
        setCurrentEmployee(employee)
        
        // Check if already clocked in
        const existingTimeEntry = await getCurrentTimeEntry(employee.id)
        setCurrentTimeEntry(existingTimeEntry)
        
        let clockInTimeStr = ""
        let dviCompleted = false
        
        if (existingTimeEntry) {
          clockInTimeStr = formatClockTime(existingTimeEntry.clock_in_time)
          const dvi = await getDviForTimeEntry(existingTimeEntry.id)
          dviCompleted = !!dvi
        }
        
        setEmployeeData({
          name: employee.name,
          id: employee.employee_id,
          visibleId: employee.id,
          clockedIn: !!existingTimeEntry,
          dviCompleted,
          timesheetCompleted: false,
          clockInTime: clockInTimeStr,
        })
        
        // Go to action selection screen
        setView("actionSelect")
      } catch (err) {
        console.error("Login error:", err)
        const errorMessage = err instanceof Error ? err.message : "An error occurred. Please try again."
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleClockIn = async () => {
    if (!currentEmployee) return
    
    setIsLoading(true)
    try {
      const timeEntry = await clockIn(currentEmployee.id)
      if (timeEntry) {
        setCurrentTimeEntry(timeEntry)
        setEmployeeData(prev => ({
          ...prev,
          clockedIn: true,
          clockInTime: formatClockTime(timeEntry.clock_in_time),
        }))
      }
    } catch (err) {
      console.error("Clock in error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoToDvi = () => {
    setActiveForm("dvi")
    setView("dvi")
  }

  const handleGoToTimesheet = () => {
    setActiveForm("timesheet")
    setView("timesheet")
  }

  const handleCancelIdEntry = () => {
    setView("login")
    setEnteredId("")
    setError(null)
  }

  // Authentication is now handled in handleSubmitEmployeeId

  const handleDviComplete = async (dviData?: Record<string, any>) => {
    if (currentTimeEntry && currentEmployee) {
      try {
        await submitDvi(currentEmployee.id, currentTimeEntry.id, {
          inspection_data: dviData || {},
          is_passed: true,
        })
        setEmployeeData((prev) => ({ ...prev, dviCompleted: true }))
      } catch (err) {
        console.error("Error submitting DVI:", err)
      }
    }
    setView("actionSelect")
  }

  const handleTimesheetComplete = async (timesheetData?: Record<string, any>) => {
    if (timesheetData && currentEmployee && currentTimeEntry) {
      try {
        await submitTimesheet(currentEmployee.id, currentTimeEntry.id, {
          operator: timesheetData.operator,
          busNumber: timesheetData.busNumber,
          entries: timesheetData.entries,
          totals: timesheetData.totals,
        })
        console.log("Timesheet saved to Supabase:", timesheetData)
      } catch (err) {
        console.error("Error submitting timesheet:", err)
      }
    }
    setEmployeeData((prev) => ({ ...prev, timesheetCompleted: true }))
    setView("actionSelect")
  }

  const handleClockOutClick = () => {
    setShowClockOutConfirm(true)
  }

  const handleClockOutConfirm = async () => {
    if (currentTimeEntry) {
      try {
        await clockOut(currentTimeEntry.id)
      } catch (err) {
        console.error("Error clocking out:", err)
      }
    }
    setShowClockOutConfirm(false)
    handleDashboard()
  }

  const handleClockOutCancel = () => {
    setShowClockOutConfirm(false)
  }

  const isLoggedIn = view === "actionSelect" || view === "dvi" || view === "timesheet" || view === "clockout"

  // Clock Out Confirmation Modal
  const ClockOutConfirmModal = () => (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-2xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-white text-2xl sm:text-3xl font-bold text-center mb-6">
          Clock Out?
        </div>
        <div className="text-gray-300 text-center mb-8">
          Are you sure you want to clock out?
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleClockOutCancel}
            className="flex-1 bg-gray-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleClockOutConfirm}
            className="flex-1 bg-[#E31E24] text-white py-4 rounded-xl font-bold text-lg hover:bg-red-700 transition-colors"
          >
            Clock Out
          </button>
        </div>
      </div>
    </div>
  )

  // Shared navbar component for logged-in views
  const LoggedInNavbar = ({ showBackButton = false }: { showBackButton?: boolean }) => (
    <header className="bg-[#E31E24] px-3 sm:px-6 py-3 sm:py-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <button
            onClick={showBackButton ? () => setView("actionSelect") : handleDashboard}
            className="bg-white text-[#E31E24] px-4 sm:px-6 py-2 rounded font-bold text-base sm:text-lg hover:bg-gray-100 flex items-center justify-center gap-2"
          >
            <Home size={18} className="sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">{showBackButton ? "Back" : "Dashboard"}</span>
            <span className="sm:hidden">{showBackButton ? "Back" : "Home"}</span>
          </button>
          {showBackButton && (
            <div className="flex gap-2 sm:gap-4">
              <button
                onClick={handleGoToDvi}
                className={`px-4 sm:px-6 py-2 rounded font-bold text-sm sm:text-lg transition-colors ${
                  employeeData.dviCompleted
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : view === "dvi"
                    ? "bg-[#FFE500] text-black"
                    : "bg-white/20 text-white hover:bg-white/30 border-2 border-white/50"
                }`}
              >
                DVI {employeeData.dviCompleted && "✓"}
              </button>
              <button
                onClick={handleGoToTimesheet}
                className={`px-4 sm:px-6 py-2 rounded font-bold text-sm sm:text-lg transition-colors ${
                  employeeData.timesheetCompleted
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : view === "timesheet"
                    ? "bg-[#FFE500] text-black"
                    : "bg-white/20 text-white hover:bg-white/30 border-2 border-white/50"
                }`}
              >
                TIMESHEET {employeeData.timesheetCompleted && "✓"}
              </button>
              <button
                onClick={handleClockOutClick}
                className="bg-white text-[#E31E24] border-2 border-white px-4 sm:px-6 py-2 rounded font-bold text-sm sm:text-lg hover:bg-gray-100 transition-colors"
              >
                CLOCK OUT
              </button>
            </div>
          )}
        </div>
        {employeeData.clockedIn && (
          <div className="text-white text-lg sm:text-xl font-bold">
            Clocked in at {employeeData.clockInTime}
          </div>
        )}
      </div>
    </header>
  )

  // Action Selection Screen
  if (view === "actionSelect") {
    return (
      <div className="min-h-screen bg-[#D3D3D3] flex flex-col">
        {showClockOutConfirm && <ClockOutConfirmModal />}
        <LoggedInNavbar showBackButton={false} />

        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-4xl">
            <div className="bg-[#1A1A1A] rounded-2xl sm:rounded-3xl p-6 sm:p-12 shadow-2xl">
              {!employeeData.clockedIn ? (
                // NOT CLOCKED IN - Show Clock In button
                <div className="text-center">
                  <div className="text-white text-2xl sm:text-4xl font-bold mb-6 sm:mb-8">
                    You are not clocked in
                  </div>
                  <button
                    onClick={handleClockIn}
                    disabled={isLoading}
                    className="bg-green-500 text-white rounded-xl sm:rounded-2xl py-8 sm:py-12 px-16 sm:px-24 text-2xl sm:text-4xl font-bold hover:bg-green-600 transition-colors shadow-xl active:scale-95 disabled:opacity-50"
                  >
                    {isLoading ? "..." : "CLOCK IN"}
                  </button>
                </div>
              ) : (
                // CLOCKED IN - Show options
                <div className="text-center">
                  <div className="text-white text-xl sm:text-3xl font-bold mb-6 sm:mb-8">
                    What would you like to do?
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    <button
                      onClick={handleGoToDvi}
                      className={`py-8 sm:py-12 px-6 rounded-xl sm:rounded-2xl text-xl sm:text-2xl font-bold transition-colors shadow-xl active:scale-95 ${
                        employeeData.dviCompleted
                          ? "bg-green-500 text-white hover:bg-green-600"
                          : "bg-[#FFE500] text-black hover:bg-yellow-400"
                      }`}
                    >
                      DVI
                      {employeeData.dviCompleted && <span className="block text-sm mt-1">✓ Completed</span>}
                    </button>
                    <button
                      onClick={handleGoToTimesheet}
                      className={`py-8 sm:py-12 px-6 rounded-xl sm:rounded-2xl text-xl sm:text-2xl font-bold transition-colors shadow-xl active:scale-95 ${
                        employeeData.timesheetCompleted
                          ? "bg-green-500 text-white hover:bg-green-600"
                          : "bg-[#FFE500] text-black hover:bg-yellow-400"
                      }`}
                    >
                      TIMESHEET
                      {employeeData.timesheetCompleted && <span className="block text-sm mt-1">✓ Completed</span>}
                    </button>
                    <button
                      onClick={handleClockOutClick}
                      className="bg-white text-[#E31E24] border-4 border-[#E31E24] py-8 sm:py-12 px-6 rounded-xl sm:rounded-2xl text-xl sm:text-2xl font-bold hover:bg-gray-100 transition-colors shadow-xl active:scale-95"
                    >
                      CLOCK OUT
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="bg-[#1A1A1A] text-white py-3 sm:py-4 text-center">
          <div className="text-base sm:text-xl font-bold">VISI2N by Transdev</div>
        </footer>
      </div>
    )
  }

  if (view === "dvi" || view === "timesheet") {
    return (
      <div className="min-h-screen bg-[#D3D3D3] flex flex-col">
        {showClockOutConfirm && <ClockOutConfirmModal />}
        <LoggedInNavbar showBackButton={true} />

        <div className="flex-1 overflow-auto">
          {view === "dvi" ? (
            <DVIFormWrapper onComplete={handleDviComplete} />
          ) : (
            <TimesheetForm clockInTime={employeeData.clockInTime} onSubmit={handleTimesheetComplete} />
          )}
        </div>

        <footer className="bg-[#1A1A1A] text-white py-3 sm:py-4 text-center">
          <div className="text-base sm:text-xl font-bold">VISI2N by Transdev</div>
        </footer>
      </div>
    )
  }

  // Admin Panel View
  if (view === "admin") {
    return (
      <div className="min-h-screen bg-[#D3D3D3] flex flex-col">
        <header className="bg-[#E31E24] px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-4">
          <button
            onClick={handleDashboard}
            className="bg-white text-[#E31E24] px-4 sm:px-6 py-2 rounded font-bold text-base sm:text-lg hover:bg-gray-100 flex items-center gap-2"
          >
            <Home size={18} />
            <span className="hidden sm:inline">Back to Kiosk</span>
            <span className="sm:hidden">Back</span>
          </button>
          <div className="text-white text-xl sm:text-2xl font-bold">Admin Panel</div>
        </header>

        {/* Admin Tabs */}
        <div className="bg-[#1A1A1A] px-3 sm:px-6 py-2 flex gap-2 sm:gap-4 overflow-x-auto">
          {(["dashboard", "employees", "timesheets", "dvi"] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleAdminTabChange(tab)}
              className={`px-4 sm:px-6 py-2 rounded font-bold text-sm sm:text-base whitespace-nowrap transition-colors ${
                adminTab === tab
                  ? "bg-[#E31E24] text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {tab === "dashboard" && "Currently In"}
              {tab === "employees" && "Employees"}
              {tab === "timesheets" && "Timesheets"}
              {tab === "dvi" && "DVI Records"}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {adminLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-xl text-gray-600">Loading...</div>
            </div>
          ) : (
            <>
              {/* Dashboard Tab - Currently Clocked In */}
              {adminTab === "dashboard" && (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Currently Clocked In</h2>
                  {activeClockIns.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow">
                      No employees currently clocked in
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {activeClockIns.map((clockIn) => (
                        <div 
                          key={clockIn.time_entry_id}
                          className="bg-white rounded-xl p-4 shadow border-l-4 border-green-500"
                        >
                          <div className="font-bold text-lg text-gray-800">
                            {clockIn.name}
                          </div>
                          <div className="text-gray-500 text-sm">ID: {clockIn.employee_id}</div>
                          <div className="mt-2 text-sm text-gray-600">
                            Clocked in: {formatAdminDateTime(clockIn.clock_in)}
                          </div>
                          <div className="mt-1 text-green-600 font-mono font-bold">
                            Duration: {clockIn.duration_hours}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Employees Tab */}
              {adminTab === "employees" && (
                <div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Employees</h2>
                    <button
                      onClick={() => {
                        setEditingEmployee(null)
                        setShowEmployeeModal(true)
                      }}
                      className="bg-[#E31E24] text-white px-4 py-2 rounded font-bold hover:bg-red-700 transition"
                    >
                      + Add Employee
                    </button>
                  </div>

                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={employeeSearchTerm}
                      onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                      className="w-full sm:w-64 px-4 py-2 rounded-lg border border-gray-300 focus:border-[#E31E24] focus:outline-none"
                    />
                  </div>

                  <div className="bg-white rounded-xl shadow overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Employee ID</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Name</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                            <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEmployees.map((emp) => (
                            <tr key={emp.id} className="border-t border-gray-200">
                              <td className="px-4 py-3 font-mono text-gray-800">{emp.employee_id}</td>
                              <td className="px-4 py-3 text-gray-800">{emp.name}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                  emp.is_active 
                                    ? "bg-green-100 text-green-700" 
                                    : "bg-red-100 text-red-700"
                                }`}>
                                  {emp.is_active ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => {
                                    setEditingEmployee(emp)
                                    setShowEmployeeModal(true)
                                  }}
                                  className="text-[#E31E24] hover:underline font-bold text-sm"
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Timesheets Tab */}
              {adminTab === "timesheets" && (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Timesheets</h2>
                  
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={adminStartDate}
                        onChange={(e) => {
                          setAdminStartDate(e.target.value)
                          loadAdminData("timesheets")
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#E31E24] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">End Date</label>
                      <input
                        type="date"
                        value={adminEndDate}
                        onChange={(e) => {
                          setAdminEndDate(e.target.value)
                          loadAdminData("timesheets")
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#E31E24] focus:outline-none"
                      />
                    </div>
                  </div>

                  {timesheets.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow">
                      No timesheets found for this date range
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {timesheets
                        .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                        .map((sheet: any) => (
                        <div key={sheet.id} className="bg-white rounded-xl p-4 shadow">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-bold text-lg text-gray-800">
                                {sheet.employees?.name || sheet.operator_name || "Unknown"}
                              </div>
                              <div className="text-gray-500 text-sm">
                                {new Date(sheet.date).toLocaleDateString()} • Bus #{sheet.bus_number || "-"}
                              </div>
                              {sheet.check_in && sheet.check_out && (
                                <div className="text-gray-500 text-sm">
                                  Check-in: {sheet.check_in} • Check-out: {sheet.check_out}
                                </div>
                              )}
                            </div>
                            <div className="text-right flex flex-col items-end gap-2">
                              <div>
                                <div className="text-sm text-gray-500">Total Hours</div>
                                <div className="font-bold text-xl text-[#E31E24]">
                                  {sheet.totals?.totalHours || "0"}
                                </div>
                              </div>
                              <button
                                onClick={() => setSelectedTimesheet(sheet)}
                                className="text-[#E31E24] hover:underline text-sm font-semibold"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                          
                          {sheet.entries && sheet.entries.length > 0 && (
                            <div className="border-t border-gray-200 pt-3 mt-3">
                              <div className="grid grid-cols-4 gap-2 text-sm text-gray-500 mb-2">
                                <div>Work Order</div>
                                <div>Description</div>
                                <div>ST</div>
                                <div>OT</div>
                              </div>
                              {sheet.entries.slice(0, 3).map((entry: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-4 gap-2 text-sm py-1 text-gray-700">
                                  <div className="font-mono">{entry.workOrder || "-"}</div>
                                  <div className="truncate">{entry.description || "-"}</div>
                                  <div>{entry.straightTime || "0"}</div>
                                  <div>{entry.overTime || "0"}</div>
                                </div>
                              ))}
                              {sheet.entries.length > 3 && (
                                <div className="text-sm text-gray-400 mt-1">
                                  +{sheet.entries.length - 3} more entries
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {/* Pagination */}
                      {timesheets.length > ITEMS_PER_PAGE && (
                        <div className="flex justify-center items-center gap-4 mt-4">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
                          >
                            Previous
                          </button>
                          <span className="text-gray-600">
                            Page {currentPage} of {Math.ceil(timesheets.length / ITEMS_PER_PAGE)}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(timesheets.length / ITEMS_PER_PAGE), p + 1))}
                            disabled={currentPage >= Math.ceil(timesheets.length / ITEMS_PER_PAGE)}
                            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* DVI Records Tab */}
              {adminTab === "dvi" && (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">DVI Records</h2>
                  
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={adminStartDate}
                        onChange={(e) => {
                          setAdminStartDate(e.target.value)
                          loadAdminData("dvi")
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#E31E24] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">End Date</label>
                      <input
                        type="date"
                        value={adminEndDate}
                        onChange={(e) => {
                          setAdminEndDate(e.target.value)
                          loadAdminData("dvi")
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#E31E24] focus:outline-none"
                      />
                    </div>
                  </div>

                  {dviRecords.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow">
                      No DVI records found for this date range
                    </div>
                  ) : (
                    <>
                      <div className="bg-white rounded-xl shadow overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Date</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Employee</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Vehicle</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Type</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                                <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dviRecords
                                .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                                .map((record: any) => (
                                <tr key={record.id} className="border-t border-gray-200 hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-800">
                                    {new Date(record.inspection_date).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 text-gray-800">
                                    {record.employees?.name || "Unknown"}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-gray-800">
                                    {record.vehicle_number || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-gray-800 capitalize">
                                    {record.inspection_type || "-"}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                      record.is_passed 
                                        ? "bg-green-100 text-green-700" 
                                        : "bg-red-100 text-red-700"
                                    }`}>
                                      {record.is_passed ? "Passed" : "Failed"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => setSelectedDviRecord(record)}
                                      className="text-[#E31E24] hover:underline text-sm font-semibold"
                                    >
                                      View Details
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      
                      {/* Pagination */}
                      {dviRecords.length > ITEMS_PER_PAGE && (
                        <div className="flex justify-center items-center gap-4 mt-4">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
                          >
                            Previous
                          </button>
                          <span className="text-gray-600">
                            Page {currentPage} of {Math.ceil(dviRecords.length / ITEMS_PER_PAGE)}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(dviRecords.length / ITEMS_PER_PAGE), p + 1))}
                            disabled={currentPage >= Math.ceil(dviRecords.length / ITEMS_PER_PAGE)}
                            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </main>

        <footer className="bg-[#1A1A1A] text-white py-3 sm:py-4 text-center">
          <div className="text-base sm:text-xl font-bold">VISI2N by Transdev</div>
        </footer>

        {/* Employee Modal */}
        {showEmployeeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingEmployee ? "Edit Employee" : "Add Employee"}
              </h3>
              <EmployeeForm
                employee={editingEmployee}
                onSave={handleSaveEmployee}
                onCancel={() => {
                  setShowEmployeeModal(false)
                  setEditingEmployee(null)
                }}
              />
            </div>
          </div>
        )}

        {/* DVI Detail Modal */}
        {selectedDviRecord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">DVI Inspection Details</h3>
                <button
                  onClick={() => setSelectedDviRecord(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Date</div>
                    <div className="font-semibold">{new Date(selectedDviRecord.inspection_date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Employee</div>
                    <div className="font-semibold">{(selectedDviRecord as any).employees?.name || "Unknown"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Vehicle Number</div>
                    <div className="font-semibold font-mono">{(selectedDviRecord as any).vehicle_number || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Inspection Type</div>
                    <div className="font-semibold capitalize">{selectedDviRecord.inspection_type || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Status</div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      selectedDviRecord.is_passed 
                        ? "bg-green-100 text-green-700" 
                        : "bg-red-100 text-red-700"
                    }`}>
                      {selectedDviRecord.is_passed ? "Passed" : "Failed"}
                    </span>
                  </div>
                </div>

                {selectedDviRecord.inspection_data && Object.keys(selectedDviRecord.inspection_data).length > 0 && (
                  <div>
                    <div className="text-sm text-gray-500 mb-2 font-semibold">Inspection Items</div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {Object.entries(selectedDviRecord.inspection_data).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center py-1 border-b border-gray-200 last:border-0">
                          <span className="text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className={`font-semibold ${
                            value === true || value === 'pass' || value === 'ok' 
                              ? 'text-green-600' 
                              : value === false || value === 'fail' 
                                ? 'text-red-600' 
                                : 'text-gray-800'
                          }`}>
                            {typeof value === 'boolean' ? (value ? '✓ Pass' : '✗ Fail') : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedDviRecord.notes && (
                  <div>
                    <div className="text-sm text-gray-500 mb-2 font-semibold">Notes</div>
                    <div className="bg-gray-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">
                      {selectedDviRecord.notes}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedDviRecord(null)}
                className="mt-6 w-full bg-[#E31E24] text-white py-3 rounded-lg font-bold hover:bg-red-700"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Timesheet Detail Modal */}
        {selectedTimesheet && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 w-full max-w-3xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">Timesheet Details</h3>
                <button
                  onClick={() => setSelectedTimesheet(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Date</div>
                    <div className="font-semibold">{new Date(selectedTimesheet.date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Employee</div>
                    <div className="font-semibold">{(selectedTimesheet as any).employees?.name || selectedTimesheet.operator_name || "Unknown"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Bus Number</div>
                    <div className="font-semibold font-mono">{selectedTimesheet.bus_number || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Check-in</div>
                    <div className="font-semibold">{selectedTimesheet.check_in || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Check-out</div>
                    <div className="font-semibold">{selectedTimesheet.check_out || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Break Windows</div>
                    <div className="font-semibold">{selectedTimesheet.brk_windows || "-"}</div>
                  </div>
                </div>

                {selectedTimesheet.entries && selectedTimesheet.entries.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-500 mb-2 font-semibold">Work Entries ({selectedTimesheet.entries.length} total)</div>
                    <div className="bg-gray-50 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left">Work Order</th>
                            <th className="px-3 py-2 text-left">Description</th>
                            <th className="px-3 py-2 text-center">ST</th>
                            <th className="px-3 py-2 text-center">OT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTimesheet.entries.map((entry: any, idx: number) => (
                            <tr key={idx} className="border-t border-gray-200">
                              <td className="px-3 py-2 font-mono">{entry.workOrder || "-"}</td>
                              <td className="px-3 py-2">{entry.description || "-"}</td>
                              <td className="px-3 py-2 text-center">{entry.straightTime || "0"}</td>
                              <td className="px-3 py-2 text-center">{entry.overTime || "0"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedTimesheet.totals && (
                  <div>
                    <div className="text-sm text-gray-500 mb-2 font-semibold">Totals</div>
                    <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[#E31E24]">{selectedTimesheet.totals.totalHours || "0"}</div>
                        <div className="text-xs text-gray-500">Total Hours</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-800">{selectedTimesheet.totals.straightTime || "0"}</div>
                        <div className="text-xs text-gray-500">Straight Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-800">{selectedTimesheet.totals.overTime || "0"}</div>
                        <div className="text-xs text-gray-500">Overtime</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-800">{selectedTimesheet.totals.breakHours || "0"}</div>
                        <div className="text-xs text-gray-500">Break Hours</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedTimesheet(null)}
                className="mt-6 w-full bg-[#E31E24] text-white py-3 rounded-lg font-bold hover:bg-red-700"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#D3D3D3] flex flex-col">
      <header className="bg-[#E31E24] px-3 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
        <button
          onClick={(view === "employeeIdEntry" || view === "adminLogin") ? handleDashboard : undefined}
          disabled={view === "login"}
          className={`px-4 sm:px-6 py-2 rounded font-bold text-base sm:text-lg flex items-center justify-center gap-2 ${
            view === "login"
              ? "bg-white/50 text-white cursor-not-allowed"
              : "bg-white text-[#E31E24] hover:bg-gray-100 cursor-pointer"
          }`}
        >
          <Home size={18} className="sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Dashboard</span>
          <span className="sm:hidden">Home</span>
        </button>
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
          <div className="flex-1"></div>
          <div className="flex gap-2 sm:gap-4">
            <button
              onClick={handleIdCardLogin}
              className="flex-1 sm:flex-none bg-[#FFE500] text-black px-4 sm:px-8 py-2 rounded font-bold text-sm sm:text-lg hover:bg-yellow-400 whitespace-nowrap"
            >
              DRIVER
            </button>
            <button
              onClick={handleAdminLoginClick}
              className="flex-1 sm:flex-none bg-[#FFE500] text-black px-4 sm:px-8 py-2 rounded font-bold text-sm sm:text-lg hover:bg-yellow-400 whitespace-nowrap"
            >
              ADMIN
            </button>
          </div>
        </div>
      </header>

      <div className="bg-[#E31E24] text-white px-3 sm:px-6 py-2 sm:py-3 text-center">
        <div className="text-base sm:text-xl font-bold">STATION ID: KIOSK-001</div>
      </div>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {view === "login" && (
          <div className="w-full max-w-4xl">
            <div className="bg-[#1A1A1A] rounded-2xl sm:rounded-3xl p-6 sm:p-12 shadow-2xl">
              <div className="text-center">
                <div className="text-white text-4xl sm:text-6xl md:text-8xl font-bold font-mono tracking-wider mb-2 sm:mb-4">
                  {formatTime(currentTime)}
                </div>
                <div className="text-gray-400 text-lg sm:text-2xl font-semibold">{formatDate(currentTime)}</div>
              </div>
            </div>
          </div>
        )}

        {view === "employeeIdEntry" && (
          <div className="w-full max-w-4xl px-2">
            <div className="bg-[#1A1A1A] rounded-2xl sm:rounded-3xl p-6 sm:p-12 mb-6 sm:mb-8 shadow-2xl">
              <div className="text-center mb-4 sm:mb-6">
                <div className="text-gray-400 text-lg sm:text-2xl mb-3 sm:mb-4">Enter Employee ID</div>
                <div className="bg-white rounded-xl p-4 sm:p-6 min-h-[80px] sm:min-h-[100px] flex items-center justify-center">
                  <div className="text-4xl sm:text-6xl font-bold font-mono tracking-widest text-black">
                    {enteredId || "—"}
                  </div>
                </div>
                {error && (
                  <div className="mt-4 text-red-500 text-lg font-semibold">
                    {error}
                  </div>
                )}
                {isLoading && (
                  <div className="mt-4 text-yellow-400 text-lg font-semibold animate-pulse">
                    Logging in...
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeypadPress(digit.toString())}
                  className="bg-white text-black rounded-xl sm:rounded-2xl py-8 sm:py-12 text-3xl sm:text-5xl font-bold hover:bg-gray-200 transition-colors shadow-lg active:scale-95"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={handleClear}
                className="bg-[#E31E24] text-white rounded-xl sm:rounded-2xl py-8 sm:py-12 text-xl sm:text-3xl font-bold hover:bg-red-700 transition-colors shadow-lg active:scale-95"
              >
                CLEAR
              </button>
              <button
                onClick={() => handleKeypadPress("0")}
                className="bg-white text-black rounded-xl sm:rounded-2xl py-8 sm:py-12 text-3xl sm:text-5xl font-bold hover:bg-gray-200 transition-colors shadow-lg active:scale-95"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                className="bg-gray-600 text-white rounded-xl sm:rounded-2xl py-8 sm:py-12 flex items-center justify-center hover:bg-gray-700 transition-colors shadow-lg active:scale-95"
              >
                <Delete size={32} className="sm:w-12 sm:h-12" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <button
                onClick={handleCancelIdEntry}
                disabled={isLoading}
                className="bg-gray-600 text-white rounded-xl sm:rounded-2xl py-8 sm:py-12 text-xl sm:text-3xl font-bold hover:bg-gray-700 transition-colors shadow-lg active:scale-95 disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmitEmployeeId}
                disabled={enteredId.length === 0 || isLoading}
                className="bg-[#FFE500] text-black rounded-xl sm:rounded-2xl py-8 sm:py-12 text-xl sm:text-3xl font-bold hover:bg-yellow-400 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {isLoading ? "..." : "SUBMIT"}
              </button>
            </div>
          </div>
        )}

        {view === "adminLogin" && (
          <div className="w-full max-w-4xl px-2">
            <div className="bg-[#1A1A1A] rounded-2xl sm:rounded-3xl p-6 sm:p-12 mb-6 sm:mb-8 shadow-2xl">
              <div className="text-center mb-4 sm:mb-6">
                <div className="text-gray-400 text-lg sm:text-2xl mb-3 sm:mb-4">Enter Admin PIN</div>
                <div className="bg-white rounded-xl p-4 sm:p-6 min-h-[80px] sm:min-h-[100px] flex items-center justify-center">
                  <div className="text-4xl sm:text-6xl font-bold font-mono tracking-widest text-black">
                    {adminPin ? "•".repeat(adminPin.length) : "—"}
                  </div>
                </div>
                {adminPinError && (
                  <div className="mt-4 text-red-500 text-lg font-semibold">
                    {adminPinError}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  onClick={() => adminPin.length < 10 && setAdminPin(adminPin + digit.toString())}
                  className="bg-white text-black rounded-xl sm:rounded-2xl py-8 sm:py-12 text-3xl sm:text-5xl font-bold hover:bg-gray-200 transition-colors shadow-lg active:scale-95"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => setAdminPin("")}
                className="bg-[#E31E24] text-white rounded-xl sm:rounded-2xl py-8 sm:py-12 text-xl sm:text-3xl font-bold hover:bg-red-700 transition-colors shadow-lg active:scale-95"
              >
                CLEAR
              </button>
              <button
                onClick={() => adminPin.length < 10 && setAdminPin(adminPin + "0")}
                className="bg-white text-black rounded-xl sm:rounded-2xl py-8 sm:py-12 text-3xl sm:text-5xl font-bold hover:bg-gray-200 transition-colors shadow-lg active:scale-95"
              >
                0
              </button>
              <button
                onClick={() => setAdminPin(adminPin.slice(0, -1))}
                className="bg-gray-600 text-white rounded-xl sm:rounded-2xl py-8 sm:py-12 flex items-center justify-center hover:bg-gray-700 transition-colors shadow-lg active:scale-95"
              >
                <Delete size={32} className="sm:w-12 sm:h-12" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <button
                onClick={handleDashboard}
                className="bg-gray-600 text-white rounded-xl sm:rounded-2xl py-8 sm:py-12 text-xl sm:text-3xl font-bold hover:bg-gray-700 transition-colors shadow-lg active:scale-95"
              >
                CANCEL
              </button>
              <button
                onClick={handleAdminPinSubmit}
                disabled={adminPin.length === 0}
                className="bg-[#FFE500] text-black rounded-xl sm:rounded-2xl py-8 sm:py-12 text-xl sm:text-3xl font-bold hover:bg-yellow-400 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                LOGIN
              </button>
            </div>
          </div>
        )}

        {view === "clockout" && (
          <div className="w-full max-w-4xl text-center px-4">
            <div className="bg-[#1A1A1A] rounded-2xl sm:rounded-3xl p-6 sm:p-12 mb-6 sm:mb-8 shadow-2xl">
              <div className="text-white text-2xl sm:text-5xl font-bold mb-4 sm:mb-6">
                Welcome Back, {employeeData.name}!
              </div>
              <div className="text-gray-400 text-lg sm:text-2xl mb-3 sm:mb-4">
                Clocked In: {employeeData.clockInTime}
              </div>
              <div className="text-green-400 text-base sm:text-xl">✓ DVI Completed</div>
            </div>

            <button
              onClick={handleClockOutClick}
              className="bg-[#E31E24] text-white rounded-xl sm:rounded-2xl py-10 sm:py-16 px-16 sm:px-24 text-2xl sm:text-4xl font-bold hover:bg-red-700 transition-colors shadow-xl active:scale-95"
            >
              CLOCK OUT
            </button>
          </div>
        )}
      </main>

      <footer className="bg-[#1A1A1A] text-white py-3 sm:py-4 text-center">
        <div className="text-base sm:text-xl font-bold">VISI2N by Transdev</div>
      </footer>
    </div>
  )
}

function DVIFormWrapper({ onComplete }: { onComplete: (data?: Record<string, any>) => void }) {
  const handleDviSubmit = (data: Record<string, any>) => {
    onComplete(data)
  }

  return <DVIForm onSubmit={handleDviSubmit} />
}

// Employee Form Component for Admin
function EmployeeForm({
  employee,
  onSave,
  onCancel,
}: {
  employee: Employee | null
  onSave: (data: any) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    employee_id: employee?.employee_id || "",
    name: employee?.name || "",
    pin: "",
    is_active: employee?.is_active ?? true,
  })
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.employee_id || !formData.name) {
      setError("Please fill in all required fields")
      return
    }
    
    if (!employee && !formData.pin) {
      setError("PIN is required for new employees")
      return
    }

    if (formData.pin && formData.pin.length !== 4) {
      setError("PIN must be 4 digits")
      return
    }

    const dataToSave = { ...formData }
    if (!formData.pin) {
      delete (dataToSave as any).pin
    }
    
    onSave(dataToSave)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">Employee ID *</label>
        <input
          type="text"
          value={formData.employee_id}
          onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#E31E24] focus:outline-none"
          disabled={!!employee}
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#E31E24] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">
          PIN {employee ? "(leave blank to keep current)" : "*"}
        </label>
        <input
          type="password"
          value={formData.pin}
          onChange={(e) => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          placeholder="4-digit PIN"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#E31E24] focus:outline-none"
          maxLength={4}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          className="w-4 h-4"
        />
        <label htmlFor="is_active" className="text-sm text-gray-700">Active Employee</label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-bold"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-[#E31E24] text-white rounded-lg hover:bg-red-700 transition font-bold"
        >
          Save
        </button>
      </div>
    </form>
  )
}
