import jsPDF from 'jspdf'

// PDF Generator utility for form submissions

interface DVIRecordData {
  id: string
  employee_id: string
  inspection_date: string
  inspection_type: string
  inspection_data: Record<string, any> | null
  notes: string | null
  is_passed: boolean
  vehicle_number?: string
  employees?: { name: string }
}

interface IncidentReportData {
  id: string
  employee_name: string
  incident_date: string
  incident_time: string
  incident_location: string
  bus_number: string | null
  supervisor_contacted: string | null
  details: string
  witnesses: string | null
  passenger_name: string | null
  passenger_address: string | null
  passenger_city_state_zip: string | null
  passenger_phone: string | null
  date_completed: string
  time_completed: string
}

interface TimeOffRequestData {
  id: string
  employee_name: string
  mailbox_number: string | null
  submission_date: string
  dates_requested: string[]
  request_type: string
  status: string
  days_available: boolean[]
}

interface OvertimeRequestData {
  id: string
  employee_name: string
  seniority_number: string | null
  date_submitted: string
  shift_date: string | null
  start_time: string | null
  end_time: string | null
  pay_hours: string | null
  reason: string | null
  status: string
}

interface FmlaConversionData {
  id: string
  employee_name: string
  mailbox_number: string | null
  submission_date: string
  dates_to_convert: string[]
  use_vacation_pay: boolean[]
  status: string
  reason_for_disapproval: string | null
}

interface TimesheetData {
  id: string
  employee_id: string
  operator_name: string | null
  bus_number: string | null
  check_in: string | null
  check_out: string | null
  brk_windows: string | null
  entries: Array<{
    workOrder: string
    description: string
    straightTime: string
    overTime: string
    totalHours: string
  }> | null
  totals: {
    straightTime: string
    overTime: string
    totalHours: string
    rac?: number
    other?: number
    stand?: number
  } | null
  date: string
  employees?: { name: string }
}

// Exterior check labels
const exteriorLabels: Record<string, string> = {
  "lights-lenses": "All lights & lenses",
  "turn-signals": "Turn signals & 4-way flashers",
  "windshield-wipers": "Windshield wipers & washers",
  "door-operation": "Door operation, seals intact/tight",
  "emergency-doors": "Emergency door/windows",
  "tires-wheels": "Tires, wheels & lugnuts",
  "glass-mirrors": "Glass & mirrors",
  "body-damage": "Body damage/lettering/decals",
  "vehicle-leaks": "Under vehicle leaks",
  "passenger-ramp": "Passenger ramp operation",
}

// Interior check labels
const interiorLabels: Record<string, string> = {
  speedometer: "Speedometer/instruments",
  "heaters-defroster": "Heaters, defroster & ventilation",
  "air-conditioner": "Air conditioner",
  gauges: "All gauges",
  "horn-lights": "Horn/dashlights/hi/lo/indicator",
  "operator-seat": "Operator seat operation & belt",
  "passenger-seat": "Passenger seat securement",
  handrails: "Handrails",
  radio: "2-way radio",
  steering: "Steering",
  "front-monitor": "Front Monitor",
  "fire-ext": "Fire Ext./Triangle",
  "accident-packet": "Accident Packet",
  insurance: "Vehicle Insurance & Reg.",
  "wheelchair-straps": "Wheelchair securement straps",
  "exhaust-noise": "Exhaust noise",
  "parking-brake": "Parking brake",
  "interior-clean": "Interior clean",
  "interior-lights": "Interior lights",
  "destination-sign": "Destination sign",
  "backup-alarm": "Backup alarm",
  "rear-monitor": "Rear Monitor",
}

// Brake check labels
const brakeLabels: Record<string, string> = {
  "cut-in-pressure": "Cut In pressure",
  "cut-out-pressure": "Cut out pressure",
  "static-press-on": "Static press, loss P/B on",
  "static-press-off": "Static press, loss P/B off",
  "applied-pressure": "Applied pressure loss",
  "low-pressure-warning": "Low pressure warning",
  "auto-pop-out": "Auto pop-out valve",
  "park-brake-hold": "Park brake hold",
}

function addHeader(doc: jsPDF, title: string) {
  doc.setFillColor(227, 30, 36) // #E31E24
  doc.rect(0, 0, 210, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 105, 13, { align: 'center' })
  doc.setTextColor(0, 0, 0)
}

