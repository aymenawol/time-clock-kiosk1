"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, Delete, Home, FileText, ChevronDown, ChevronUp, Bell, X, ArrowLeft } from 'lucide-react'
import DVIForm from "@/components/dvi-form"
import TimesheetForm from "@/components/timesheet-form"
import IncidentReportForm from "@/components/incident-report-form"
import TimeOffRequestForm from "@/components/time-off-request-form"
import OvertimeRequestForm from "@/components/overtime-request-form"
import FmlaConversionForm from "@/components/fmla-conversion-form"
import SafetyMeetingSchedule from "@/components/safety-meeting-schedule"
import type { SafetyMeetingScheduleData } from "@/components/safety-meeting-schedule"
import { getSupabase } from "@/lib/supabase"
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
  submitIncidentReport,
  getIncidentReports,
  updateIncidentReportStatus,
  submitTimeOffRequest,
  getTimeOffRequests,
  updateTimeOffRequestStatus,
  submitOvertimeRequest,
  getOvertimeRequests,
  updateOvertimeRequestStatus,
  submitFmlaConversion,
  getFmlaConversions,
  updateFmlaConversionStatus,
  getSafetyMeetingSchedules,
  createSafetyMeetingSchedule,
  updateSafetyMeetingSchedule,
  deleteSafetyMeetingSchedule,
  generateNewShareToken,
} from "@/lib/api"
import type { Employee, TimeEntry, ActiveClockIn, Timesheet, DviRecord, IncidentReport, TimeOffRequest, OvertimeRequest, FmlaConversionRequest, SafetyMeetingSchedule as SafetyMeetingScheduleType } from "@/lib/supabase"

type ViewState = "login" | "employeeIdEntry" | "actionSelect" | "dvi" | "timesheet" | "clockout" | "admin" | "adminLogin" | "incidentReport" | "timeOffRequest" | "overtimeRequest" | "fmlaConversion" | "safetySchedules"
type FormType = "dvi" | "timesheet"
type OptionalFormType = "incidentReport" | "timeOffRequest" | "overtimeRequest" | "fmlaConversion"
type AdminTab = "dashboard" | "employees" | "timesheets" | "dvi" | "incidents" | "timeoff" | "overtime" | "fmla" | "safety"

