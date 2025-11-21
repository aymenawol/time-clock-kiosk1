"use client"

import { useState, useEffect } from "react"

interface TimesheetEntry {
  timeDepart: string
  rac: string
  t1: string
  t3: string
  term1: string
  term3West: string
  term3East: string
}

export default function TimesheetForm({ clockInTime }: { clockInTime?: string }) {
  const [operator, setOperator] = useState("")
  const [busNumber, setBusNumber] = useState("")
  const [brkWindows, setBrkWindows] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")

  const [entries, setEntries] = useState<TimesheetEntry[]>(
    Array(5)
      .fill(null)
      .map(() => ({
        timeDepart: "",
        rac: "",
        t1: "",
        t3: "",
        term1: "",
        term3West: "",
        term3East: "",
      })),
  )

  const [totals, setTotals] = useState({
    rac: 0,
    t1: 0,
    t3: 0,
    term1: 0,
    term3West: 0,
    term3East: 0,
  })

  useEffect(() => {
    // Compute BRK Windows when a clock-in time is provided.
    if (clockInTime) {
      // Expecting clockInTime like "HH:MM:SS" or "HH:MM" in 24-hour time.
      const parts = clockInTime.split(":").map((p) => Number.parseInt(p, 10) || 0)
      const now = new Date()
      now.setHours(parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, 0)

      const minutesToAdd = 2 * 60 + 15 // 2 hours 15 minutes
      const minutesToAdd2 = 6 * 60 // 2 hours 15 minutes
      const end = new Date(now.getTime() + minutesToAdd * 60 * 1000)
      const end2 = new Date(now.getTime() + minutesToAdd2 * 60 * 1000)

      const fmt = (d: Date) =>
        d
          .toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .replace(/\s/g, "")

      setBrkWindows(`First: ${fmt(end)} ------------------------- Second: ${fmt(end2)}`)
    } else {
      setBrkWindows("")
    }

    const newTotals = {
      rac: 0,
      t1: 0,
      t3: 0,
      term1: 0,
      term3West: 0,
      term3East: 0,
    }

    entries.forEach((entry) => {
      newTotals.rac += Number.parseFloat(entry.rac) || 0
      newTotals.t1 += Number.parseFloat(entry.t1) || 0
      newTotals.t3 += Number.parseFloat(entry.t3) || 0
      newTotals.term1 += Number.parseFloat(entry.term1) || 0
      newTotals.term3West += Number.parseFloat(entry.term3West) || 0
      newTotals.term3East += Number.parseFloat(entry.term3East) || 0
    })

    setTotals(newTotals)
  }, [entries])

  const handleEntryChange = (index: number, field: keyof TimesheetEntry, value: string) => {
    const newEntries = [...entries]
    newEntries[index] = { ...newEntries[index], [field]: value }
    setEntries(newEntries)
  }

  const addRow = () => {
    setEntries([
      ...entries,
      {
        timeDepart: "",
        rac: "",
        t1: "",
        t3: "",
        term1: "",
        term3West: "",
        term3East: "",
      },
    ])
  }

  const handleSubmit = () => {
    console.log("Timesheet submitted", { operator, busNumber, entries })
    alert("Timesheet submitted successfully!")
  }

  return (
    <div className="bg-white p-2 sm:p-6 max-w-7xl mx-auto">
      <div className="border-2 sm:border-4 border-black overflow-hidden">
        <div className="bg-gray-200 p-3 sm:p-4 border-b-2 sm:border-b-4 border-black">
          <div className="text-center font-bold text-base sm:text-xl mb-2">
            If you cannot do it safely-DON&apos;T DO IT!
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-2">
            <div>
              <label className="font-bold text-xs sm:text-base">Operator</label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full border-2 border-black p-1 sm:p-2 mt-1 text-sm sm:text-base"
              />
            </div>
            <div>
              <label className="font-bold text-xs sm:text-base">BRK Windows</label>
              <input
                type="text"
                value={brkWindows}
                onChange={(e) => setBrkWindows(e.target.value)}
                placeholder="14:05-14:20"
                className="w-full border-2 border-black p-1 sm:p-2 mt-1 text-sm sm:text-base font-bold"
                disabled={true}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-xs sm:text-base">Check-In</label>
                <input
                  type="text"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full border-2 border-black p-1 sm:p-2 mt-1 text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="font-bold text-xs sm:text-base">Check-Out</label>
                <input
                  type="text"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full border-2 border-black p-1 sm:p-2 mt-1 text-sm sm:text-base"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="font-bold text-xs sm:text-base">BUS #</label>
            <input
              type="text"
              value={busNumber}
              onChange={(e) => setBusNumber(e.target.value)}
              className="w-24 sm:w-32 border-2 border-black p-1 sm:p-2 mt-1 ml-2 text-sm sm:text-base"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="grid grid-cols-7 border-b-2 sm:border-b-4 border-black bg-black text-white text-xs sm:text-base">
              <div className="p-2 sm:p-3 border-r-2 border-white text-center font-bold">
                Time
                <br className="hidden sm:block" />
                <span className="sm:hidden">Dep </span>
                <span className="hidden sm:inline">Departing </span>RAC
              </div>
              <div className="p-2 sm:p-3 border-r-2 border-white text-center font-bold">
                RAC
                <br className="hidden sm:block" />
                T-1
              </div>
              <div className="p-2 sm:p-3 border-r-2 border-white text-center font-bold">
                RAC
                <br className="hidden sm:block" />
                T-3
              </div>
              <div className="p-2 sm:p-3 border-r-2 border-white font-bold flex items-center justify-center">
                TERM 1
              </div>
              <div className="p-2 sm:p-3 border-r-2 border-white text-center font-bold">
                TERM 3
                <br className="hidden sm:block" />
                West
              </div>
              <div className="p-2 sm:p-3 border-r-2 border-white text-center font-bold">
                TERM 3
                <br className="hidden sm:block" />
                East
              </div>
              <div className="p-2 sm:p-3 flex items-center justify-center font-bold">Total</div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {entries.map((entry, index) => (
                <div key={index} className="grid grid-cols-7 border-b border-gray-300 text-xs sm:text-base">
                  <input
                    type="text"
                    value={entry.timeDepart}
                    onChange={(e) => handleEntryChange(index, "timeDepart", e.target.value)}
                    className="p-1 sm:p-2 border-r-2 border-black text-center"
                  />
                  <input
                    type="number"
                    value={entry.rac}
                    onChange={(e) => handleEntryChange(index, "rac", e.target.value)}
                    className="p-1 sm:p-2 border-r-2 border-black text-center"
                  />
                  <input
                    type="number"
                    value={entry.t1}
                    onChange={(e) => handleEntryChange(index, "t1", e.target.value)}
                    className="p-1 sm:p-2 border-r-2 border-black text-center"
                  />
                  <input
                    type="number"
                    value={entry.term1}
                    onChange={(e) => handleEntryChange(index, "term1", e.target.value)}
                    className="p-1 sm:p-2 border-r-2 border-black text-center"
                  />
                  <input
                    type="number"
                    value={entry.t3}
                    onChange={(e) => handleEntryChange(index, "t3", e.target.value)}
                    className="p-1 sm:p-2 border-r-2 border-black text-center"
                  />
                  <input
                    type="number"
                    value={entry.term3West}
                    onChange={(e) => handleEntryChange(index, "term3West", e.target.value)}
                    className="p-1 sm:p-2 border-r-2 border-black text-center"
                  />
                  <input
                    type="number"
                    value={entry.term3East}
                    onChange={(e) => handleEntryChange(index, "term3East", e.target.value)}
                    className="p-1 sm:p-2 text-center"
                  />
                </div>
              ))}

              <div className="grid grid-cols-7 border-b-2 border-gray-400">
                <button
                  onClick={addRow}
                  className="col-span-7 p-2 sm:p-3 text-center font-bold text-blue-600 hover:bg-gray-100 transition-colors"
                >
                  + Add Row
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 bg-black text-white border-t-2 sm:border-t-4 border-black text-xs sm:text-base">
              <div className="p-2 sm:p-3 border-r-2 border-white flex items-center justify-center font-bold">
                TOTALS
              </div>
              <div className="p-2 sm:p-3 border-r-2 border-white text-center bg-white text-black font-bold">
                {totals.rac.toFixed(2)}
              </div>
              <div className="p-2 sm:p-3 border-r-2 border-white text-center bg-white text-black font-bold">
                {totals.t1.toFixed(2)}
              </div>
              <div className="p-2 sm:p-3 border-r-2 border-white text-center bg-white text-black font-bold">
                {totals.term1.toFixed(2)}
              </div>
              <div className="p-2 sm:p-3 border-r-2 border-white text-center bg-white text-black font-bold">
                {totals.t3.toFixed(2)}
              </div>
              <div className="p-2 sm:p-3 border-r-2 border-white text-center bg-white text-black font-bold">
                {totals.term3West.toFixed(2)}
              </div>
              <div className="p-2 sm:p-3 text-center bg-white text-black font-bold">{totals.term3East.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="p-2 sm:p-3 text-center border-t-2 border-black text-xs sm:text-base">
          <p className="font-bold">Total each column separately - DO NOT give a Grand Total.</p>
        </div>
      </div>

      <div className="mt-4 sm:mt-6 text-center">
        <button
          onClick={handleSubmit}
          className="bg-[#FFE500] text-black px-8 sm:px-12 py-3 sm:py-4 rounded-lg text-lg sm:text-2xl font-bold hover:bg-yellow-400 transition-colors active:scale-95"
        >
          Submit Timesheet
        </button>
      </div>
    </div>
  )
}