function addLabelValue(doc: jsPDF, label: string, value: string, x: number, y: number, labelWidth: number = 40) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(label + ':', x, y)
  doc.setFont('helvetica', 'normal')
  doc.text(value || '-', x + labelWidth, y)
}

export function generateDVIPdf(record: DVIRecordData): void {
  const doc = new jsPDF()
  const inspectionData = record.inspection_data || {}
  
  addHeader(doc, 'VEHICLE INSPECTION REPORT')
  
  let y = 30
  
  // Basic info section
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Inspection Details', 10, y)
  y += 8
  
  doc.setFontSize(10)
  addLabelValue(doc, 'Date', new Date(record.inspection_date).toLocaleDateString(), 10, y)
  addLabelValue(doc, 'Employee', record.employees?.name || 'Unknown', 110, y)
  y += 6
  
  addLabelValue(doc, 'Vehicle #', record.vehicle_number || inspectionData.busNumber || '-', 10, y)
  addLabelValue(doc, 'Type', inspectionData.vehicleType?.toUpperCase() || record.inspection_type || '-', 110, y)
  y += 6
  
  addLabelValue(doc, 'Status', record.is_passed ? 'PASSED' : 'FAILED', 10, y)
  addLabelValue(doc, 'Vehicle Status', inspectionData.vehicleStatus || '-', 110, y)
  y += 10
  
  // Additional form data
  if (inspectionData.beginningMiles || inspectionData.endMiles) {
    addLabelValue(doc, 'Beginning Miles', inspectionData.beginningMiles || '-', 10, y)
    addLabelValue(doc, 'End Miles', inspectionData.endMiles || '-', 110, y)
    y += 6
  }
  
  if (inspectionData.beginningTime || inspectionData.endTime) {
    addLabelValue(doc, 'Beginning Time', inspectionData.beginningTime || '-', 10, y)
    addLabelValue(doc, 'End Time', inspectionData.endTime || '-', 110, y)
    y += 6
  }
  
  if (inspectionData.operatorSignature) {
    addLabelValue(doc, 'Operator Signature', inspectionData.operatorSignature, 10, y)
    y += 6
  }
  
  y += 4
  
  // Bus Canvas Image
  if (inspectionData.busCanvasImage) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Vehicle Diagram', 10, y)
    y += 5
    
    try {
      // Add the canvas image
      doc.addImage(inspectionData.busCanvasImage, 'PNG', 10, y, 190, 60)
      y += 65
    } catch (e) {
      console.error('Error adding bus diagram to PDF:', e)
      y += 5
    }
  }
  
  // Exterior Checks
  if (inspectionData.exteriorChecks) {
    if (y > 200) {
      doc.addPage()
      y = 20
    }
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Vehicle Exterior Checks', 10, y)
    y += 8
    
    // Table header
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Item', 10, y)
    doc.text('Pre-Trip', 140, y)
    doc.text('Post-Trip', 170, y)
    y += 5
    doc.line(10, y - 2, 200, y - 2)
    
    doc.setFont('helvetica', 'normal')
    Object.entries(inspectionData.exteriorChecks).forEach(([key, value]: [string, any]) => {
      if (y > 280) {
        doc.addPage()
        y = 20
      }
      const label = exteriorLabels[key] || key.replace(/-/g, ' ')
      doc.text(label, 10, y)
      doc.text(value?.preTrip ? '✓' : '✗', 145, y)
      doc.text(value?.postTrip ? '✓' : '✗', 177, y)
      y += 5
    })
    y += 5
  }
  
  // Interior Checks
  if (inspectionData.interiorChecks) {
    if (y > 200) {
      doc.addPage()
      y = 20
    }
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Vehicle Interior Checks', 10, y)
    y += 8
    
    // Table header
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Item', 10, y)
    doc.text('Pre-Trip', 140, y)
    doc.text('Post-Trip', 170, y)
    y += 5
    doc.line(10, y - 2, 200, y - 2)
    
    doc.setFont('helvetica', 'normal')
    Object.entries(inspectionData.interiorChecks).forEach(([key, value]: [string, any]) => {
      if (y > 280) {
        doc.addPage()
        y = 20
      }
      const label = interiorLabels[key] || key.replace(/-/g, ' ')
      doc.text(label, 10, y)
      doc.text(value?.preTrip ? '✓' : '✗', 145, y)
      doc.text(value?.postTrip ? '✓' : '✗', 177, y)
      y += 5
    })
    y += 5
  }
  
  // Brake Checks
  if (inspectionData.brakeChecks) {
    if (y > 180) {
      doc.addPage()
      y = 20
    }
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Brake System Checks', 10, y)
    y += 8
    
    // Table header
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Item', 10, y)
    doc.text('Pre-Trip', 120, y)
    doc.text('Post-Trip', 150, y)
    doc.text('PSI', 180, y)
    y += 5
    doc.line(10, y - 2, 200, y - 2)
    
    doc.setFont('helvetica', 'normal')
    Object.entries(inspectionData.brakeChecks).forEach(([key, value]: [string, any]) => {
      if (y > 280) {
        doc.addPage()
        y = 20
      }
      const label = brakeLabels[key] || key.replace(/-/g, ' ')
      doc.text(label, 10, y)
      doc.text(value?.preTrip ? '✓' : '✗', 127, y)
      doc.text(value?.postTrip ? '✓' : '✗', 157, y)
      doc.text(value?.value || '-', 180, y)
      y += 5
    })
    y += 5
  }
  
  // Operator Comments
  if (inspectionData.operatorComments) {
    if (y > 250) {
      doc.addPage()
      y = 20
    }
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Operator Comments', 10, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const comments = doc.splitTextToSize(inspectionData.operatorComments, 190)
    doc.text(comments, 10, y)
    y += comments.length * 5 + 5
  }
  
  // Technician Comments
  if (inspectionData.techComments) {
    if (y > 250) {
      doc.addPage()
      y = 20
    }
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Technician Comments', 10, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const comments = doc.splitTextToSize(inspectionData.techComments, 190)
    doc.text(comments, 10, y)
  }
  
  // Notes
  if (record.notes) {
    if (y > 250) {
      doc.addPage()
      y = 20
    }
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Additional Notes', 10, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const notes = doc.splitTextToSize(record.notes, 190)
    doc.text(notes, 10, y)
  }
  
  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generated on ${new Date().toLocaleString()}`, 10, 290)
  doc.text(`Record ID: ${record.id}`, 200, 290, { align: 'right' })
  
  doc.save(`DVI-${record.vehicle_number || 'Unknown'}-${new Date(record.inspection_date).toISOString().split('T')[0]}.pdf`)
}

export function generateIncidentReportPdf(report: IncidentReportData): void {
  const doc = new jsPDF()
  
  addHeader(doc, 'INCIDENT REPORT')
  
  let y = 30
  
  // Employee and Date Info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Report Information', 10, y)
  y += 8
  
  doc.setFontSize(10)
  addLabelValue(doc, 'Employee', report.employee_name, 10, y, 35)
  addLabelValue(doc, 'Bus #', report.bus_number || '-', 110, y, 25)
  y += 6
  
  addLabelValue(doc, 'Incident Date', new Date(report.incident_date).toLocaleDateString(), 10, y, 35)
  addLabelValue(doc, 'Time', report.incident_time, 110, y, 25)
  y += 6
  
  addLabelValue(doc, 'Location', report.incident_location, 10, y, 35)
  y += 6
  
  if (report.supervisor_contacted) {
    addLabelValue(doc, 'Supervisor Contacted', report.supervisor_contacted, 10, y, 50)
    y += 6
  }
  
  y += 5
  
  // Details
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Details of Incident', 10, y)
  y += 6
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const details = doc.splitTextToSize(report.details, 190)
  doc.text(details, 10, y)
  y += details.length * 5 + 10
  
  // Witnesses
  if (report.witnesses) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Witnesses', 10, y)
    y += 6
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const witnesses = doc.splitTextToSize(report.witnesses, 190)
    doc.text(witnesses, 10, y)
    y += witnesses.length * 5 + 10
  }
  
  // Passenger Information
  if (report.passenger_name || report.passenger_address || report.passenger_phone) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Passenger Information', 10, y)
    y += 8
    
    doc.setFontSize(10)
    if (report.passenger_name) {
      addLabelValue(doc, 'Name', report.passenger_name, 10, y, 30)
      y += 6
    }
    if (report.passenger_address) {
      addLabelValue(doc, 'Address', report.passenger_address, 10, y, 30)
      y += 6
    }
    if (report.passenger_city_state_zip) {
      addLabelValue(doc, 'City/State/Zip', report.passenger_city_state_zip, 10, y, 35)
      y += 6
    }
    if (report.passenger_phone) {
      addLabelValue(doc, 'Phone', report.passenger_phone, 10, y, 30)
      y += 6
    }
  }
  
  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generated on ${new Date().toLocaleString()}`, 10, 290)
  doc.text(`Record ID: ${report.id}`, 200, 290, { align: 'right' })
  
  doc.save(`Incident-Report-${report.employee_name}-${new Date(report.incident_date).toISOString().split('T')[0]}.pdf`)
}