// Notification type for real-time form submissions
type FormNotification = {
  id: string
  type: 'dvi' | 'timesheet' | 'incident' | 'timeoff' | 'overtime' | 'fmla'
  employeeName: string
  timestamp: Date
  recordId: string
}

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
    lunchWaiver: false,
    expectedClockOut: "",
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
  const [showAdditionalForms, setShowAdditionalForms] = useState(false)

  // Optional forms admin state
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([])
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([])
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [fmlaConversions, setFmlaConversions] = useState<FmlaConversionRequest[]>([])
  const [selectedIncidentReport, setSelectedIncidentReport] = useState<IncidentReport | null>(null)
  const [selectedTimeOffRequest, setSelectedTimeOffRequest] = useState<TimeOffRequest | null>(null)
  const [selectedOvertimeRequest, setSelectedOvertimeRequest] = useState<OvertimeRequest | null>(null)
  const [selectedFmlaConversion, setSelectedFmlaConversion] = useState<FmlaConversionRequest | null>(null)
  const [showFormsDropdown, setShowFormsDropdown] = useState(false)
  const formsButtonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })

  // Safety Meeting Schedule state
  const [safetyMeetingSchedules, setSafetyMeetingSchedules] = useState<SafetyMeetingScheduleType[]>([])
  const [selectedSafetySchedule, setSelectedSafetySchedule] = useState<SafetyMeetingScheduleType | null>(null)
  const [showCreateSchedule, setShowCreateSchedule] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [deleteConfirmSchedule, setDeleteConfirmSchedule] = useState<SafetyMeetingScheduleType | null>(null)
  const [safetyFilterMonth, setSafetyFilterMonth] = useState<string>('')
  const [safetyFilterYear, setSafetyFilterYear] = useState<string>('')
  const [lunchWaiverChecked, setLunchWaiverChecked] = useState(false)

  // Real-time notifications state
  const [notifications, setNotifications] = useState<FormNotification[]>([])
  const notificationTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

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

  // Function to add a notification
  const addNotification = useCallback((notification: FormNotification) => {
    setNotifications(prev => [notification, ...prev].slice(0, 10)) // Keep max 10 notifications
    
    // Auto-dismiss after 15 seconds
    const timeout = setTimeout(() => {
      dismissNotification(notification.id)
    }, 15000)
    
    notificationTimeoutRef.current.set(notification.id, timeout)
  }, [])

  // Function to dismiss a notification
  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    const timeout = notificationTimeoutRef.current.get(id)
    if (timeout) {
      clearTimeout(timeout)
      notificationTimeoutRef.current.delete(id)
    }
  }, [])

  // Function to handle notification click - navigate to appropriate tab
  const handleNotificationClick = useCallback((notification: FormNotification) => {
    const tabMap: Record<FormNotification['type'], AdminTab> = {
      'dvi': 'dvi',
      'timesheet': 'timesheets',
      'incident': 'incidents',
      'timeoff': 'timeoff',
      'overtime': 'overtime',
      'fmla': 'fmla'
    }
    const tab = tabMap[notification.type]
    handleAdminTabChange(tab)
    dismissNotification(notification.id)
  }, [])

  // Set up Supabase realtime subscriptions when in admin view
  useEffect(() => {
    if (view !== "admin") return

    const supabase = getSupabase()
    console.log("Setting up realtime subscriptions...")
    
    // Subscribe to DVI records
    const dviChannel = supabase
      .channel('dvi-inserts')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'dvi_records' 
      }, (payload) => {
        console.log("DVI record inserted:", payload)
        const record = payload.new as any
        addNotification({
          id: `dvi-${record.id}`,
          type: 'dvi',
          employeeName: record.vehicle_id || 'Driver',
          timestamp: new Date(),
          recordId: record.id
        })
        // Refresh DVI data if on that tab
        if (adminTab === 'dvi') loadAdminData('dvi')
      })
      .subscribe((status) => {
        console.log("DVI channel status:", status)
      })

    // Subscribe to Timesheets
    const timesheetChannel = supabase
      .channel('timesheet-inserts')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'timesheets' 
      }, (payload) => {
        console.log("Timesheet inserted:", payload)
        const record = payload.new as any
        addNotification({
          id: `timesheet-${record.id}`,
          type: 'timesheet',
          employeeName: record.operator_name || 'Driver',
          timestamp: new Date(),
          recordId: record.id
        })
        if (adminTab === 'timesheets') loadAdminData('timesheets')
      })
      .subscribe((status) => {
        console.log("Timesheet channel status:", status)
      })

    // Subscribe to Incident Reports
    const incidentChannel = supabase
      .channel('incident-inserts')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'incident_reports' 
      }, (payload) => {
        const record = payload.new as any
        addNotification({
          id: `incident-${record.id}`,
          type: 'incident',
          employeeName: record.employee_name || 'Driver',
          timestamp: new Date(),
          recordId: record.id
        })
        if (adminTab === 'incidents') loadAdminData('incidents')
      })
      .subscribe()

    // Subscribe to Time Off Requests
    const timeoffChannel = supabase
      .channel('timeoff-inserts')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'time_off_requests' 
      }, (payload) => {
        const record = payload.new as any
        addNotification({
          id: `timeoff-${record.id}`,
          type: 'timeoff',
          employeeName: record.employee_name || 'Driver',
          timestamp: new Date(),
          recordId: record.id
        })
        if (adminTab === 'timeoff') loadAdminData('timeoff')
      })
      .subscribe()

    // Subscribe to Overtime Requests
    const overtimeChannel = supabase
      .channel('overtime-inserts')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'overtime_requests' 
      }, (payload) => {
        const record = payload.new as any
        addNotification({
          id: `overtime-${record.id}`,
          type: 'overtime',
          employeeName: record.employee_name || 'Driver',
          timestamp: new Date(),
          recordId: record.id
        })
        if (adminTab === 'overtime') loadAdminData('overtime')
      })
      .subscribe()

    // Subscribe to FMLA Conversions
    const fmlaChannel = supabase
      .channel('fmla-inserts')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'fmla_conversions' 
      }, (payload) => {
        const record = payload.new as any
        addNotification({
          id: `fmla-${record.id}`,
          type: 'fmla',
          employeeName: record.employee_name || 'Driver',
          timestamp: new Date(),
          recordId: record.id
        })
        if (adminTab === 'fmla') loadAdminData('fmla')
      })
      .subscribe()

    // Cleanup subscriptions on unmount or view change
    return () => {
      supabase.removeChannel(dviChannel)
      supabase.removeChannel(timesheetChannel)
      supabase.removeChannel(incidentChannel)
      supabase.removeChannel(timeoffChannel)
      supabase.removeChannel(overtimeChannel)
      supabase.removeChannel(fmlaChannel)
    }
  }, [view, adminTab, addNotification])

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--:--'
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
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
      lunchWaiver: false,
      expectedClockOut: "",
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
      } else if (tab === "incidents") {
        const reports = await getIncidentReports(adminStartDate, adminEndDate)
        setIncidentReports(reports)
      } else if (tab === "timeoff") {
        const requests = await getTimeOffRequests(adminStartDate, adminEndDate)
        setTimeOffRequests(requests)
      } else if (tab === "overtime") {
        const requests = await getOvertimeRequests(adminStartDate, adminEndDate)
        setOvertimeRequests(requests)
      } else if (tab === "fmla") {
        const requests = await getFmlaConversions(adminStartDate, adminEndDate)
        setFmlaConversions(requests)
      } else if (tab === "safety") {
        const schedules = await getSafetyMeetingSchedules()
        setSafetyMeetingSchedules(schedules)
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
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
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
      
      // Block admin PIN on driver keypad (generic error)
      if (enteredId === ADMIN_PIN) {
        setError("Employee not found. Please check your ID.")
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
        
        // Admin-only accounts can't use the driver keypad
        if ((employee as any).is_admin && !(employee as any).is_driver) {
          setError("Employee not found. Please check your ID.")
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
          lunchWaiver: existingTimeEntry?.lunch_waiver || false,
          expectedClockOut: existingTimeEntry?.expected_clock_out ? formatClockTime(existingTimeEntry.expected_clock_out) : "",
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
      const timeEntry = await clockIn(currentEmployee.id, lunchWaiverChecked)
      if (timeEntry) {
        setCurrentTimeEntry(timeEntry)
        setEmployeeData(prev => ({
          ...prev,
          clockedIn: true,
          clockInTime: formatClockTime(timeEntry.clock_in_time),
          lunchWaiver: timeEntry.lunch_waiver,
          expectedClockOut: timeEntry.expected_clock_out ? formatClockTime(timeEntry.expected_clock_out) : "",
        }))
        // Reset lunch waiver checkbox for next clock-in
        setLunchWaiverChecked(false)
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

  // Optional form navigation handlers
  const handleGoToIncidentReport = () => {
    setView("incidentReport")
  }

  const handleGoToTimeOffRequest = () => {
    setView("timeOffRequest")
  }

  const handleGoToOvertimeRequest = () => {
    setView("overtimeRequest")
  }

  const handleGoToFmlaConversion = () => {
    setView("fmlaConversion")
  }

  // Optional form submission handlers
  const handleIncidentReportSubmit = async (data?: Record<string, any>) => {
    if (!currentEmployee || !data) {
      setView("actionSelect")
      return
    }
    
    try {
      await submitIncidentReport(currentEmployee.id, {
        employee_name: data.employeeName || employeeData.name,
        incident_date: data.incidentDate,
        incident_time: data.incidentTime,
        incident_location: data.incidentLocation,
        bus_number: data.busNumber,
        supervisor_contacted: data.supervisorContacted,
        details: data.detailsOfEvent || data.details,
        witnesses: data.witnesses,
        passenger_name: data.passengerName,
        passenger_address: data.passengerAddress,
        passenger_city_state_zip: data.passengerCityStateZip,
        passenger_phone: data.passengerPhone,
      })
      alert("Incident report submitted successfully!")
    } catch (err) {
      console.error("Error submitting incident report:", err)
      alert("Error submitting form. Please try again.")
    }
    setView("actionSelect")
  }

  const handleTimeOffRequestSubmit = async (data?: Record<string, any>) => {
    if (!currentEmployee || !data) {
      setView("actionSelect")
      return
    }
    
    try {
      // Determine request type from form checkboxes
      let requestType: 'vacation_pto' | 'bereavement' | 'birthday' | 'jury_duty' = 'vacation_pto'
      if (data.juryDuty) requestType = 'jury_duty'
      else if (data.bereavement) requestType = 'bereavement'
      else if (data.birthday) requestType = 'birthday'
      
      // Get dates from requestedDates array
      const datesRequested = (data.requestedDates || []).filter((d: string) => d !== "")
      
      await submitTimeOffRequest(currentEmployee.id, {
        employee_name: data.employeeName || employeeData.name,
        mailbox_number: data.mailboxNumber,
        start_time: data.startTime,
        dates_requested: datesRequested,
        request_type: requestType,
      })
      alert("Time off request submitted successfully!")
    } catch (err) {
      console.error("Error submitting time off request:", err)
      alert("Error submitting form. Please try again.")
    }
    setView("actionSelect")
  }

  const handleOvertimeRequestSubmit = async (data?: Record<string, any>) => {
    if (!currentEmployee || !data) {
      setView("actionSelect")
      return
    }
    
    try {
      // Get the first shift entry from the shifts array
      const firstShift = data.shifts?.[0] || {}
      
      await submitOvertimeRequest(currentEmployee.id, {
        employee_name: data.employeeName || employeeData.name,
        seniority_number: data.seniorityNumber,
        shift_number: firstShift.shiftNumber || data.shiftNumber,
        shift_date: firstShift.dateOfShift || data.shiftDate,
        start_time: firstShift.startTime || data.startTime,
        end_time: firstShift.endTime || data.endTime,
        pay_hours: firstShift.payHours || data.payHours,
        dispatcher_name: data.dispatcherName,
      })
      alert("Overtime request submitted successfully!")
    } catch (err) {
      console.error("Error submitting overtime request:", err)
      alert("Error submitting form. Please try again.")
    }
    setView("actionSelect")
  }

  const handleFmlaConversionSubmit = async (data?: Record<string, any>) => {
    if (!currentEmployee || !data) {
      setView("actionSelect")
      return
    }
    
    try {
      // Extract dates and vacation pay choices from fmlaDates array
      const fmlaDates = data.fmlaDates || []
      const datesToConvert = fmlaDates.map((d: any) => d.date).filter((d: string) => d !== "")
      const useVacationPay = fmlaDates.map((d: any) => d.useVacationPay === true)
      
      await submitFmlaConversion(currentEmployee.id, {
        employee_name: data.employeeName || employeeData.name,
        mailbox_number: data.mailboxNumber,
        dates_to_convert: datesToConvert,
        use_vacation_pay: useVacationPay.slice(0, datesToConvert.length),
      })
      alert("FMLA conversion form submitted successfully!")
    } catch (err) {
      console.error("Error submitting FMLA conversion:", err)
      alert("Error submitting form. Please try again.")
    }
    setView("actionSelect")
  }

  const handleOptionalFormCancel = () => {
    setView("actionSelect")
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

  const isLoggedIn = view === "actionSelect" || view === "dvi" || view === "timesheet" || view === "clockout" || view === "incidentReport" || view === "timeOffRequest" || view === "overtimeRequest" || view === "fmlaConversion" || view === "safetySchedules"

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
          <div className="text-white text-sm sm:text-lg font-bold flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <span>Clocked in at {employeeData.clockInTime}</span>
            {employeeData.expectedClockOut && (
              <span className="text-[#FFE500]">
                • Expected out: {employeeData.expectedClockOut}
                {employeeData.lunchWaiver && " (Lunch Waived)"}
              </span>
            )}
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
                // NOT CLOCKED IN - Show Clock In button with lunch waiver option
                <div className="text-center">
                  <div className="text-white text-2xl sm:text-4xl font-bold mb-6 sm:mb-8">
                    You are not clocked in
                  </div>
                  
                  <button
                    onClick={handleClockIn}
                    disabled={isLoading}
                    className="bg-green-500 text-white rounded-xl sm:rounded-2xl py-8 sm:py-12 px-16 sm:px-24 text-2xl sm:text-4xl font-bold hover:bg-green-600 transition-colors shadow-xl active:scale-95 disabled:opacity-50 mb-6"
                  >
                    {isLoading ? "..." : "CLOCK IN"}
                  </button>

                  {/* Lunch Waiver - Simple checkbox below button */}
                  <div className="max-w-md mx-auto">
                    <label className="flex items-center justify-center gap-3 cursor-pointer text-white">
                      <input
                        type="checkbox"
                        checked={lunchWaiverChecked}
                        onChange={(e) => setLunchWaiverChecked(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-400 text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                      />
                      <span className="text-base sm:text-lg">
                        Lunch Waiver <span className="text-gray-400 text-sm">({lunchWaiverChecked ? "8 hrs" : "8.5 hrs with lunch"})</span>
                      </span>
                    </label>
                  </div>
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

                  {/* Forms & Resources Section */}
                  <div className="mt-8 sm:mt-10 pt-6 border-t border-gray-600">
                    <button
                      onClick={() => setShowAdditionalForms(!showAdditionalForms)}
                      className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors py-2"
                    >
                      <FileText size={20} />
                      <span className="text-lg font-semibold">Forms & Resources</span>
                      {showAdditionalForms ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    
                    {showAdditionalForms && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            loadAdminData("safety")
                            setView("safetySchedules")
                          }}
                          className="bg-yellow-600 text-white py-4 px-4 rounded-xl font-semibold hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base sm:col-span-2"
                        >
                          <FileText size={18} />
                          View Safety Meeting Schedules
                        </button>
                        <button
                          onClick={handleGoToIncidentReport}
                          className="bg-gray-700 text-white py-4 px-4 rounded-xl font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                        >
                          <FileText size={18} />
                          Incident Report
                        </button>
                        <button
                          onClick={handleGoToTimeOffRequest}
                          className="bg-gray-700 text-white py-4 px-4 rounded-xl font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                        >
                          <FileText size={18} />
                          Time Off Request
                        </button>
                        <button
                          onClick={handleGoToOvertimeRequest}
                          className="bg-gray-700 text-white py-4 px-4 rounded-xl font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                        >
                          <FileText size={18} />
                          Overtime Request
                        </button>
                        <button
                          onClick={handleGoToFmlaConversion}
                          className="bg-gray-700 text-white py-4 px-4 rounded-xl font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                        >
                          <FileText size={18} />
                          FMLA Conversion
                        </button>
                      </div>
                    )}
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

  // Optional Forms Views
  if (view === "incidentReport" || view === "timeOffRequest" || view === "overtimeRequest" || view === "fmlaConversion") {
    return (
      <div className="min-h-screen bg-[#D3D3D3] flex flex-col">
        {showClockOutConfirm && <ClockOutConfirmModal />}
        
        {/* Header for optional forms */}
        <header className="bg-[#E31E24] px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setView("actionSelect")}
              className="bg-white text-[#E31E24] px-4 sm:px-6 py-2 rounded font-bold text-base sm:text-lg hover:bg-gray-100 flex items-center justify-center gap-2"
            >
              <Home size={18} className="sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="text-white text-lg sm:text-xl font-bold">
              {view === "incidentReport" && "Employee Incident Report"}
              {view === "timeOffRequest" && "Time Off Request"}
              {view === "overtimeRequest" && "Overtime Request"}
              {view === "fmlaConversion" && "FMLA Conversion Form"}
            </div>
            <div className="w-20"></div>
          </div>
        </header>

        <div className="flex-1 overflow-auto py-4">
          {view === "incidentReport" && (
            <IncidentReportForm 
              employeeName={employeeData.name}
              onSubmit={handleIncidentReportSubmit}
              onCancel={handleOptionalFormCancel}
            />
          )}
          {view === "timeOffRequest" && (
            <TimeOffRequestForm 
              employeeName={employeeData.name}
              onSubmit={handleTimeOffRequestSubmit}
              onCancel={handleOptionalFormCancel}
            />
          )}
          {view === "overtimeRequest" && (
            <OvertimeRequestForm 
              employeeName={employeeData.name}
              onSubmit={handleOvertimeRequestSubmit}
              onCancel={handleOptionalFormCancel}
            />
          )}
          {view === "fmlaConversion" && (
            <FmlaConversionForm 
              employeeName={employeeData.name}
              onSubmit={handleFmlaConversionSubmit}
              onCancel={handleOptionalFormCancel}
            />
          )}
        </div>

        <footer className="bg-[#1A1A1A] text-white py-3 sm:py-4 text-center">
          <div className="text-base sm:text-xl font-bold">VISI2N by Transdev</div>
        </footer>
      </div>
    )
  }

  // Safety Meeting Schedules View (for drivers)
  if (view === "safetySchedules") {
    // Get unique months and years for filter dropdowns
    const availableMonths = [...new Set(safetyMeetingSchedules.map(s => s.month))].sort((a, b) => {
      const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      return monthOrder.indexOf(a) - monthOrder.indexOf(b)
    })
    const availableYears = [...new Set(safetyMeetingSchedules.map(s => s.year))].sort((a, b) => b - a)
    
    // Filter schedules based on selected filters
    const filteredSchedules = safetyMeetingSchedules.filter(schedule => {
      if (safetyFilterMonth && schedule.month !== safetyFilterMonth) return false
      if (safetyFilterYear && schedule.year !== parseInt(safetyFilterYear)) return false
      return true
    }).sort((a, b) => {
      // Sort by year desc, then month desc
      if (b.year !== a.year) return b.year - a.year
      const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      return monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month)
    })

    return (
      <div className="min-h-screen bg-[#D3D3D3] flex flex-col">
        {showClockOutConfirm && <ClockOutConfirmModal />}
        
        {/* Header */}
        <header className="bg-[#E31E24] px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setView("actionSelect")}
              className="bg-white text-[#E31E24] px-4 sm:px-6 py-2 rounded font-bold text-base sm:text-lg hover:bg-gray-100 flex items-center justify-center gap-2"
            >
              <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="text-white text-lg sm:text-xl font-bold">
              Safety Meeting Schedules
            </div>
            <div className="w-20"></div>
          </div>
        </header>

        <div className="flex-1 overflow-auto py-4">
          <div className="max-w-4xl mx-auto px-4">
            {adminLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E31E24] mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading schedules...</p>
              </div>
            ) : safetyMeetingSchedules.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <p className="text-gray-600">No safety meeting schedules available.</p>
              </div>
            ) : (
              <>
                {/* Filter Controls */}
                <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-gray-700">Filter by:</span>
                    <select
                      value={safetyFilterMonth}
                      onChange={(e) => setSafetyFilterMonth(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E31E24]"
                    >
                      <option value="">All Months</option>
                      {availableMonths.map(month => (
                        <option key={month} value={month}>{month}</option>
                      ))}
                    </select>
                    <select
                      value={safetyFilterYear}
                      onChange={(e) => setSafetyFilterYear(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E31E24]"
                    >
                      <option value="">All Years</option>
                      {availableYears.map(year => (
                        <option key={year} value={year.toString()}>{year}</option>
                      ))}
                    </select>
                    {(safetyFilterMonth || safetyFilterYear) && (
                      <button
                        onClick={() => {
                          setSafetyFilterMonth('')
                          setSafetyFilterYear('')
                        }}
                        className="text-[#E31E24] hover:text-red-700 font-medium flex items-center gap-1"
                      >
                        <X size={16} />
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Showing {filteredSchedules.length} of {safetyMeetingSchedules.length} schedule{safetyMeetingSchedules.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Schedule List */}
                {filteredSchedules.length === 0 ? (
                  <div className="bg-white rounded-xl p-8 text-center">
                    <p className="text-gray-600">No schedules match your filter.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredSchedules.map((schedule) => (
                      <SafetyMeetingSchedule
                        key={schedule.id}
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
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <footer className="bg-[#1A1A1A] text-white py-3 sm:py-4 text-center">
          <div className="text-base sm:text-xl font-bold">VISI2N by Transdev</div>
        </footer>
      </div>
    )
  }

  // Admin Panel View
  if (view === "admin") {
    // Helper to get notification label
    const getNotificationLabel = (type: FormNotification['type']) => {
      const labels: Record<FormNotification['type'], string> = {
        'dvi': 'DVI Inspection',
        'timesheet': 'Timesheet',
        'incident': 'Incident Report',
        'timeoff': 'Time Off Request',
        'overtime': 'Overtime Request',
        'fmla': 'FMLA Conversion'
      }
      return labels[type]
    }

    return (
      <div className="min-h-screen bg-[#D3D3D3] flex flex-col relative">
        {/* Notification Toast Container - Fixed position in top right */}
        {notifications.length > 0 && (
          <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="bg-white border-l-4 border-[#E31E24] rounded-lg shadow-xl p-4 cursor-pointer hover:bg-gray-50 transition-all animate-slide-in flex items-start gap-3"
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="bg-[#E31E24] rounded-full p-2 flex-shrink-0">
                  <Bell size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800 text-sm">
                    New {getNotificationLabel(notification.type)}
                  </div>
                  <div className="text-gray-600 text-sm truncate">
                    From: {notification.employeeName}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    {notification.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    dismissNotification(notification.id)
                  }}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

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
        <div className="bg-[#1A1A1A] px-3 sm:px-6 py-2 flex gap-2 sm:gap-4 items-center">
          {(["dashboard", "employees", "timesheets", "dvi"] as AdminTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                handleAdminTabChange(tab)
                setShowFormsDropdown(false)
              }}
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
          
          {/* Forms Dropdown */}
          <div className="relative">
            <button
              ref={formsButtonRef}
              onClick={() => {
                if (formsButtonRef.current) {
                  const rect = formsButtonRef.current.getBoundingClientRect()
                  setDropdownPosition({ top: rect.bottom + 4, left: rect.left })
                }
                setShowFormsDropdown(!showFormsDropdown)
              }}
              className={`px-4 sm:px-6 py-2 rounded font-bold text-sm sm:text-base whitespace-nowrap transition-colors flex items-center gap-2 ${
                ["incidents", "timeoff", "overtime", "fmla"].includes(adminTab)
                  ? "bg-[#E31E24] text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              Forms
              <ChevronDown size={16} className={`transition-transform ${showFormsDropdown ? 'rotate-180' : ''}`} />
            </button>
          </div>
          
          {/* Safety Meetings Tab */}
          <button
            onClick={() => {
              handleAdminTabChange("safety")
              setShowFormsDropdown(false)
            }}
            className={`px-4 sm:px-6 py-2 rounded font-bold text-sm sm:text-base whitespace-nowrap transition-colors ${
              adminTab === "safety"
                ? "bg-[#E31E24] text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            Safety Meetings
          </button>
        </div>
        
        {/* Forms Dropdown Menu - Fixed position based on button location */}
        {showFormsDropdown && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowFormsDropdown(false)}
            />
            <div 
              className="fixed bg-gray-800 rounded-lg shadow-xl z-50 overflow-hidden"
              style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
            >
              <button
                onClick={() => {
                  handleAdminTabChange("incidents")
                  setShowFormsDropdown(false)
                }}
                className={`block w-full px-4 py-3 text-left text-sm font-semibold transition-colors whitespace-nowrap ${
                  adminTab === "incidents"
                    ? "bg-[#E31E24] text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                Incident Reports
              </button>
              <button
                onClick={() => {
                  handleAdminTabChange("timeoff")
                  setShowFormsDropdown(false)
                }}
                className={`block w-full px-4 py-3 text-left text-sm font-semibold transition-colors whitespace-nowrap ${
                  adminTab === "timeoff"
                    ? "bg-[#E31E24] text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                Time Off Requests
              </button>
              <button
                onClick={() => {
                  handleAdminTabChange("overtime")
                  setShowFormsDropdown(false)
                }}
                className={`block w-full px-4 py-3 text-left text-sm font-semibold transition-colors whitespace-nowrap ${
                  adminTab === "overtime"
                    ? "bg-[#E31E24] text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                Overtime Requests
              </button>
              <button
                onClick={() => {
                  handleAdminTabChange("fmla")
                  setShowFormsDropdown(false)
                }}
                className={`block w-full px-4 py-3 text-left text-sm font-semibold transition-colors whitespace-nowrap ${
                  adminTab === "fmla"
                    ? "bg-[#E31E24] text-white"
                    : "text-gray-300 hover:bg-gray-700"
                }`}
              >
                FMLA Conversions
              </button>
            </div>
          </>
        )}

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
                          <div className="flex items-start justify-between">
                            <div className="font-bold text-lg text-gray-800">
                              {clockIn.name}
                            </div>
                            {clockIn.lunch_waiver && (
                              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded">
                                Lunch Waived
                              </span>
                            )}
                          </div>
                          <div className="text-gray-500 text-sm">ID: {clockIn.employee_id}</div>
                          <div className="mt-2 text-sm text-gray-600">
                            Clocked in: {formatAdminDateTime(clockIn.clock_in)}
                          </div>
                          {clockIn.expected_clock_out && (
                            <div className="mt-1 text-sm text-gray-600">
                              Expected out: {formatAdminDateTime(clockIn.expected_clock_out)}
                            </div>
                          )}
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

              {/* Incident Reports Tab */}
              {adminTab === "incidents" && (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Incident Reports</h2>
                  
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={adminStartDate}
                        onChange={(e) => {
                          setAdminStartDate(e.target.value)
                          loadAdminData("incidents")
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
                          loadAdminData("incidents")
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#E31E24] focus:outline-none"
                      />
                    </div>
                  </div>

                  {incidentReports.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow">
                      No incident reports found for this date range
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {incidentReports
                        .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                        .map((report) => (
                        <div key={report.id} className="bg-white rounded-xl p-4 shadow border-l-4 border-orange-500">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-bold text-lg text-gray-800">
                                {report.employee_name}
                              </div>
                              <div className="text-gray-500 text-sm">
                                {new Date(report.incident_date).toLocaleDateString()} at {report.incident_time}
                              </div>
                              <div className="text-gray-600 text-sm mt-1">
                                Location: {report.incident_location}
                                {report.bus_number && ` • Bus #${report.bus_number}`}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                report.status === 'resolved' 
                                  ? "bg-green-100 text-green-700"
                                  : report.status === 'reviewed'
                                  ? "bg-blue-100 text-blue-700" 
                                  : "bg-yellow-100 text-yellow-700"
                              }`}>
                                {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                              </span>
                              <select
                                value={report.status}
                                onChange={async (e) => {
                                  await updateIncidentReportStatus(report.id, e.target.value as any)
                                  loadAdminData("incidents")
                                }}
                                className="text-sm border rounded px-2 py-1"
                              >
                                <option value="pending">Pending</option>
                                <option value="reviewed">Reviewed</option>
                                <option value="resolved">Resolved</option>
                              </select>
                            </div>
                          </div>
                          <div className="text-gray-700 text-sm mt-2">
                            <strong>Details:</strong> {report.details.slice(0, 200)}{report.details.length > 200 && '...'}
                          </div>
                          {report.supervisor_contacted && (
                            <div className="text-gray-600 text-sm mt-1">
                              <strong>Supervisor:</strong> {report.supervisor_contacted}
                            </div>
                          )}
                          {report.witnesses && (
                            <div className="text-gray-600 text-sm mt-1">
                              <strong>Witnesses:</strong> {report.witnesses}
                            </div>
                          )}
                          <button
                            onClick={() => setSelectedIncidentReport(report)}
                            className="mt-3 text-[#E31E24] hover:underline text-sm font-semibold"
                          >
                            View Full Details
                          </button>
                        </div>
                      ))}
                      
                      {incidentReports.length > ITEMS_PER_PAGE && (
                        <div className="flex justify-center items-center gap-4 mt-4">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
                          >
                            Previous
                          </button>
                          <span className="text-gray-600">
                            Page {currentPage} of {Math.ceil(incidentReports.length / ITEMS_PER_PAGE)}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(incidentReports.length / ITEMS_PER_PAGE), p + 1))}
                            disabled={currentPage >= Math.ceil(incidentReports.length / ITEMS_PER_PAGE)}
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

              {/* Time Off Requests Tab */}
              {adminTab === "timeoff" && (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Time Off Requests</h2>
                  
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={adminStartDate}
                        onChange={(e) => {
                          setAdminStartDate(e.target.value)
                          loadAdminData("timeoff")
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
                          loadAdminData("timeoff")
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#E31E24] focus:outline-none"
                      />
                    </div>
                  </div>

                  {timeOffRequests.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow">
                      No time off requests found for this date range
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {timeOffRequests
                        .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                        .map((request) => (
                        <div key={request.id} className="bg-white rounded-xl p-4 shadow border-l-4 border-blue-500">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-bold text-lg text-gray-800">
                                {request.employee_name}
                              </div>
                              <div className="text-gray-500 text-sm">
                                Submitted: {new Date(request.submission_date).toLocaleDateString()}
                              </div>
                              <div className="text-gray-600 text-sm mt-1">
                                Type: {request.request_type.replace('_', '/').toUpperCase()}
                              </div>
                              {request.mailbox_number && (
                                <div className="text-gray-600 text-sm">
                                  Mailbox: {request.mailbox_number}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                request.status === 'approved' 
                                  ? "bg-green-100 text-green-700"
                                  : request.status === 'denied'
                                  ? "bg-red-100 text-red-700" 
                                  : "bg-yellow-100 text-yellow-700"
                              }`}>
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </span>
                              <select
                                value={request.status}
                                onChange={async (e) => {
                                  await updateTimeOffRequestStatus(request.id, e.target.value as any)
                                  loadAdminData("timeoff")
                                }}
                                className="text-sm border rounded px-2 py-1"
                              >
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="denied">Denied</option>
                              </select>
                            </div>
                          </div>
                          <div className="mt-2">
                            <strong className="text-gray-700 text-sm">Dates Requested:</strong>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {request.dates_requested.map((date, idx) => (
                                <span key={idx} className="bg-gray-100 px-2 py-1 rounded text-sm">
                                  {new Date(date).toLocaleDateString()}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {timeOffRequests.length > ITEMS_PER_PAGE && (
                        <div className="flex justify-center items-center gap-4 mt-4">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
                          >
                            Previous
                          </button>
                          <span className="text-gray-600">
                            Page {currentPage} of {Math.ceil(timeOffRequests.length / ITEMS_PER_PAGE)}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(timeOffRequests.length / ITEMS_PER_PAGE), p + 1))}
                            disabled={currentPage >= Math.ceil(timeOffRequests.length / ITEMS_PER_PAGE)}
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

              {/* Overtime Requests Tab */}
              {adminTab === "overtime" && (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Overtime Requests</h2>
                  
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={adminStartDate}
                        onChange={(e) => {
                          setAdminStartDate(e.target.value)
                          loadAdminData("overtime")
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
                          loadAdminData("overtime")
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#E31E24] focus:outline-none"
                      />
                    </div>
                  </div>

                  {overtimeRequests.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow">
                      No overtime requests found for this date range
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl shadow overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Employee</th>
                              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Submitted</th>
                              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Shift Date</th>
                              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Time</th>
                              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Hours</th>
                              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Status</th>
                              <th className="px-4 py-3 text-left text-sm font-bold text-gray-700">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overtimeRequests
                              .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                              .map((request) => (
                              <tr key={request.id} className="border-t border-gray-200 hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-gray-800">{request.employee_name}</div>
                                  {request.seniority_number && (
                                    <div className="text-xs text-gray-500">Seniority: {request.seniority_number}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-gray-600 text-sm">
                                  {new Date(request.date_submitted).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-gray-800">
                                  {request.shift_date ? new Date(request.shift_date).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-3 text-gray-800 text-sm">
                                  {request.start_time || '-'} - {request.end_time || '-'}
                                </td>
                                <td className="px-4 py-3 text-gray-800 font-mono">
                                  {request.pay_hours || '-'}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                                    request.status === 'awarded' 
                                      ? "bg-green-100 text-green-700"
                                      : request.status === 'not_awarded'
                                      ? "bg-red-100 text-red-700" 
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}>
                                    {request.status === 'not_awarded' ? 'Not Awarded' : request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={request.status}
                                    onChange={async (e) => {
                                      await updateOvertimeRequestStatus(request.id, e.target.value as any)
                                      loadAdminData("overtime")
                                    }}
                                    className="text-sm border rounded px-2 py-1"
                                  >
                                    <option value="pending">Pending</option>
                                    <option value="awarded">Awarded</option>
                                    <option value="not_awarded">Not Awarded</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {overtimeRequests.length > ITEMS_PER_PAGE && (
                    <div className="flex justify-center items-center gap-4 mt-4">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
                      >
                        Previous
                      </button>
                      <span className="text-gray-600">
                        Page {currentPage} of {Math.ceil(overtimeRequests.length / ITEMS_PER_PAGE)}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(overtimeRequests.length / ITEMS_PER_PAGE), p + 1))}
                        disabled={currentPage >= Math.ceil(overtimeRequests.length / ITEMS_PER_PAGE)}
                        className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* FMLA Conversions Tab */}
              {adminTab === "fmla" && (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">FMLA Conversion Requests</h2>
                  
                  <div className="flex flex-wrap gap-4 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={adminStartDate}
                        onChange={(e) => {
                          setAdminStartDate(e.target.value)
                          loadAdminData("fmla")
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
                          loadAdminData("fmla")
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-300 focus:border-[#E31E24] focus:outline-none"
                      />
                    </div>
                  </div>

                  {fmlaConversions.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow">
                      No FMLA conversion requests found for this date range
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {fmlaConversions
                        .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                        .map((request) => (
                        <div key={request.id} className="bg-white rounded-xl p-4 shadow border-l-4 border-purple-500">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-bold text-lg text-gray-800">
                                {request.employee_name}
                              </div>
                              <div className="text-gray-500 text-sm">
                                Submitted: {new Date(request.submission_date).toLocaleDateString()}
                              </div>
                              {request.mailbox_number && (
                                <div className="text-gray-600 text-sm">
                                  Mailbox: {request.mailbox_number}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${
                                request.status === 'approved' 
                                  ? "bg-green-100 text-green-700"
                                  : request.status === 'denied'
                                  ? "bg-red-100 text-red-700" 
                                  : "bg-yellow-100 text-yellow-700"
                              }`}>
                                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                              </span>
                              <select
                                value={request.status}
                                onChange={async (e) => {
                                  await updateFmlaConversionStatus(request.id, e.target.value as any)
                                  loadAdminData("fmla")
                                }}
                                className="text-sm border rounded px-2 py-1"
                              >
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="denied">Denied</option>
                              </select>
                            </div>
                          </div>
                          <div className="mt-2">
                            <strong className="text-gray-700 text-sm">Dates to Convert:</strong>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {request.dates_to_convert.map((date, idx) => (
                                <span key={idx} className={`px-2 py-1 rounded text-sm ${
                                  request.use_vacation_pay[idx] 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {new Date(date).toLocaleDateString()}
                                  {request.use_vacation_pay[idx] && ' (Vacation Pay)'}
                                </span>
                              ))}
                            </div>
                          </div>
                          {request.reason_for_disapproval && (
                            <div className="mt-2 text-red-600 text-sm">
                              <strong>Reason for Disapproval:</strong> {request.reason_for_disapproval}
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {fmlaConversions.length > ITEMS_PER_PAGE && (
                        <div className="flex justify-center items-center gap-4 mt-4">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-300"
                          >
                            Previous
                          </button>
                          <span className="text-gray-600">
                            Page {currentPage} of {Math.ceil(fmlaConversions.length / ITEMS_PER_PAGE)}
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(fmlaConversions.length / ITEMS_PER_PAGE), p + 1))}
                            disabled={currentPage >= Math.ceil(fmlaConversions.length / ITEMS_PER_PAGE)}
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

              {/* Safety Meetings Tab */}
              {adminTab === "safety" && (
                <div>
                  {/* Schedule List or Detail View */}
                  {showCreateSchedule || selectedSafetySchedule ? (
                    <div>
                      <button
                        onClick={() => {
                          setShowCreateSchedule(false)
                          setSelectedSafetySchedule(null)
                        }}
                        className="mb-4 text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                      >
                        ← Back to All Schedules
                      </button>
                      <SafetyMeetingSchedule
                        initialData={selectedSafetySchedule ? {
                          id: selectedSafetySchedule.id,
                          title: selectedSafetySchedule.title,
                          month: selectedSafetySchedule.month,
                          year: selectedSafetySchedule.year,
                          instruction: selectedSafetySchedule.instruction,
                          meetings: selectedSafetySchedule.meetings || [],
                          created_at: selectedSafetySchedule.created_at,
                          updated_at: selectedSafetySchedule.updated_at
                        } : {
                          title: "SAFETY MEETING SCHEDULES",
                          month: new Date().toLocaleString('default', { month: 'long' }),
                          year: new Date().getFullYear(),
                          instruction: "Drivers and Coordinators - Please have vests and closed-toe shoes.",
                          meetings: []
                        }}
                        editable={true}
                        onSave={async (data: SafetyMeetingScheduleData) => {
                          if (selectedSafetySchedule) {
                            await updateSafetyMeetingSchedule(selectedSafetySchedule.id, {
                              title: data.title,
                              month: data.month,
                              year: data.year,
                              instruction: data.instruction,
                              meetings: data.meetings
                            })
                          } else {
                            await createSafetyMeetingSchedule({
                              title: data.title,
                              month: data.month,
                              year: data.year,
                              instruction: data.instruction,
                              meetings: data.meetings
                            })
                          }
                          setShowCreateSchedule(false)
                          setSelectedSafetySchedule(null)
                          loadAdminData("safety")
                        }}
                        onShare={() => {
                          if (selectedSafetySchedule?.share_token) {
                            const url = `${window.location.origin}/safety/${selectedSafetySchedule.share_token}`
                            setShareUrl(url)
                            setShareModalOpen(true)
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Safety Meeting Schedules</h2>
                        <button
                          onClick={() => {
                            setSelectedSafetySchedule(null)
                            setShowCreateSchedule(true)
                          }}
                          className="bg-[#E31E24] text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 flex items-center gap-2"
                        >
                          <span className="text-xl">+</span>
                          New Schedule
                        </button>
                      </div>
                      {safetyMeetingSchedules.length === 0 ? (
                        <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow">
                          No safety meeting schedules found. Create one to get started.
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {safetyMeetingSchedules.map((schedule) => (
                            <div
                              key={schedule.id}
                              className="bg-white rounded-xl shadow border-l-4 border-yellow-500 overflow-hidden"
                            >
                              <div 
                                onClick={() => setSelectedSafetySchedule(schedule)}
                                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                              >
                                <div className="font-bold text-lg text-gray-800">
                                  {schedule.month} {schedule.year}
                                </div>
                                <div className="text-gray-600 text-sm mt-1">
                                  {schedule.title}
                                </div>
                                <div className="text-gray-500 text-sm mt-2">
                                  {schedule.meetings?.length || 0} meetings scheduled
                                </div>
                              </div>
                              <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-end">
                                <button
                                  onClick={() => setDeleteConfirmSchedule(schedule)}
                                  className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
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

        {/* Share Link Modal */}
        {shareModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Share Safety Meeting Schedule</h3>
              <p className="text-gray-600 mb-4">Anyone with this link can view the schedule:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                />
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(shareUrl)
                    alert("Link copied to clipboard!")
                  }}
                  className="bg-[#E31E24] text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700"
                >
                  Copy
                </button>
              </div>
              <button
                onClick={() => setShareModalOpen(false)}
                className="w-full mt-4 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-bold hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmSchedule && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Delete Schedule</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete the <strong>{deleteConfirmSchedule.month} {deleteConfirmSchedule.year}</strong> schedule? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirmSchedule(null)}
                  className="bg-gray-200 text-gray-800 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await deleteSafetyMeetingSchedule(deleteConfirmSchedule.id)
                    setDeleteConfirmSchedule(null)
                    loadAdminData("safety")
                  }}
                  className="bg-red-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

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

        {/* Incident Report Detail Modal */}
        {selectedIncidentReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">Incident Report Details</h3>
                <button
                  onClick={() => setSelectedIncidentReport(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Employee Name</div>
                    <div className="font-semibold">{selectedIncidentReport.employee_name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Status</div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      selectedIncidentReport.status === 'resolved' 
                        ? "bg-green-100 text-green-700"
                        : selectedIncidentReport.status === 'reviewed'
                        ? "bg-blue-100 text-blue-700" 
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {selectedIncidentReport.status.charAt(0).toUpperCase() + selectedIncidentReport.status.slice(1)}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Incident Date</div>
                    <div className="font-semibold">{new Date(selectedIncidentReport.incident_date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Incident Time</div>
                    <div className="font-semibold">{selectedIncidentReport.incident_time}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Location</div>
                    <div className="font-semibold">{selectedIncidentReport.incident_location}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Bus Number</div>
                    <div className="font-semibold">{selectedIncidentReport.bus_number || '-'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm text-gray-500">Supervisor Contacted</div>
                    <div className="font-semibold">{selectedIncidentReport.supervisor_contacted || '-'}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-500 mb-2 font-semibold">Details of Event</div>
                  <div className="bg-gray-50 rounded-lg p-4 text-gray-700 whitespace-pre-wrap">
                    {selectedIncidentReport.details}
                  </div>
                </div>

                {selectedIncidentReport.witnesses && (
                  <div>
                    <div className="text-sm text-gray-500 mb-2 font-semibold">Witnesses</div>
                    <div className="bg-gray-50 rounded-lg p-4 text-gray-700">
                      {selectedIncidentReport.witnesses}
                    </div>
                  </div>
                )}

                {(selectedIncidentReport.passenger_name || selectedIncidentReport.passenger_address || selectedIncidentReport.passenger_phone) && (
                  <div>
                    <div className="text-sm text-gray-500 mb-2 font-semibold">Passenger Information</div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-1">
                      {selectedIncidentReport.passenger_name && (
                        <div><strong>Name:</strong> {selectedIncidentReport.passenger_name}</div>
                      )}
                      {selectedIncidentReport.passenger_address && (
                        <div><strong>Address:</strong> {selectedIncidentReport.passenger_address}</div>
                      )}
                      {selectedIncidentReport.passenger_city_state_zip && (
                        <div><strong>City/State/Zip:</strong> {selectedIncidentReport.passenger_city_state_zip}</div>
                      )}
                      {selectedIncidentReport.passenger_phone && (
                        <div><strong>Phone:</strong> {selectedIncidentReport.passenger_phone}</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <div className="text-sm text-gray-500">Date Completed</div>
                    <div className="font-semibold">{selectedIncidentReport.date_completed}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Time Completed</div>
                    <div className="font-semibold">{selectedIncidentReport.time_completed}</div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedIncidentReport(null)}
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
