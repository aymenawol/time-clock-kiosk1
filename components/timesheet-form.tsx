"use client"

import { useState } from "react"

interface TimesheetEntry {
  timeDepart: string
  rac: string
  t1: string
  t3: string
  term1: string
  term3West: string
  term3East: string
}

export default function TimesheetForm() {
  const [operator, setOperator] = useState("")
  const [busNumber, setBusNumber] = useState("")
  const [brkWindows, setBrkWindows] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")

  const [entries, setEntries] = useState<TimesheetEntry[]>(
    Array(24)
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

  const [subtotals, setSubtotals] = useState({
    rac: "",
    t1: "",
    t3: "",
    term1: "",
    term3West: "",
    term3East: "",
  })

  const handleEntryChange = (index: number, field: keyof TimesheetEntry, value: string) => {
    const newEntries = [...entries]
    newEntries[index] = { ...newEntries[index], [field]: value }
    setEntries(newEntries)
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
                className="w-full border-2 border-black p-1 sm:p-2 mt-1 text-sm sm:text-base"
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
            {/* Table Header */}
            <div className="grid grid-cols-7 border-b-2 sm:border-b-4 border-black bg-black text-white text-xs sm:text-base">
              <div className="p-2 sm:p-3 border-r-2 border-white text-center font-bold">
                Time
                <br className="hidden sm:block" />
                <span className="sm:hidden">Dep </span>
                <span className="hidden sm:inline">Departing </span>RAC
              </div>
              <div className="col-span-2 grid grid-cols-2 border-r-2 border-white">
                <div className="p-2 sm:p-3 col-span-2 text-center font-bold border-b-2 border-white">RAC</div>
                <div className="p-1 sm:p-2 text-center border-r-2 border-white">T-1</div>
                <div className="p-1 sm:p-2 text-center">T-3</div>
              </div>
              <div className="p-2 sm:p-3 border-r-2 border-white text-center font-bold">TERM 1</div>
              <div className="col-span-2 grid grid-cols-2 border-r-2 border-white">
                <div className="p-2 sm:p-3 col-span-2 text-center font-bold border-b-2 border-white">TERM 3</div>
                <div className="p-1 sm:p-2 text-center border-r-2 border-white">West</div>
                <div className="p-1 sm:p-2 text-center">East</div>
              </div>
              <div className="p-2 sm:p-3 text-center font-bold">Total</div>
            </div>

            {/* Entry Rows */}
            <div className="max-h-96 overflow-y-auto">
              {entries.map((entry, index) => (
                <div key={index}>
                  {(index === 4 || index === 8 || index === 12 || index === 16 || index === 20) && (
                    <div className="grid grid-cols-7 bg-gray-300 border-b-2 border-black text-xs sm:text-base">
                      <div className="p-1 sm:p-2 border-r-2 border-black font-bold">Subtotal</div>
                      <div className="col-span-6 grid grid-cols-6">
                        <input
                          type="text"
                          className="p-1 sm:p-2 border-r-2 border-black text-center text-xs sm:text-base"
                        />
                        <input
                          type="text"
                          className="p-1 sm:p-2 border-r-2 border-black text-center text-xs sm:text-base"
                        />
                        <input
                          type="text"
                          className="p-1 sm:p-2 border-r-2 border-black text-center text-xs sm:text-base"
                        />
                        <input
                          type="text"
                          className="p-1 sm:p-2 border-r-2 border-black text-center text-xs sm:text-base"
                        />
                        <input
                          type="text"
                          className="p-1 sm:p-2 border-r-2 border-black text-center text-xs sm:text-base"
                        />
                        <input type="text" className="p-1 sm:p-2 text-center text-xs sm:text-base" />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-7 border-b border-gray-300 text-xs sm:text-base">
                    <input
                      type="text"
                      value={entry.timeDepart}
                      onChange={(e) => handleEntryChange(index, "timeDepart", e.target.value)}
                      className="p-1 sm:p-2 border-r-2 border-black text-center"
                    />
                    <input
                      type="text"
                      value={entry.rac}
                      onChange={(e) => handleEntryChange(index, "rac", e.target.value)}
                      className="p-1 sm:p-2 border-r-2 border-black text-center"
                    />
                    <input
                      type="text"
                      value={entry.t1}
                      onChange={(e) => handleEntryChange(index, "t1", e.target.value)}
                      className="p-1 sm:p-2 border-r-2 border-black text-center"
                    />
                    <input
                      type="text"
                      value={entry.term1}
                      onChange={(e) => handleEntryChange(index, "term1", e.target.value)}
                      className="p-1 sm:p-2 border-r-2 border-black text-center"
                    />
                    <input
                      type="text"
                      value={entry.t3}
                      onChange={(e) => handleEntryChange(index, "t3", e.target.value)}
                      className="p-1 sm:p-2 border-r-2 border-black text-center"
                    />
                    <input
                      type="text"
                      value={entry.term3West}
                      onChange={(e) => handleEntryChange(index, "term3West", e.target.value)}
                      className="p-1 sm:p-2 border-r-2 border-black text-center"
                    />
                    <input
                      type="text"
                      value={entry.term3East}
                      onChange={(e) => handleEntryChange(index, "term3East", e.target.value)}
                      className="p-1 sm:p-2 text-center"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Row */}
            <div className="grid grid-cols-7 bg-black text-white border-t-2 sm:border-t-4 border-black text-xs sm:text-base">
              <div className="p-2 sm:p-3 border-r-2 border-white text-center font-bold">TOTALS</div>
              <input type="text" className="p-2 sm:p-3 border-r-2 border-white text-center bg-white text-black" />
              <input type="text" className="p-2 sm:p-3 border-r-2 border-white text-center bg-white text-black" />
              <input type="text" className="p-2 sm:p-3 border-r-2 border-white text-center bg-white text-black" />
              <input type="text" className="p-2 sm:p-3 border-r-2 border-white text-center bg-white text-black" />
              <input type="text" className="p-2 sm:p-3 border-r-2 border-white text-center bg-white text-black" />
              <input type="text" className="p-2 sm:p-3 text-center bg-white text-black" />
            </div>
          </div>
        </div>

        {/* Footer Note */}
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