export function generateTimeOffRequestPdf(request: TimeOffRequestData): void {
  const doc = new jsPDF()
  
  addHeader(doc, 'TIME OFF REQUEST')
  
  let y = 30
  
  // Employee Info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Request Information', 10, y)
  y += 8
  
  doc.setFontSize(10)
  addLabelValue(doc, 'Employee', request.employee_name, 10, y, 35)
  addLabelValue(doc, 'Mailbox', request.mailbox_number || '-', 110, y, 25)
  y += 6
  
  addLabelValue(doc, 'Submitted', new Date(request.submission_date).toLocaleDateString(), 10, y, 35)
  addLabelValue(doc, 'Status', request.status.toUpperCase(), 110, y, 25)
  y += 6
  
  addLabelValue(doc, 'Request Type', request.request_type.replace('_', '/').toUpperCase(), 10, y, 35)
  y += 10
  
  // Dates Requested
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Dates Requested', 10, y)
  y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  
  request.dates_requested.forEach((date, idx) => {
    if (y > 280) {
      doc.addPage()
      y = 20
    }
    const available = request.days_available?.[idx] ? ' (Available)' : ''
    doc.text(`• ${new Date(date).toLocaleDateString()}${available}`, 15, y)
    y += 5
  })
  
  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generated on ${new Date().toLocaleString()}`, 10, 290)
  doc.text(`Record ID: ${request.id}`, 200, 290, { align: 'right' })
  
  doc.save(`TimeOff-Request-${request.employee_name}-${new Date(request.submission_date).toISOString().split('T')[0]}.pdf`)
}

export function generateOvertimeRequestPdf(request: OvertimeRequestData): void {
  const doc = new jsPDF()
  
  addHeader(doc, 'OVERTIME REQUEST')
  
  let y = 30
  
  // Employee Info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Request Information', 10, y)
  y += 8
  
  doc.setFontSize(10)
  addLabelValue(doc, 'Employee', request.employee_name, 10, y, 40)
  if (request.seniority_number) {
    addLabelValue(doc, 'Seniority #', request.seniority_number, 110, y, 30)
  }
  y += 6
  
  addLabelValue(doc, 'Submitted', new Date(request.date_submitted).toLocaleDateString(), 10, y, 40)
  addLabelValue(doc, 'Status', request.status === 'not_awarded' ? 'NOT AWARDED' : request.status.toUpperCase(), 110, y, 30)
  y += 6
  
  if (request.shift_date) {
    addLabelValue(doc, 'Shift Date', new Date(request.shift_date).toLocaleDateString(), 10, y, 40)
    y += 6
  }
  
  if (request.start_time || request.end_time) {
    addLabelValue(doc, 'Time', `${request.start_time || '-'} - ${request.end_time || '-'}`, 10, y, 40)
    if (request.pay_hours) {
      addLabelValue(doc, 'Pay Hours', request.pay_hours, 110, y, 30)
    }
    y += 6
  }
  
  if (request.reason) {
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Reason', 10, y)
    y += 6
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const reason = doc.splitTextToSize(request.reason, 190)
    doc.text(reason, 10, y)
  }
  
  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generated on ${new Date().toLocaleString()}`, 10, 290)
  doc.text(`Record ID: ${request.id}`, 200, 290, { align: 'right' })
  
  doc.save(`Overtime-Request-${request.employee_name}-${new Date(request.date_submitted).toISOString().split('T')[0]}.pdf`)
}

