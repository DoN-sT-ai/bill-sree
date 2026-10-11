import React, { useState, useEffect } from 'react';
import { Sale } from '../../types';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { shareReceiptPDF, downloadReceiptPDF } from '../../lib/pdfReceipt';
import {
  Printer,
  X,
  CheckCircle,
  ExternalLink,
  QrCode as QrIcon,
  Share2,
  Download,
  MessageCircle,
  Copy,
  Check,
  PlusCircle,
  FileText,
  Loader2,
  Smartphone,
} from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale;
  onClose: () => void;
  onNewBill: () => void;
  autoPrint?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  onClose,
  onNewBill,
  autoPrint = true,
}) => {
  const { store } = useAuth();
  // 3-Inch (80mm) Thermal Printer as primary default
  const [printFormat, setPrintFormat] = useState<'80mm' | '58mm' | 'a4'>('80mm');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showWhatsAppDrawer, setShowWhatsAppDrawer] = useState(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState(sale.customer_phone || '');
  const [copiedLink, setCopiedLink] = useState(false);

  const publicVerificationUrl = `${window.location.origin}/?verify=${sale.verification_token}`;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePrint = (targetFormat?: '80mm' | '58mm' | 'a4' | React.MouseEvent) => {
    const fmt = typeof targetFormat === 'string' ? targetFormat : printFormat;
    // Attach body format class for CSS media print rules
    document.body.classList.remove('print-format-58mm', 'print-format-80mm', 'print-format-a4');
    document.body.classList.add(`print-format-${fmt}`);

    window.print();

    // Clean up
    setTimeout(() => {
      document.body.classList.remove('print-format-58mm', 'print-format-80mm', 'print-format-a4');
    }, 1000);
  };

  useEffect(() => {
    // Generate QR Code
    api.getQRCode(publicVerificationUrl)
      .then(res => setQrCodeDataUrl(res.dataUrl))
      .catch(() => {});

    // Auto trigger system print prompt if requested
    if (autoPrint) {
      showToast('Opening print dialog...');
      const printTimer = setTimeout(() => {
        handlePrint('80mm');
      }, 350);

      return () => clearTimeout(printTimer);
    }
  }, [sale.id, sale.verification_token, publicVerificationUrl, autoPrint]);

  const handleSharePDF = async () => {
    try {
      setIsGeneratingPdf(true);
      const res = await shareReceiptPDF({
        elementId: 'printable-receipt',
        filename: `Bill-${sale.bill_number}`,
        format: printFormat,
        title: `Bill #${sale.bill_number} - ${store?.name || 'Tax Invoice'}`,
        text: `Tax Invoice #${sale.bill_number} for ${formatCurrency(sale.total)}. View & verify: ${publicVerificationUrl}`,
      });

      if (res.sharedViaNative) {
        showToast('Shared via device sheet!');
      } else {
        showToast('PDF downloaded successfully!');
      }
    } catch (err: any) {
      console.error('PDF generation error:', err);
      showToast('Could not generate PDF. Please try Print -> Save as PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPdf(true);
      await downloadReceiptPDF('printable-receipt', `Bill-${sale.bill_number}`, printFormat);
      showToast('PDF downloaded to your device!');
    } catch (err: any) {
      console.error('PDF download error:', err);
      showToast('Could not download PDF. Please try Print -> Save as PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSendWhatsApp = () => {
    let cleanPhone = whatsAppPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    const itemsSummary = (sale.items || [])
      .slice(0, 5)
      .map((item, i) => `${i + 1}. ${item.product_name_snapshot} (${item.quantity}x) = ${formatCurrency(item.line_total)}`)
      .join('\n');
    const extraItems = (sale.items?.length || 0) > 5 ? `\n...and ${(sale.items?.length || 0) - 5} more items` : '';

    const text = `🧾 *TAX INVOICE / BILL*\n` +
      `*Store:* ${store?.name || 'Retail Store'}\n` +
      `*Bill No:* ${sale.bill_number}\n` +
      `*Date:* ${formatDateTime(sale.created_at)}\n` +
      (sale.customer_name ? `*Customer:* ${sale.customer_name}\n` : '') +
      `*Total Amount:* ${formatCurrency(sale.total)} (${sale.payment_method})\n` +
      `--------------------------------\n` +
      `*Items Summary:*\n${itemsSummary}${extraItems}\n` +
      `--------------------------------\n` +
      `*View & Verify Digital Bill Online:*\n${publicVerificationUrl}\n\n` +
      `Thank you for your business! 🙏`;

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank', 'noopener,noreferrer');
    showToast('Opening WhatsApp...');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicVerificationUrl);
      setCopiedLink(true);
      showToast('Verification link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast('Failed to copy link.');
    }
  };

  const isExempt = sale.gst_type === 'EXEMPT';
  const isInterState = sale.gst_type === 'INTER_STATE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-xl border border-neutral-200 shadow-2xl max-w-xl w-full max-h-[96vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="p-3 sm:p-4 border-b border-neutral-200 flex items-center justify-between no-print bg-neutral-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                  Bill #{sale.bill_number}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  GENERATED
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                Total: <span className="font-semibold text-white">{formatCurrency(sale.total)}</span> · Paid via {sale.payment_method}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PRIMARY ACTIONS BANNER (Ask: Share as PDF / Print / WhatsApp / New Bill) */}
        <div className="p-3 sm:p-3.5 bg-neutral-50 border-b border-neutral-200 no-print space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-neutral-700 uppercase tracking-wider">
              Quick Actions:
            </div>
            {toastMessage && (
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded animate-pulse">
                {toastMessage}
              </span>
            )}
          </div>

          {/* Action Buttons Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* 1. Print Receipt Button */}
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 active:scale-[0.98] rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Print Receipt using thermal printer or system dialog"
            >
              <Printer className="w-4 h-4 text-neutral-300" />
              <span>Print Bill</span>
            </button>

            {/* 2. Share as PDF Button */}
            <button
              onClick={handleSharePDF}
              disabled={isGeneratingPdf}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98] rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
              title="Share as PDF via device share sheet or download"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>PDF...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-indigo-200" />
                  <span>Share PDF</span>
                </>
              )}
            </button>

            {/* 3. WhatsApp Share Toggle */}
            <button
              onClick={() => setShowWhatsAppDrawer(!showWhatsAppDrawer)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer ${
                showWhatsAppDrawer
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              } active:scale-[0.98]`}
              title="Send bill link and summary via WhatsApp"
            >
              <MessageCircle className="w-4 h-4 text-emerald-200" />
              <span>WhatsApp</span>
            </button>

            {/* 4. Start New Bill */}
            <button
              onClick={onNewBill}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-300 active:scale-[0.98] rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
              title="Close and begin next customer transaction"
            >
              <PlusCircle className="w-4 h-4 text-neutral-500" />
              <span>New Bill</span>
            </button>
          </div>

          {/* WhatsApp Interactive Drawer / Bar */}
          {showWhatsAppDrawer && (
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-2.5 space-y-2 animate-in slide-in-from-top duration-150">
              <div className="flex items-center justify-between text-xs text-emerald-900 font-semibold">
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                  Share Bill via WhatsApp
                </span>
                <button
                  onClick={handleCopyLink}
                  className="text-[11px] text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                  {copiedLink ? 'Copied Link' : 'Copy Online Link'}
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="Customer Phone (e.g. 9876543210)"
                  value={whatsAppPhone}
                  onChange={(e) => setWhatsAppPhone(e.target.value)}
                  className="flex-1 bg-white border border-emerald-300 rounded px-2.5 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <button
                  onClick={handleSendWhatsApp}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition cursor-pointer flex items-center gap-1 shrink-0 shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Send WhatsApp
                </button>
              </div>
              <p className="text-[11px] text-emerald-800 leading-tight">
                Sends full itemized bill summary + verified online link directly to customer's WhatsApp chat.
              </p>
            </div>
          )}

          {/* Secondary Actions & Format Selector Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            {/* Format Buttons */}
            <div className="flex items-center gap-1">
              <span className="text-neutral-500 font-medium mr-1 text-[11px]">Format:</span>
              <button
                onClick={() => setPrintFormat('80mm')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                  printFormat === '80mm'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200'
                }`}
              >
                3" (80mm)
              </button>
              <button
                onClick={() => setPrintFormat('58mm')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                  printFormat === '58mm'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200'
                }`}
              >
                2" (58mm)
              </button>
              <button
                onClick={() => setPrintFormat('a4')}
                className={`px-2 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                  printFormat === 'a4'
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200'
                }`}
              >
                A4 Invoice
              </button>
            </div>

            {/* Direct Download PDF Button */}
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="text-xs text-neutral-600 hover:text-neutral-900 font-medium flex items-center gap-1 bg-white border border-neutral-200 px-2 py-1 rounded hover:bg-neutral-100 transition cursor-pointer disabled:opacity-50"
              title="Download PDF directly to device"
            >
              <Download className="w-3.5 h-3.5 text-neutral-500" />
              Download PDF
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Preview & Printable Target */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-neutral-200/70 flex justify-center items-start">
          <div
            id="printable-receipt"
            className={`bg-white shadow-md border border-neutral-300 text-neutral-900 font-mono transition-all mx-auto ${
              printFormat === '58mm'
                ? 'w-full max-w-[240px] text-[9.5px] p-2 leading-tight'
                : printFormat === '80mm'
                ? 'w-full max-w-[300px] text-[10px] p-2.5 leading-tight'
                : 'w-full max-w-[460px] text-xs p-5 leading-normal'
            }`}
          >
            {/* Store Information Header */}
            <div className="text-center pb-1.5">
              <div className="font-bold text-sm tracking-tight uppercase text-neutral-900">
                {store?.name || 'APEX STORE'}
              </div>
              {store?.address && (
                <div className="text-[9.5px] text-neutral-700 whitespace-pre-line leading-tight mt-0.5">
                  {store.address}
                </div>
              )}
              <div className="text-[9.5px] text-neutral-700 mt-0.5">
                {store?.phone ? `Ph: ${store.phone}` : ''}
                {store?.phone && store?.email ? ' · ' : ''}
                {store?.email ? `Email: ${store.email}` : ''}
              </div>
              {store?.gstin && (
                <div className="text-[10px] font-bold text-neutral-900 mt-0.5">
                  GSTIN: {store.gstin}
                </div>
              )}
            </div>

            {/* Receipt Title Divider */}
            <div className="border-t border-dashed border-neutral-400 py-0.5 text-center font-bold text-[10px] tracking-wider uppercase text-neutral-900">
              {isExempt ? '*** BILL OF SUPPLY ***' : '*** TAX INVOICE ***'}
            </div>

            {/* Bill Meta Section: Key-Value Left/Right Alignment */}
            <div className="border-t border-dashed border-neutral-400 py-1 text-[9.5px] space-y-0.5">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Bill No:</span>
                <span className="font-bold text-neutral-900">{sale.bill_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Date:</span>
                <span>{formatDateTime(sale.created_at)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Cashier:</span>
                <span>{sale.employee_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Payment Mode:</span>
                <span className="font-bold">{sale.payment_method}</span>
              </div>

              {/* Customer Details if present (B2B / B2C Tax Invoice) */}
              {(sale.customer_name || sale.customer_phone || sale.customer_gstin) && (
                <div className="pt-0.5 mt-0.5 border-t border-dotted border-neutral-300 space-y-0.5">
                  {sale.customer_name && (
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-600">Customer:</span>
                      <span className="font-medium truncate max-w-[170px]">{sale.customer_name}</span>
                    </div>
                  )}
                  {sale.customer_phone && (
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-600">Phone:</span>
                      <span>{sale.customer_phone}</span>
                    </div>
                  )}
                  {sale.customer_gstin && (
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-600">Cust GSTIN:</span>
                      <span className="font-bold">{sale.customer_gstin}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="border-t border-dashed border-neutral-400 py-1">
              <div className="flex justify-between text-[9.5px] font-bold pb-0.5 border-b border-dashed border-neutral-300 text-neutral-700">
                <span className="w-1/2 text-left">ITEM / HSN</span>
                <span className="w-1/6 text-center">QTY</span>
                <span className="w-1/6 text-right">RATE</span>
                <span className="w-1/6 text-right">AMOUNT</span>
              </div>

              <div className="divide-y divide-dotted divide-neutral-200 py-0.5 space-y-0.5">
                {sale.items?.map((item, idx) => (
                  <div key={idx} className="pt-0.5 text-[9.5px]">
                    {/* Line 1: Item Name */}
                    <div className="font-semibold text-neutral-900 leading-tight">
                      {idx + 1}. {item.product_name_snapshot}
                    </div>
                    {/* Line 2: Details & Quantities aligned */}
                    <div className="flex justify-between items-baseline text-neutral-600 mt-0.5">
                      <span className="w-1/2 text-[8.5px] text-neutral-500 truncate">
                        {item.hsn_snapshot ? `HSN:${item.hsn_snapshot}` : ''}
                        {item.tax_rate > 0 ? ` · GST:${item.tax_rate}%` : ''}
                      </span>
                      <span className="w-1/6 text-center tabular-nums">{item.quantity}</span>
                      <span className="w-1/6 text-right tabular-nums">{formatCurrency(item.unit_price)}</span>
                      <span className="w-1/6 text-right font-semibold text-neutral-900 tabular-nums">
                        {formatCurrency(item.line_total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Statutory GST Tax Summary Breakdown */}
            {!isExempt && sale.tax > 0 && (
              <div className="border-t border-dashed border-neutral-400 py-1 text-[9.5px] space-y-0.5">
                <div className="font-bold text-[8.5px] uppercase tracking-wider text-neutral-500 mb-0.5">
                  GST Breakdown
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Taxable Value:</span>
                  <span className="tabular-nums font-mono">{formatCurrency(sale.subtotal)}</span>
                </div>
                {isInterState ? (
                  <div className="flex justify-between text-neutral-600">
                    <span>IGST (Integrated Tax):</span>
                    <span className="tabular-nums font-mono">+{formatCurrency(sale.igst || sale.tax)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-neutral-600">
                      <span>CGST (Central Tax):</span>
                      <span className="tabular-nums font-mono">
                        +{formatCurrency(sale.cgst ?? Math.round((sale.tax / 2) * 100) / 100)}
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-600">
                      <span>SGST (State Tax):</span>
                      <span className="tabular-nums font-mono">
                        +{formatCurrency(sale.sgst ?? Math.round((sale.tax / 2) * 100) / 100)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-semibold text-neutral-800 pt-0.5 border-t border-dotted border-neutral-200">
                  <span>Total Tax:</span>
                  <span className="tabular-nums font-mono">+{formatCurrency(sale.tax)}</span>
                </div>
              </div>
            )}

            {/* Bill Totals Summary */}
            <div className="border-t border-dashed border-neutral-400 py-1 text-[10px] space-y-0.5">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal (Taxable):</span>
                <span className="tabular-nums font-mono">{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.tax > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>Total GST:</span>
                  <span className="tabular-nums font-mono">+{formatCurrency(sale.tax)}</span>
                </div>
              )}
              {sale.discount > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>Discount:</span>
                  <span className="tabular-nums font-mono">- {formatCurrency(sale.discount)}</span>
                </div>
              )}
              {sale.round_off !== undefined && sale.round_off !== 0 && (
                <div className="flex justify-between text-neutral-500 text-[9px]">
                  <span>Round Off:</span>
                  <span className="tabular-nums font-mono">
                    {sale.round_off > 0 ? `+${formatCurrency(sale.round_off)}` : formatCurrency(sale.round_off)}
                  </span>
                </div>
              )}

              {/* Grand Total Bar */}
              <div className="border-t-2 border-b-2 border-neutral-900 py-1 my-0.5 flex justify-between items-baseline font-bold text-xs text-neutral-900">
                <span className="tracking-tight uppercase">Grand Total:</span>
                <span className="text-sm tabular-nums font-mono">{formatCurrency(sale.total)}</span>
              </div>

              <div className="flex justify-between text-[9px] text-neutral-600 pt-0.5">
                <span>Payment Status:</span>
                <span className="font-semibold text-emerald-800">PAID VIA {sale.payment_method}</span>
              </div>
            </div>

            {/* Notes if present */}
            {sale.notes && (
              <div className="border-t border-dotted border-neutral-300 py-0.5 text-[9px] text-neutral-600 italic">
                Note: {sale.notes}
              </div>
            )}

            {/* Ultra-compact QR Code & Verification Token */}
            <div className="border-t border-dashed border-neutral-400 pt-1.5 mt-0.5">
              <div className="flex items-center justify-center gap-2">
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Verify QR"
                    className="w-10 h-10 border border-neutral-300 p-0.5 rounded bg-white shrink-0 block"
                  />
                ) : (
                  <div className="w-10 h-10 border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 shrink-0">
                    <QrIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="text-left leading-tight">
                  <div className="text-[9px] text-neutral-900 font-bold tracking-tight">
                    Scan to Verify Bill
                  </div>
                  <div className="text-[8px] text-neutral-500 font-mono">
                    Token: {sale.verification_token.slice(0, 12)}
                  </div>
                  <div className="text-[8.5px] text-neutral-700 font-semibold uppercase mt-0.5 tracking-wider">
                    *** VISIT AGAIN ***
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions (Screen only) */}
        <div className="p-3 sm:p-3.5 border-t border-neutral-200 bg-white flex flex-wrap items-center justify-between gap-2 no-print">
          <a
            href={publicVerificationUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-neutral-600 hover:text-neutral-900 underline flex items-center gap-1 font-sans"
          >
            Verify Online
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print ({printFormat === '80mm' ? '3"' : printFormat === '58mm' ? '2"' : 'A4'})
            </button>
            <button
              onClick={handleSharePDF}
              disabled={isGeneratingPdf}
              className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              Share PDF
            </button>
            <button
              onClick={onNewBill}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer flex items-center gap-1"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Start New Bill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
