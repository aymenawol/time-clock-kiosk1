"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Camera, Save, Trash2, ChevronDown, Search } from 'lucide-react'
import { getActiveVehicles } from "@/lib/api"
import type { Vehicle } from "@/lib/supabase"

interface DVIFormProps {
  onSubmit?: (data: Record<string, any>) => void
  clockInTime?: string
  clockOutTime?: string
}

export default function DVIForm({ onSubmit, clockInTime, clockOutTime }: DVIFormProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState("")
  const vehicleDropdownRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    busNumber: "",
    date: new Date().toISOString().split("T")[0],
    tenEightTime: "",
    operatorName: "",
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

  // Load vehicles from Supabase
  useEffect(() => {
    const loadVehicles = async () => {
      const vehicleList = await getActiveVehicles()
      setVehicles(vehicleList)
    }
    loadVehicles()
  }, [])

  // Close vehicle dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vehicleDropdownRef.current && !vehicleDropdownRef.current.contains(event.target as Node)) {
        setShowVehicleDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredVehicles = vehicles.filter(v => 
    v.vehicle_number.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
    (v.vehicle_type && v.vehicle_type.toLowerCase().includes(vehicleSearchTerm.toLowerCase()))
  )

  const handleVehicleSelect = (vehicle: Vehicle) => {
    setFormData({ ...formData, busNumber: vehicle.vehicle_number })
    setShowVehicleDropdown(false)
    setVehicleSearchTerm("")
  }

  const handleSubmit = () => {
    const submissionData = {
      ...formData,
      exteriorChecks,
      interiorChecks,
      brakeChecks,
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

        <div className="p-3 sm:p-6 border-b">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">BUS #</span>
                  <div className="relative flex-1" ref={vehicleDropdownRef}>
                    <div 
                      className="flex items-center border-b border-black px-2 py-1 cursor-pointer"
                      onClick={() => setShowVehicleDropdown(!showVehicleDropdown)}
                    >
                      <span className={`flex-1 text-sm sm:text-base ${formData.busNumber ? "text-black" : "text-gray-400"}`}>
                        {formData.busNumber || "Select vehicle..."}
                      </span>
                      <ChevronDown size={16} className={`transition-transform ${showVehicleDropdown ? "rotate-180" : ""}`} />
                    </div>
                    
                    {showVehicleDropdown && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
                        <div className="p-2 border-b border-gray-200">
                          <div className="relative">
                            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search vehicles..."
                              value={vehicleSearchTerm}
                              onChange={(e) => setVehicleSearchTerm(e.target.value)}
                              className="w-full pl-7 pr-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="max-h-44 overflow-y-auto">
                          {filteredVehicles.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500">No vehicles found</div>
                          ) : (
                            filteredVehicles.map((vehicle) => (
                              <div
                                key={vehicle.id}
                                onClick={() => handleVehicleSelect(vehicle)}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                              >
                                <span className="font-mono font-bold text-sm">{vehicle.vehicle_number}</span>
                                {vehicle.vehicle_type && (
                                  <span className="text-xs text-gray-500">{vehicle.vehicle_type}</span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">DATE:</span>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="flex-1 border-b border-black px-2 py-1 text-sm sm:text-base"
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">10-8 TIME:</span>
                  <input
                    type="time"
                    name="tenEightTime"
                    value={formData.tenEightTime}
                    onChange={handleInputChange}
                    className="flex-1 border-b border-black px-2 py-1 text-sm sm:text-base"
                  />
                </div>
              </div>
            </div>

            <div className="text-xs italic">
              I indicate by my signature that I have reviewed the previous operator&apos;s vehicle inspection report.
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">Operator Name:</span>
                  <input
                    type="text"
                    name="operatorName"
                    value={formData.operatorName}
                    onChange={handleInputChange}
                    className="flex-1 border-b border-black px-2 py-1 text-sm sm:text-base"
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">Signature:</span>
                  <input
                    type="text"
                    name="operatorSignature"
                    value={formData.operatorSignature}
                    onChange={handleInputChange}
                    className="flex-1 border-b border-black px-2 py-1 text-sm sm:text-base"
                  />
                </div>
              </div>
              <div className="w-full sm:w-32 shrink-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">Miles:</span>
                  <input
                    type="number"
                    name="milesDriver"
                    value={formData.milesDriver}
                    onChange={handleInputChange}
                    className="flex-1 border-b border-black px-2 py-1 text-sm sm:text-base"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">Beginning Miles:</span>
                  <input
                    type="number"
                    name="beginningMiles"
                    value={formData.beginningMiles}
                    onChange={handleInputChange}
                    className="flex-1 border-b border-black px-2 py-1 text-sm sm:text-base"
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">Beginning Time:</span>
                  <input
                    type="time"
                    name="beginningTime"
                    value={formData.beginningTime}
                    onChange={handleInputChange}
                    className="flex-1 border-b border-black px-2 py-1 text-sm sm:text-base bg-gray-100"
                    readOnly
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">Time Worked:</span>
                  <input
                    type="text"
                    name="timeWorked"
                    value={formData.timeWorked}
                    onChange={handleInputChange}
                    className="flex-1 border-b border-black px-2 py-1 text-sm sm:text-base"
                    placeholder="HH:MM"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">End Miles:</span>
                  <input
                    type="number"
                    name="endMiles"
                    value={formData.endMiles}
                    onChange={handleInputChange}
                    className="flex-1 border-b border-black px-2 py-1 text-sm sm:text-base"
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap">End Time:</span>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    className="flex-1 border-b border-black px-2 py-1 text-sm sm:text-base bg-gray-100"
                    readOnly
                  />
                </div>
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