export function generateFmlaConversionPdf(request: FmlaConversionData): void {
  const doc = new jsPDF()
  
  addHeader(doc, 'FMLA CONVERSION REQUEST')
  
  let y = 30
  
  // Employee Info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Request Information', 10, y)
  y += 8
  
  doc.setFontSize(10)
  addLabelValue(doc, 'Employee', request.employee_name, 10, y, 35)
  if (request.mailbox_number) {
    addLabelValue(doc, 'Mailbox', request.mailbox_number, 110, y, 25)
  }
  y += 6
  
  addLabelValue(doc, 'Submitted', new Date(request.submission_date).toLocaleDateString(), 10, y, 35)
  addLabelValue(doc, 'Status', request.status.toUpperCase(), 110, y, 25)
  y += 10
  
  // Dates to Convert
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Dates to Convert', 10, y)
  y += 8
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  
  request.dates_to_convert.forEach((date, idx) => {
    if (y > 280) {
      doc.addPage()
      y = 20
    }
    const vacationPay = request.use_vacation_pay?.[idx] ? ' (Using Vacation Pay)' : ''
    doc.text(`• ${new Date(date).toLocaleDateString()}${vacationPay}`, 15, y)
    y += 5
  })
  
  // Reason for Disapproval
  if (request.reason_for_disapproval) {
    y += 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(227, 30, 36)
    doc.text('Reason for Disapproval', 10, y)
    y += 6
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    const reason = doc.splitTextToSize(request.reason_for_disapproval, 190)
    doc.text(reason, 10, y)
  }
  
  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generated on ${new Date().toLocaleString()}`, 10, 290)
  doc.text(`Record ID: ${request.id}`, 200, 290, { align: 'right' })
  
  doc.save(`FMLA-Conversion-${request.employee_name}-${new Date(request.submission_date).toISOString().split('T')[0]}.pdf`)
}

export function generateTimesheetPdf(timesheet: TimesheetData): void {
  const doc = new jsPDF()
  
  addHeader(doc, 'TIMESHEET')
  
  let y = 30
  
  // Employee Info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Timesheet Information', 10, y)
  y += 8
  
  doc.setFontSize(10)
  addLabelValue(doc, 'Employee', timesheet.employees?.name || timesheet.operator_name || 'Unknown', 10, y, 35)
  addLabelValue(doc, 'Date', new Date(timesheet.date).toLocaleDateString(), 110, y, 25)
  y += 6
  
  if (timesheet.bus_number) {
    addLabelValue(doc, 'Bus #', timesheet.bus_number, 10, y, 35)
    y += 6
  }
  
  if (timesheet.check_in || timesheet.check_out) {
    addLabelValue(doc, 'Check-in', timesheet.check_in || '-', 10, y, 35)
    addLabelValue(doc, 'Check-out', timesheet.check_out || '-', 110, y, 30)
    y += 6
  }
  
  if (timesheet.brk_windows) {
    addLabelValue(doc, 'Break Windows', timesheet.brk_windows, 10, y, 40)
    y += 6
  }
  
  y += 5
  
  // Entries Table
  if (timesheet.entries && timesheet.entries.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Work Entries', 10, y)
    y += 8
    
    // Table header
    doc.setFontSize(9)
    doc.setFillColor(240, 240, 240)
    doc.rect(10, y - 4, 190, 7, 'F')
    doc.text('Work Order', 12, y)
    doc.text('Description', 45, y)
    doc.text('Straight', 130, y)
    doc.text('Overtime', 155, y)
    doc.text('Total', 180, y)
    y += 6
    doc.line(10, y - 2, 200, y - 2)
    
    doc.setFont('helvetica', 'normal')
    timesheet.entries.forEach((entry: any) => {
      if (y > 270) {
        doc.addPage()
        y = 20
      }
      doc.text(entry.workOrder || '-', 12, y)
      const desc = entry.description?.substring(0, 30) || '-'
      doc.text(desc, 45, y)
      doc.text(entry.straightTime || '-', 132, y)
      doc.text(entry.overTime || '-', 157, y)
      doc.text(entry.totalHours || '-', 182, y)
      y += 5
    })
    
    // Totals
    y += 3
    doc.line(10, y - 2, 200, y - 2)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTALS:', 12, y + 2)
    if (timesheet.totals) {
      doc.text(String(timesheet.totals.straightTime || '-'), 132, y + 2)
      doc.text(String(timesheet.totals.overTime || '-'), 157, y + 2)
      doc.text(String(timesheet.totals.totalHours || '-'), 182, y + 2)
    }
  }
  
  // Footer
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text(`Generated on ${new Date().toLocaleString()}`, 10, 290)
  doc.text(`Record ID: ${timesheet.id}`, 200, 290, { align: 'right' })
  
  doc.save(`Timesheet-${timesheet.employees?.name || timesheet.operator_name || 'Unknown'}-${new Date(timesheet.date).toISOString().split('T')[0]}.pdf`)
}
