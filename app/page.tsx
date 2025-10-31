"use client"

import { useState, useEffect } from "react"
import { Menu, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function TimeClockKiosk() {
  const [currentTime, setCurrentTime] = useState("")
  const [score, setScore] = useState(0)

  useEffect(() => {
    // Initialize time
    const updateTime = () => {
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, "0")
      const minutes = String(now.getMinutes()).padStart(2, "0")
      const seconds = String(now.getSeconds()).padStart(2, "0")
      setCurrentTime(`${hours}:${minutes}:${seconds}`)
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#D3D3D3" }}>
      {/* Header */}
      <header className="relative flex items-center justify-between px-6 py-4" style={{ backgroundColor: "#E31E24" }}>
        {/* Left side - Menu and Search */}
        <div className="flex items-center gap-4 flex-1">
          <button className="text-white hover:opacity-80 transition-opacity">
            <Menu className="w-8 h-8" />
          </button>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search..."
              className="pl-10 bg-[#2A2A2A] border-none text-white placeholder:text-gray-400 h-12"
            />
          </div>
        </div>

        {/* Right side - Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            className="h-12 px-6 font-bold text-black hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#FFE500" }}
          >
            ID CARD LOGIN
          </Button>
          <Button
            className="h-12 px-6 font-bold text-black hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#FFE500" }}
          >
            EMPLOYEE ID
          </Button>
          <Button
            className="h-12 px-6 font-bold text-black hover:opacity-90 transition-opacity"
            style={{ backgroundColor: "#FFE500" }}
          >
            REFRESH PAGE
          </Button>
        </div>
      </header>

      {/* Score Display */}
      <div className="absolute top-20 left-6 z-10">
        <div
          className="px-6 py-2 rounded-md font-bold text-black text-lg"
          style={{
            background: "linear-gradient(135deg, #FFE500 0%, #FFD700 100%)",
          }}
        >
          SCORE: {score}.0
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Station ID Banner */}
        <div className="w-full max-w-4xl mb-8 px-8 py-4 rounded-lg" style={{ backgroundColor: "#E31E24" }}>
          <h1 className="text-white text-2xl font-bold text-center">Station ID: LASVEGASRAC1 (55567)</h1>
        </div>

        {/* Clock Display */}
        <div
          className="w-full max-w-4xl rounded-3xl flex items-center justify-center p-16"
          style={{ backgroundColor: "#1A1A1A" }}
        >
          <div className="text-white font-mono font-bold tracking-wider" style={{ fontSize: "10rem", lineHeight: "1" }}>
            {currentTime || "00:00:00"}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="text-gray-700 font-semibold text-lg">VISI2N by</span>
          <span className="font-bold text-2xl" style={{ color: "#E31E24" }}>
            Transdev
          </span>
        </div>
      </footer>
    </div>
  )
}
