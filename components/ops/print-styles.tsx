/** Hides the app chrome when printing, so a page prints as a clean paper sheet. */
export function PrintStyles() {
  return (
    <style>{`
      @media print {
        aside, header, nav, [data-sonner-toaster] { display: none !important; }
        main { max-width: none !important; padding: 0 !important; }
        body { background: #fff !important; }
        @page { margin: 12mm; }
      }
    `}</style>
  );
}
