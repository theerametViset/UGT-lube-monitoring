"use client";

// Real, downloadable PDF generation for the print-style report/AI-chat docs.
// Renders the ALREADY-VISIBLE HTML (so Thai text/fonts are correct without
// needing to embed a Thai-compatible font in jsPDF, which has no built-in
// Unicode font) into a canvas via html2canvas, then slices that image across
// A4 pages in jsPDF. Both libs are dynamically imported so they never bloat
// the main bundle — only loaded when a user actually clicks "ดาวน์โหลด PDF".
export async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(el, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  // JPEG (lossy) instead of PNG — this content is mostly flat white with text/
  // tables, not photographic detail, so PNG's lossless encoding was producing
  // multi-tens-of-MB files for no visible quality benefit at normal zoom.
  const imgData = canvas.toDataURL("image/jpeg", 0.85);

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
