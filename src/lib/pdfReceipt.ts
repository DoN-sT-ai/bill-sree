import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface PDFExportOptions {
  elementId: string;
  filename: string;
  format?: '80mm' | '58mm' | 'a4';
  title?: string;
  text?: string;
}

/**
 * Renders an HTML receipt element into a high-resolution jsPDF instance
 */
export async function generateReceiptPDF(
  elementId: string,
  format: '80mm' | '58mm' | 'a4' = '80mm'
): Promise<{ pdf: jsPDF; blob: Blob }> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Receipt element with id '${elementId}' not found.`);
  }

  // Render high-DPI canvas
  const canvas = await html2canvas(element, {
    scale: 3, // 3x scale for crystal clear fonts, barcode, and QR code
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
  });

  const imgData = canvas.toDataURL('image/png');

  if (format === 'a4') {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    return { pdf, blob: pdf.output('blob') };
  } else {
    // Thermal receipt formats
    const pdfWidth = format === '80mm' ? 80 : 58;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    // Add tiny 4mm bottom margin for tear-off aesthetics
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [pdfWidth, pdfHeight + 4],
    });
    pdf.addImage(imgData, 'PNG', 0, 2, pdfWidth, pdfHeight);
    return { pdf, blob: pdf.output('blob') };
  }
}

/**
 * Downloads the receipt as a PDF file
 */
export async function downloadReceiptPDF(
  elementId: string,
  filename: string,
  format: '80mm' | '58mm' | 'a4' = '80mm'
): Promise<void> {
  const { pdf } = await generateReceiptPDF(elementId, format);
  pdf.save(`${filename}.pdf`);
}

/**
 * Shares the PDF using Web Share API if supported (mobile/tablets/desktops),
 * or falls back to downloading the PDF.
 */
export async function shareReceiptPDF({
  elementId,
  filename,
  format = '80mm',
  title,
  text,
}: PDFExportOptions): Promise<{ sharedViaNative: boolean }> {
  const { pdf, blob } = await generateReceiptPDF(elementId, format);
  const file = new File([blob], `${filename}.pdf`, { type: 'application/pdf' });

  // Check if Web Share API with files is supported
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: title || `${filename}.pdf`,
        text: text || 'Please find your bill receipt attached.',
      });
      return { sharedViaNative: true };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled the share dialog
        return { sharedViaNative: false };
      }
      console.warn('Native share failed, downloading instead:', err);
    }
  }

  // Fallback: download PDF directly
  pdf.save(`${filename}.pdf`);
  return { sharedViaNative: false };
}
