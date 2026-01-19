"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Camera, Save, Trash2 } from 'lucide-react'

interface DVIFormProps {
  onSubmit?: (data: Record<string, any>) => void
  clockInTime?: string
  clockOutTime?: string
  operatorName?: string
}

export default function DVIForm({ onSubmit, clockInTime, clockOutTime, operatorName }: DVIFormProps) {
  const [formData, setFormData] = useState({
    busNumber: "",
    vehicleType: "" as "" | "ev" | "diesel",
    vehicleStatus: "" as "" | "ready" | "charging" | "biohazard" | "shop" | "full" | "3/4" | "1/2" | "1/4" | "empty",
    date: new Date().toISOString().split("T")[0],
    tenEightTime: "",
    operatorName: operatorName || "",
    operatorSignature: "",
    milesDriver: "",
    timeWorked: "",
    beginningMiles: "",
    endMiles: "",
    beginningTime: clockInTime || "",
    endTime: clockOutTime || "",
    operatorComments: "",
    nextDriverReviewed: "",
    techComments: "",
    techSignature: "",
    techDate: "",
  })

  const [exteriorChecks, setExteriorChecks] = useState({
    "lights-lenses": { preTrip: false, postTrip: false },
    "turn-signals": { preTrip: false, postTrip: false },
    "windshield-wipers": { preTrip: false, postTrip: false },
    "door-operation": { preTrip: false, postTrip: false },
    "emergency-doors": { preTrip: false, postTrip: false },
    "tires-wheels": { preTrip: false, postTrip: false },
    "glass-mirrors": { preTrip: false, postTrip: false },
    "body-damage": { preTrip: false, postTrip: false },
    "vehicle-leaks": { preTrip: false, postTrip: false },
    "passenger-ramp": { preTrip: false, postTrip: false },
  })

  const [interiorChecks, setInteriorChecks] = useState({
    speedometer: { preTrip: false, postTrip: false },
    "heaters-defroster": { preTrip: false, postTrip: false },
    "air-conditioner": { preTrip: false, postTrip: false },
    gauges: { preTrip: false, postTrip: false },
    "horn-lights": { preTrip: false, postTrip: false },
    "operator-seat": { preTrip: false, postTrip: false },
    "passenger-seat": { preTrip: false, postTrip: false },
    handrails: { preTrip: false, postTrip: false },
    radio: { preTrip: false, postTrip: false },
    steering: { preTrip: false, postTrip: false },
    "front-monitor": { preTrip: false, postTrip: false },
    "fire-ext": { preTrip: false, postTrip: false },
    "accident-packet": { preTrip: false, postTrip: false },
    insurance: { preTrip: false, postTrip: false },
    "wheelchair-straps": { preTrip: false, postTrip: false },
    "exhaust-noise": { preTrip: false, postTrip: false },
    "parking-brake": { preTrip: false, postTrip: false },
    "interior-clean": { preTrip: false, postTrip: false },
    "interior-lights": { preTrip: false, postTrip: false },
    "destination-sign": { preTrip: false, postTrip: false },
    "backup-alarm": { preTrip: false, postTrip: false },
    "rear-monitor": { preTrip: false, postTrip: false },
  })

  const [brakeChecks, setBrakeChecks] = useState({
    "cut-in-pressure": { preTrip: false, postTrip: false, value: "" },
    "cut-out-pressure": { preTrip: false, postTrip: false, value: "" },
    "static-press-on": { preTrip: false, postTrip: false, value: "" },
    "static-press-off": { preTrip: false, postTrip: false, value: "" },
    "applied-pressure": { preTrip: false, postTrip: false, value: "" },
    "low-pressure-warning": { preTrip: false, postTrip: false, value: "" },
    "auto-pop-out": { preTrip: false, postTrip: false, value: "" },
    "park-brake-hold": { preTrip: false, postTrip: false },
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleCheckboxChange = (section: string, item: string, type: string) => {
    const updateSection =
      section === "exterior" ? setExteriorChecks : section === "interior" ? setInteriorChecks : setBrakeChecks

    const currentSection =
      section === "exterior" ? exteriorChecks : section === "interior" ? interiorChecks : brakeChecks

    updateSection({
      ...currentSection,
      [item]: { ...currentSection[item], [type]: !currentSection[item][type] },
    })
  }

  const handleBrakeValueChange = (item: string, value: string) => {
    setBrakeChecks({
      ...brakeChecks,
      [item]: { ...brakeChecks[item], value },
    })
  }

  // Get canvas data as base64 image
  const getCanvasData = (): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    
    try {
      return canvas.toDataURL('image/png')
    } catch (e) {
      console.error('Error getting canvas data:', e)
      return null
    }
  }

  const handleSubmit = () => {
    // Capture the bus canvas drawing
    const busCanvasImage = getCanvasData()
    
    const submissionData = {
      ...formData,
      exteriorChecks,
      interiorChecks,
      brakeChecks,
      busCanvasImage, // Include the canvas drawing as base64
      timestamp: new Date().toISOString(),
    }

    console.log("DVI Form Submission:", submissionData)
    
    if (onSubmit) {
      onSubmit(submissionData)
    } else {
      alert("Form submitted! Check console for data structure.")
    }
  }

  const exteriorLabels: Record<string, string> = {
    "lights-lenses": "All lights & lenses*",
    "turn-signals": "Turn signals & 4-way flashers*",
    "windshield-wipers": "Windshield wipers & washers*",
    "door-operation": "Door operation, seals intact/tight",
    "emergency-doors": "Emergency door/windows",
    "tires-wheels": "Tires, wheels & lugnuts*",
    "glass-mirrors": "Glass & mirrors*",
    "body-damage": "Body damage/lettering/decals",
    "vehicle-leaks": "Under vehicle leaks*",
    "passenger-ramp": "Passenger ramp operation",
  }

  const interiorLabels: Record<string, string> = {
    speedometer: "Speedometer/instruments",
    "heaters-defroster": "Heaters, defroster & ventilation",
    "air-conditioner": "Air conditioner",
    gauges: "All gauges*",
    "horn-lights": "Horn/dashlights/hi/lo/indicator*",
    "operator-seat": "Operator seat operation & belt",
    "passenger-seat": "Passenger seat securement",
    handrails: "Handrails",
    radio: "2-way radio operation",
    steering: "Steering operation",
    "front-monitor": "Front Monitor*",
    "fire-ext": "Fire Ext./Triangles/First aid kit",
    "accident-packet": "Accident Packet",
    insurance: "Vehicle Insurance & Reg.",
    "wheelchair-straps": "Wheelchair securement straps",
    "exhaust-noise": "Exhaust noise",
    "parking-brake": "Parking brake",
    "interior-clean": "Interior clean",
    "interior-lights": "Interior lights",
    "destination-sign": "Destination sign",
    "backup-alarm": "Backup alarm",
    "rear-monitor": "Rear Monitor*",
  }

  const brakeLabels: Record<string, string> = {
    "cut-in-pressure": "Cut In pressure",
    "cut-out-pressure": "Cut out pressure",
    "static-press-on": "Static press, loss P/B on",
    "static-press-off": "Static press, loss P/B off",
    "applied-pressure": "Applied pressure loss",
    "low-pressure-warning": "Low pressure warning*",
    "auto-pop-out": "Auto pop out (park brake)*",
    "park-brake-hold": "Park brake hold",
  }

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [canvasInitialized, setCanvasInitialized] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || canvasInitialized) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src="/images/design-mode/bus-Photoroom(1).png"
    
    img.onload = () => {
      // Set canvas size to match image
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      setCanvasInitialized(true)
    }
  }, [canvasInitialized])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let x, y
    if ('touches' in e) {
      x = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width)
      y = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height)
    } else {
      x = (e.clientX - rect.left) * (canvas.width / rect.width)
      y = (e.clientY - rect.top) * (canvas.height / rect.height)
    }

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let x, y
    if ('touches' in e) {
      e.preventDefault()
      x = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width)
      y = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height)
    } else {
      x = (e.clientX - rect.left) * (canvas.width / rect.width)
      y = (e.clientY - rect.top) * (canvas.height / rect.height)
    }

    ctx.strokeStyle = "#E31E24"
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src="/images/design-mode/bus-Photoroom(1).png"
    
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-5xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="bg-white p-4 sm:p-6 border-b-4 border-black">
          <h1 className="text-xl sm:text-2xl font-bold text-center">VEHICLE INSPECTION</h1>
        </div>

        <div className="p-3 sm:p-6 border-b overflow-hidden">
          <div className="space-y-4">
            {/* Row 1: Bus Type, Bus #, Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">BUS TYPE</label>
                <select
                  value={formData.vehicleType}
                  onChange={(e) => {
                    const type = e.target.value as "" | "ev" | "diesel"
                    setFormData(prev => ({ ...prev, vehicleType: type, busNumber: "", vehicleStatus: "" }))
                  }}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm bg-white"
                >
                  <option value="">Select type...</option>
                  <option value="ev">EV</option>
                  <option value="diesel">Diesel</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">BUS #</label>
                <select
                  value={formData.busNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, busNumber: e.target.value }))}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-100"
                  disabled={!formData.vehicleType}
                >
                  <option value="">{formData.vehicleType ? "Select bus #..." : "Select type first..."}</option>
                  {formData.vehicleType === "ev" && (
                    Array.from({ length: 50 }, (_, i) => {
                      const num = String(i + 1).padStart(2, "0")
                      return <option key={`ev-${num}`} value={`EV ${num}`}>EV {num}</option>
                    })
                  )}
                  {formData.vehicleType === "diesel" && (
                    Array.from({ length: 99 }, (_, i) => {
                      const num = String(i + 1).padStart(2, "0")
                      return <option key={`diesel-${num}`} value={num}>{num}</option>
                    })
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">STATUS</label>
                <select
                  value={formData.vehicleStatus}
                  onChange={(e) => setFormData(prev => ({ ...prev, vehicleStatus: e.target.value as any }))}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm bg-white disabled:bg-gray-100"
                  disabled={!formData.vehicleType}
                >
                  <option value="">{formData.vehicleType ? "Select status..." : "Select type first..."}</option>
                  {formData.vehicleType === "ev" && (
                    <>
                      <option value="ready">Ready</option>
                      <option value="charging">Charging</option>
                      <option value="biohazard">Biohazard</option>
                      <option value="shop">Shop</option>
                    </>
                  )}
                  {formData.vehicleType === "diesel" && (
                    <>
                      <option value="full">Full Tank</option>
                      <option value="3/4">¾ Tank</option>
                      <option value="1/2">½ Tank</option>
                      <option value="1/4">¼ Tank</option>
                      <option value="empty">Empty</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Row 2: Date, 10-8 Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">DATE</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">10-8 TIME</label>
                <input
                  type="time"
                  name="tenEightTime"
                  value={formData.tenEightTime}
                  onChange={handleInputChange}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="text-xs italic py-1">
              I indicate by my signature that I have reviewed the previous operator&apos;s vehicle inspection report.
            </div>

            {/* Row 3: Operator Name, Signature, Miles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">Operator Name</label>
                <input
                  type="text"
                  name="operatorName"
                  value={formData.operatorName}
                  onChange={handleInputChange}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm bg-gray-100"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">Signature</label>
                <input
                  type="text"
                  name="operatorSignature"
                  value={formData.operatorSignature}
                  onChange={handleInputChange}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">Miles</label>
                <input
                  type="number"
                  name="milesDriver"
                  value={formData.milesDriver}
                  onChange={handleInputChange}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            {/* Row 4: Beginning Miles, Beginning Time, Time Worked */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">Beginning Miles</label>
                <input
                  type="number"
                  name="beginningMiles"
                  value={formData.beginningMiles}
                  onChange={handleInputChange}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">Beginning Time</label>
                <input
                  type="time"
                  name="beginningTime"
                  value={formData.beginningTime}
                  onChange={handleInputChange}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm bg-gray-100"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">Time Worked</label>
                <input
                  type="text"
                  name="timeWorked"
                  value={formData.timeWorked}
                  onChange={handleInputChange}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm"
                  placeholder="HH:MM"
                />
              </div>
            </div>

            {/* Row 5: End Miles, End Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">End Miles</label>
                <input
                  type="number"
                  name="endMiles"
                  value={formData.endMiles}
                  onChange={handleInputChange}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold mb-1">End Time</label>
                <input
                  type="time"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  className="w-full border border-black rounded px-2 py-1.5 text-sm bg-gray-100"
                  readOnly
                />
              </div>
            </div>
          </div>

          <div className="text-xs italic mt-4">
            Inspect all items below. Check the box if no defect is found; leave unchecked if defect is found.
          </div>
        </div>

        <div className="p-3 sm:p-6 border-b bg-white">
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
            {/* Canvas with bus diagram */}
            <div className="relative">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full sm:w-auto h-48 sm:h-64 object-contain max-w-full sm:max-w-2xl border-gray-300 rounded cursor-crosshair touch-none border-0"
                style={{ maxWidth: "100%", height: "auto" }}
              />
              <button
                onClick={clearCanvas}
                className="absolute top-2 -right-12 sm:-right-16 bg-red-600 text-white p-2 rounded-full hover:bg-red-700 shadow-lg"
                title="Clear drawings"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <h2 className="text-base sm:text-lg font-bold mb-4 text-center underline">VEHICLE EXTERIOR CHECKS</h2>
          <div className="overflow-x-auto">
            <div className="min-w-[400px]">
              <div className="grid grid-cols-5 gap-1 text-xs font-bold mb-2 border-b pb-2">
                <div className="col-span-3"></div>
                <div className="text-center">Pre-Trip</div>
                <div className="text-center">Post-Trip</div>
              </div>
              {Object.keys(exteriorChecks).map((item) => (
                <div key={item} className="grid grid-cols-5 gap-1 items-center py-1.5 border-b">
                  <div className="col-span-3 text-xs sm:text-sm">{exteriorLabels[item]}</div>
                  <div className="flex justify-center">
                    <div className="w-6 h-6 border border-black flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={exteriorChecks[item as keyof typeof exteriorChecks].preTrip}
                        onChange={() => handleCheckboxChange("exterior", item, "preTrip")}
                        className="w-4 h-4"
                      />
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-6 h-6 border border-black flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={exteriorChecks[item as keyof typeof exteriorChecks].postTrip}
                        onChange={() => handleCheckboxChange("exterior", item, "postTrip")}
                        className="w-4 h-4"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-b">
          <h2 className="text-lg font-bold mb-4 text-center underline">VEHICLE INTERIOR CHECKS</h2>
          <div className="grid grid-cols-5 gap-1 text-xs font-bold mb-2 border-b pb-2">
            <div className="col-span-3"></div>
            <div className="text-center">Pre-Trip</div>
            <div className="text-center">Post-Trip</div>
          </div>
          {Object.keys(interiorChecks).map((item) => (
            <div key={item} className="grid grid-cols-5 gap-1 items-center py-1.5 border-b">
              <div className="col-span-3 text-sm">{interiorLabels[item]}</div>
              <div className="flex justify-center">
                <div className="w-6 h-6 border border-black flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={interiorChecks[item as keyof typeof interiorChecks].preTrip}
                    onChange={() => handleCheckboxChange("interior", item, "preTrip")}
                    className="w-4 h-4"
                  />
                </div>
              </div>
              <div className="flex justify-center">
                <div className="w-6 h-6 border border-black flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={interiorChecks[item as keyof typeof interiorChecks].postTrip}
                    onChange={() => handleCheckboxChange("interior", item, "postTrip")}
                    className="w-4 h-4"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 border-b">
          <h2 className="text-lg font-bold mb-2 text-center underline">BRAKE SYSTEM CHECKS</h2>
          <p className="text-xs text-center mb-4">(AIR)</p>
          <div className="grid grid-cols-6 gap-1 text-xs font-bold mb-2 border-b pb-2">
            <div className="col-span-3"></div>
            <div className="text-center">Pre-Trip</div>
            <div className="text-center">Post-Trip</div>
            <div className="text-center">PSI</div>
          </div>
          {Object.keys(brakeChecks).map((item) => (
            <div key={item} className="grid grid-cols-6 gap-1 items-center py-1.5 border-b">
              <div className="col-span-3 text-sm">{brakeLabels[item]}</div>
              <div className="flex justify-center">
                <div className="w-6 h-6 border border-black flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={brakeChecks[item as keyof typeof brakeChecks].preTrip}
                    onChange={() => handleCheckboxChange("brake", item, "preTrip")}
                    className="w-4 h-4"
                  />
                </div>
              </div>
              <div className="flex justify-center">
                <div className="w-6 h-6 border border-black flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={brakeChecks[item as keyof typeof brakeChecks].postTrip}
                    onChange={() => handleCheckboxChange("brake", item, "postTrip")}
                    className="w-4 h-4"
                  />
                </div>
              </div>
              <div className="flex justify-center">
                {item !== "park-brake-hold" ? (
                  <input
                    type="number"
                    value={brakeChecks[item as keyof typeof brakeChecks].value}
                    onChange={(e) => handleBrakeValueChange(item, e.target.value)}
                    className="w-full border border-black px-2 py-1 text-sm text-center"
                    placeholder="PSI"
                  />
                ) : null}
              </div>
            </div>
          ))}
          <p className="text-xs italic mt-3">
            *Indicates items to be checked on a &quot;Mini Pre-Trip&quot; inspection.
          </p>
        </div>

        <div className="p-6 border-b">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-sm font-bold">Operator Comments:</span>
            <div className="flex-1 border-b border-black h-1"></div>
          </div>
          <textarea
            name="operatorComments"
            value={formData.operatorComments}
            onChange={handleInputChange}
            className="w-full border border-black px-3 py-2 h-24 text-sm"
          />
        </div>

        <div className="p-6 border-b">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold">NEXT DRIVER REVIEWED THIS DVI:</span>
            <input
              type="text"
              name="nextDriverReviewed"
              value={formData.nextDriverReviewed}
              onChange={handleInputChange}
              className="flex-1 border-b border-black px-2 py-1"
            />
          </div>
        </div>

        <div className="p-6 border-b">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-sm font-bold">Technician&apos;s Comments:</span>
            <div className="flex-1 border-b border-black h-1"></div>
          </div>
          <textarea
            name="techComments"
            value={formData.techComments}
            onChange={handleInputChange}
            className="w-full border border-black px-3 py-2 h-24 text-sm"
          />
          <div className="flex gap-4 mt-4">
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold whitespace-nowrap">Technician&apos;s Signature:</span>
                <input
                  type="text"
                  name="techSignature"
                  value={formData.techSignature}
                  onChange={handleInputChange}
                  className="flex-1 border-b border-black px-2 py-1"
                />
              </div>
            </div>
            <div className="w-48">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold whitespace-nowrap">Date:</span>
                <input
                  type="date"
                  name="techDate"
                  value={formData.techDate}
                  onChange={handleInputChange}
                  className="flex-1 border-b border-black px-2 py-1"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-gray-50">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => alert("Photo upload feature - integrate with device camera")}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 text-sm sm:text-base"
            >
              <Camera size={18} className="sm:w-5 sm:h-5" />
              Add Photos
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 text-sm sm:text-base"
            >
              <Save size={18} className="sm:w-5 sm:h-5" />
              Submit Inspection
            </button>
          </div>
        </div>

        <div className="bg-gray-100 text-black text-xs p-2 text-right border-t">RAC DVIR 40FT Gillig</div>
      </div>
    </div>
  )
}
