"use client"

import { useState, useEffect } from "react"
import { Search, Delete, Home } from "lucide-react"
import DVIForm from "@/components/dvi-form"
import TimesheetForm from "@/components/timesheet-form"

type ViewState = "login" | "employeeIdEntry" | "dvi" | "timesheet" | "clockout"
type FormType = "dvi" | "timesheet"

export default function TimeClockKiosk() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [view, setView] = useState<ViewState>("login")
  const [activeForm, setActiveForm] = useState<FormType>("dvi")
  const [enteredId, setEnteredId] = useState("")
  const [employeeData, setEmployeeData] = useState({
    name: "",
    id: "",
    clockedIn: false,
    dviCompleted: false,
    clockInTime: "",
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const handleDashboard = () => {
    setView("login")
    setEmployeeData({
      name: "",
      id: "",
      clockedIn: false,
      dviCompleted: false,
      clockInTime: "",
    })
  }

  const handleIdCardLogin = () => {
    setView("employeeIdEntry")
    setEnteredId("")
  }

  const handleEmployeeIdLogin = () => {
    // Placeholder for future functionality
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

  const handleSubmitEmployeeId = () => {
    if (enteredId.length > 0) {
      const mockEmployee = {
        name: "Jane Operator",
        id: enteredId,
        clockedIn: false,
        dviCompleted: false,
        clockInTime: "",
      }
      authenticateEmployee(mockEmployee)
    }
  }

  const handleCancelIdEntry = () => {
    setView("login")
    setEnteredId("")
  }

  const authenticateEmployee = (employee: typeof employeeData) => {
    setEmployeeData(employee)

    if (!employee.clockedIn) {
      const clockInTime = formatTime(new Date())
      setEmployeeData((prev) => ({
        ...prev,
        clockedIn: true,
        clockInTime,
      }))
      setView(activeForm)
    } else if (!employee.dviCompleted) {
      setView(activeForm)
    } else {
      setView("clockout")
    }
  }

  const handleDviComplete = () => {
    setEmployeeData((prev) => ({ ...prev, dviCompleted: true }))
    handleDashboard()
  }

  const handleClockOut = () => {
    handleDashboard()
  }

  const isLoggedIn = view === "dvi" || view === "timesheet" || view === "clockout"

  if (view === "dvi" || view === "timesheet") {
    return (
      <div className="min-h-screen bg-[#D3D3D3] flex flex-col">
        <header className="bg-[#E31E24] px-6 py-4 flex items-center gap-4">
          <button
            onClick={handleDashboard}
            className="bg-white text-[#E31E24] px-6 py-2 rounded font-bold text-lg hover:bg-gray-100 flex items-center gap-2"
          >
            <Home size={20} />
            Dashboard
          </button>
          <div className="flex-1 flex items-center gap-4">
            <div className="flex-1 bg-white rounded px-4 py-2 flex items-center gap-2">
              <Search size={20} className="text-gray-400" />
              <input type="text" placeholder="Search..." className="flex-1 outline-none text-lg" />
            </div>
            <button
              onClick={handleIdCardLogin}
              className="bg-[#FFE500] text-black px-8 py-2 rounded font-bold text-lg hover:bg-yellow-400 whitespace-nowrap"
            >
              ID CARD LOGIN
            </button>
            <button
              onClick={handleEmployeeIdLogin}
              className="bg-[#FFE500] text-black px-8 py-2 rounded font-bold text-lg hover:bg-yellow-400 whitespace-nowrap"
            >
              EMPLOYEE ID
            </button>
          </div>
        </header>

        <div className="bg-[#E31E24] text-white px-6 py-3 flex items-center justify-between">
          <div className="text-xl font-bold">
            {employeeData.name} - {employeeData.id} - Clocked In: {employeeData.clockInTime}
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => {
                setActiveForm("dvi")
                setView("dvi")
              }}
              className={`px-6 py-2 rounded font-bold text-lg transition-colors ${
                activeForm === "dvi"
                  ? "bg-[#FFE500] text-black"
                  : "bg-white/20 text-white hover:bg-white/30 border-2 border-white/50"
              }`}
            >
              DVI FORM
            </button>
            <button
              onClick={() => {
                setActiveForm("timesheet")
                setView("timesheet")
              }}
              className={`px-6 py-2 rounded font-bold text-lg transition-colors ${
                activeForm === "timesheet"
                  ? "bg-[#FFE500] text-black"
                  : "bg-white/20 text-white hover:bg-white/30 border-2 border-white/50"
              }`}
            >
              TIMESHEET
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {view === "dvi" ? <DVIFormWrapper onComplete={handleDviComplete} /> : <TimesheetForm />}
        </div>

        <footer className="bg-[#1A1A1A] text-white py-4 text-center">
          <div className="text-xl font-bold">VISI2N by Transdev</div>
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#D3D3D3] flex flex-col">
      {/* Header */}
      <header className="bg-[#E31E24] px-6 py-4 flex items-center gap-4">
        <button
          disabled
          className="bg-white/50 text-white px-6 py-2 rounded font-bold text-lg flex items-center gap-2 cursor-not-allowed"
        >
          <Home size={20} />
          Dashboard
        </button>
        <div className="flex-1 flex items-center gap-4">
          <div className="flex-1 bg-white rounded px-4 py-2 flex items-center gap-2">
            <Search size={20} className="text-gray-400" />
            <input type="text" placeholder="Search..." className="flex-1 outline-none text-lg" />
          </div>
          <button
            onClick={handleIdCardLogin}
            className="bg-[#FFE500] text-black px-8 py-2 rounded font-bold text-lg hover:bg-yellow-400 whitespace-nowrap"
          >
            ID CARD LOGIN
          </button>
          <button
            onClick={handleEmployeeIdLogin}
            className="bg-[#FFE500] text-black px-8 py-2 rounded font-bold text-lg hover:bg-yellow-400 whitespace-nowrap"
          >
            EMPLOYEE ID
          </button>
        </div>
      </header>

      {/* Station ID Banner */}
      <div className="bg-[#E31E24] text-white px-6 py-3 text-center">
        <div className="text-xl font-bold">STATION ID: KIOSK-001</div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        {view === "login" && (
          <div className="w-full max-w-4xl">
            <div className="bg-[#1A1A1A] rounded-3xl p-12 shadow-2xl">
              <div className="text-center">
                <div className="text-white text-8xl font-bold font-mono tracking-wider mb-4">
                  {formatTime(currentTime)}
                </div>
                <div className="text-gray-400 text-2xl font-semibold">{formatDate(currentTime)}</div>
              </div>
            </div>
          </div>
        )}

        {view === "employeeIdEntry" && (
          <div className="w-full max-w-4xl">
            <div className="bg-[#1A1A1A] rounded-3xl p-12 mb-8 shadow-2xl">
              <div className="text-center mb-6">
                <div className="text-gray-400 text-2xl mb-4">Enter Employee ID</div>
                <div className="bg-white rounded-xl p-6 min-h-[100px] flex items-center justify-center">
                  <div className="text-6xl font-bold font-mono tracking-widest text-black">{enteredId || "—"}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeypadPress(digit.toString())}
                  className="bg-white text-black rounded-2xl py-12 text-5xl font-bold hover:bg-gray-200 transition-colors shadow-lg"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={handleClear}
                className="bg-[#E31E24] text-white rounded-2xl py-12 text-3xl font-bold hover:bg-red-700 transition-colors shadow-lg"
              >
                CLEAR
              </button>
              <button
                onClick={() => handleKeypadPress("0")}
                className="bg-white text-black rounded-2xl py-12 text-5xl font-bold hover:bg-gray-200 transition-colors shadow-lg"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                className="bg-gray-600 text-white rounded-2xl py-12 flex items-center justify-center hover:bg-gray-700 transition-colors shadow-lg"
              >
                <Delete size={48} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={handleCancelIdEntry}
                className="bg-gray-600 text-white rounded-2xl py-12 text-3xl font-bold hover:bg-gray-700 transition-colors shadow-lg"
              >
                CANCEL
              </button>
              <button
                onClick={handleSubmitEmployeeId}
                disabled={enteredId.length === 0}
                className="bg-[#FFE500] text-black rounded-2xl py-12 text-3xl font-bold hover:bg-yellow-400 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                SUBMIT
              </button>
            </div>
          </div>
        )}

        {view === "clockout" && (
          <div className="w-full max-w-4xl text-center">
            <div className="bg-[#1A1A1A] rounded-3xl p-12 mb-8 shadow-2xl">
              <div className="text-white text-5xl font-bold mb-6">Welcome Back, {employeeData.name}!</div>
              <div className="text-gray-400 text-2xl mb-4">Clocked In: {employeeData.clockInTime}</div>
              <div className="text-green-400 text-xl">✓ DVI Completed</div>
            </div>

            <button
              onClick={handleClockOut}
              className="bg-[#E31E24] text-white rounded-2xl py-16 px-24 text-4xl font-bold hover:bg-red-700 transition-colors shadow-xl"
            >
              CLOCK OUT
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-white py-4 text-center">
        <div className="text-xl font-bold">VISI2N by Transdev</div>
      </footer>
    </div>
  )
}

function DVIFormWrapper({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const handleSubmit = (e: Event) => {
      const target = e.target as HTMLElement
      if (target.textContent?.includes("Submit Inspection")) {
        e.preventDefault()
        onComplete()
      }
    }

    document.addEventListener("click", handleSubmit)
    return () => document.removeEventListener("click", handleSubmit)
  }, [onComplete])

  return <DVIForm />
}
