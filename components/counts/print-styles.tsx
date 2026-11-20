/**
 * Print rules for the counting sheet: hides the app shell, prints each sheet
 * black on white on its own page, like the paper form.
 */
export function CountPrintStyles() {
  return (
    <style>{`
      @media print {
        aside, header, nav, [data-sonner-toaster] { display: none !important; }
        main { max-width: none !important; padding: 0 !important; margin: 0 !important; }
        html, body { background: #fff !important; color: #000 !important; }
        @page { margin: 10mm; }
        .paper-wrap { break-after: page; break-inside: avoid; page-break-after: always; }
        .paper-wrap:last-child { break-after: auto; page-break-after: auto; }
        .paper-sheet, .paper-sheet * {
          color: #000 !important;
          border-color: #000 !important;
          background-color: transparent !important;
          box-shadow: none !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .paper-sheet { font-size: 11px; }
        .paper-sheet .sheet-bar, .paper-sheet .sheet-bar * { background-color: #000 !important; color: #fff !important; }
        .paper-sheet .sheet-shade, .paper-sheet .sheet-shade * { background-color: #d9d9d9 !important; }
        .paper-sheet .cell, .paper-sheet input { height: 5.4mm !important; min-height: 0 !important; font-size: 11px !important; }
      }
    `}</style>
  );
}
