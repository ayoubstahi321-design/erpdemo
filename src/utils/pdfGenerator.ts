/**
 * Professional PDF Generation Service
 * Generates native PDF documents (not image-based)
 */
import jsPDF from 'jspdf';
import { Sale, Customer, Warehouse, CompanySettings } from '../types';
import { CURRENCY } from '../constants';
import { calculateHT } from './pricing';

export interface GeneratePDFOptions {
  type: 'INVOICE' | 'DELIVERY_NOTE';
  format: 'A4' | 'TICKET';
  sale: Sale;
  customer?: Customer;
  warehouse?: Warehouse;
  companySettings: CompanySettings;
}

/**
 * Generate a professional native PDF document
 * Uses jsPDF with direct text/table drawing (not image capture)
 * @returns Promise<Blob> - PDF document as blob
 */
export async function generateProfessionalPDF(
  options: GeneratePDFOptions
): Promise<Blob> {
  const { format } = options;

  if (format === 'A4') {
    return generateInvoicePDF(options);
  } else {
    return generateTicketPDF(options);
  }
}

/**
 * Generate A4 Invoice PDF with native text rendering
 */
function generateInvoicePDF(options: GeneratePDFOptions): Blob {
  const { type, sale, customer, companySettings, warehouse } = options;
  const CURRENCY_SYMBOL = CURRENCY;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Helper functions
  const addText = (text: string, x: number, y: number, options: any = {}) => {
    pdf.setFont(options.font || 'helvetica', options.weight || 'normal');
    pdf.setFontSize(options.size || 12);
    if (options.color) {
      pdf.setTextColor(options.color[0], options.color[1], options.color[2]);
    }
    pdf.text(text, x, y, { align: options.align || 'left', maxWidth: options.maxWidth || contentWidth });
    pdf.setTextColor(0, 0, 0);
  };

  const addHorizontalLine = (x: number, y: number, length: number, color = [0, 0, 0]) => {
    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.line(x, y, x + length, y);
  };

  // 1. HEADER - Company Info
  yPosition = margin;
  addText(companySettings.name, margin, yPosition, { size: 20, weight: 'bold' });
  yPosition += 10;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const companyInfo = [
    companySettings.address,
    `${companySettings.city}, ${companySettings.country}`,
    `Tél: ${companySettings.phone}`,
    `Email: ${companySettings.email}`,
  ];

  companyInfo.forEach((line) => {
    addText(line, margin, yPosition, { size: 9 });
    yPosition += 4;
  });

  // 2. DOCUMENT TITLE
  yPosition += 5;
  addHorizontalLine(margin, yPosition, contentWidth, [30, 30, 80]);
  yPosition += 8;

  addText(type === 'INVOICE' ? 'FACTURE' : 'BON DE LIVRAISON', margin + contentWidth - 40, yPosition - 4, {
    size: 24,
    weight: 'bold',
    align: 'right',
    color: [30, 30, 80],
  });

  // Invoice Details Box
  const boxX = margin + contentWidth - 70;
  const boxY = yPosition - 8;
  pdf.setDrawColor(180, 180, 200);
  pdf.rect(boxX, boxY, 70, 20);

  addText('Référence', boxX + 3, boxY + 4, { size: 8, color: [100, 100, 100] });
  addText(sale.invoiceNumber || `#${sale.id.toUpperCase()}`, boxX + 3, boxY + 8, {
    size: 11,
    weight: 'bold',
  });

  addText('Date', boxX + 3, boxY + 14, { size: 8, color: [100, 100, 100] });
  addText(new Date(sale.date).toLocaleDateString('fr-FR'), boxX + 3, boxY + 18, {
    size: 10,
    weight: 'bold',
  });

  yPosition += 25;

  // 3. CUSTOMER INFO SECTION
  yPosition += 5;

  // Bill To
  addText('FACTURER À (CLIENT)', margin, yPosition, { size: 10, weight: 'bold', color: [30, 30, 80] });
  yPosition += 7;

  pdf.setDrawColor(200, 200, 220);
  pdf.rect(margin, yPosition - 4, contentWidth / 2 - 2, 25);

  addText(customer?.name || sale.customerName, margin + 3, yPosition, {
    size: 11,
    weight: 'bold',
    maxWidth: contentWidth / 2 - 6,
  });
  yPosition += 6;

  addText(customer?.address || 'Adresse non spécifiée', margin + 3, yPosition, {
    size: 9,
    maxWidth: contentWidth / 2 - 6,
  });
  yPosition += 4;

  addText(`${customer?.city || ''}`, margin + 3, yPosition, {
    size: 9,
    maxWidth: contentWidth / 2 - 6,
  });
  yPosition += 4;

  addText(`Tél: ${customer?.phone}`, margin + 3, yPosition, { size: 9 });

  // Ship To
  const shipToX = margin + contentWidth / 2 + 2;
  pdf.setFillColor(245, 245, 250);
  pdf.rect(shipToX, yPosition - 19, contentWidth / 2 - 2, 25, 'F');
  pdf.setDrawColor(200, 200, 220);
  pdf.rect(shipToX, yPosition - 19, contentWidth / 2 - 2, 25);

  addText('ADRESSE DE LIVRAISON', shipToX + 3, yPosition - 15, {
    size: 10,
    weight: 'bold',
    color: [80, 80, 100],
  });

  addText(customer?.name || sale.customerName, shipToX + 3, yPosition - 8, {
    size: 10,
    weight: 'bold',
  });

  addText(customer?.address || 'Idem adresse de facturation', shipToX + 3, yPosition - 4, {
    size: 9,
  });

  if (warehouse) {
    addText(`Depuis: ${warehouse.name}`, shipToX + 3, yPosition, { size: 8, color: [100, 100, 100] });
  }

  yPosition += 8;

  // 4. ITEMS TABLE
  const colPositions = {
    description: margin,
    qty: margin + contentWidth * 0.5,
    unitPrice: margin + contentWidth * 0.65,
    discount: margin + contentWidth * 0.77,
    total: margin + contentWidth * 0.87,
  };

  // Table Header
  pdf.setFillColor(30, 30, 80);
  pdf.setTextColor(255, 255, 255);
  pdf.rect(margin, yPosition - 4, contentWidth, 6, 'F');

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Description / Article', colPositions.description + 1, yPosition);
  pdf.text('Quantité', colPositions.qty + 1, yPosition, { align: 'center' });
  pdf.text('P.U. (HT)', colPositions.unitPrice + 1, yPosition, { align: 'right' });
  pdf.text('Remise', colPositions.discount + 1, yPosition, { align: 'right' });
  pdf.text('Total HT', colPositions.total + 1, yPosition, { align: 'right' });

  yPosition += 6;
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);

  // Table Items
  sale.items.forEach((item, idx) => {
    if (yPosition > pageHeight - 40) {
      // Add new page if needed
      pdf.addPage();
      yPosition = margin;
    }

    // Alternating row color
    if (idx % 2 === 0) {
      pdf.setFillColor(245, 245, 250);
      pdf.rect(margin, yPosition - 3, contentWidth, 5, 'F');
    }

    pdf.setFont('helvetica', 'bold');
    pdf.text(item.productName, colPositions.description + 1, yPosition, { maxWidth: 60 });

    pdf.setFont('helvetica', 'normal');
    pdf.text(String(item.quantity), colPositions.qty + 1, yPosition, { align: 'center' });
    pdf.text(item.unitPrice.toFixed(2), colPositions.unitPrice + 1, yPosition, { align: 'right' });
    pdf.text(item.discount > 0 ? `${item.discount}%` : '-', colPositions.discount + 1, yPosition, {
      align: 'right',
    });
    pdf.text(item.total.toFixed(2), colPositions.total + 1, yPosition, { align: 'right' });

    yPosition += 5;
  });

  // 5. FINANCIAL SUMMARY
  yPosition += 5;
  const summaryX = margin + contentWidth * 0.55;

  pdf.setDrawColor(200, 200, 220);
  pdf.line(summaryX, yPosition, margin + contentWidth, yPosition);
  yPosition += 4;

  const financialLines = [
    { label: 'Sous-total Articles', value: sale.itemsSubtotal.toFixed(2), showIf: sale.globalDiscountAmount && sale.globalDiscountAmount > 0 },
    {
      label: `Remise Globale${
        sale.globalDiscountType === 'percentage' ? ` (${sale.globalDiscountValue}%)` : ''
      }`,
      value: `-${sale.globalDiscountAmount?.toFixed(2) || '0.00'}`,
      showIf: sale.globalDiscountAmount && sale.globalDiscountAmount > 0,
      color: [220, 20, 60],
    },
    { label: 'Total H.T.', value: calculateHT(sale.subtotalAmount, sale.taxRate).toFixed(2), showIf: true },
    { label: `TVA (${sale.taxRate * 100}%)`, value: sale.taxAmount.toFixed(2), showIf: true },
  ];

  financialLines.forEach(({ label, value, showIf, color }) => {
    if (!showIf) return;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);

    if (color) {
      pdf.setTextColor(color[0], color[1], color[2]);
    }

    pdf.text(label, summaryX, yPosition, { align: 'left' });
    pdf.text(value, margin + contentWidth, yPosition, { align: 'right' });
    pdf.setTextColor(0, 0, 0);
    yPosition += 4;
  });

  // Total
  pdf.setDrawColor(30, 30, 80);
  pdf.line(summaryX, yPosition, margin + contentWidth, yPosition);
  yPosition += 5;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(30, 30, 80);
  pdf.text('Total TTC', summaryX, yPosition, { align: 'left' });
  pdf.text(`${sale.totalAmount.toFixed(2)} ${CURRENCY_SYMBOL}`, margin + contentWidth, yPosition, {
    align: 'right',
  });

  // 6. FOOTER
  yPosition = pageHeight - 35;

  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);

  // Banking Info
  const bankingBoxY = yPosition;
  pdf.setDrawColor(200, 200, 220);
  pdf.rect(margin, bankingBoxY, contentWidth / 2 - 2, 15);

  addText('INFORMATIONS BANCAIRES (RIB)', margin + 3, bankingBoxY + 4, {
    size: 8,
    weight: 'bold',
  });
  addText(`Banque: ${companySettings.bankName}`, margin + 3, bankingBoxY + 8, { size: 7 });
  addText(companySettings.rib, margin + 3, bankingBoxY + 11, { size: 8, font: 'courier' });

  // Stamp area
  const stampBoxX = margin + contentWidth / 2 + 2;
  pdf.setDrawColor(180, 180, 200);
  pdf.rect(stampBoxX, bankingBoxY, contentWidth / 2 - 2, 15);

  addText('Cachet et Signature Client', stampBoxX + 5, bankingBoxY + 7, {
    size: 9,
    color: [150, 150, 150],
    align: 'center',
  });

  // Legal footer
  yPosition = pageHeight - 10;
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);

  const footerText = `RC: ${companySettings.rc} • Patente: ${companySettings.patente} • IF: ${companySettings.if} • CNSS: ${companySettings.cnss} • ICE: ${companySettings.ice}`;
  pdf.text(footerText, pageWidth / 2, yPosition, { align: 'center', maxWidth: contentWidth });

  // Convert to Blob
  return pdf.output('blob');
}

/**
 * Generate Thermal Printer Ticket (80mm x variable height)
 */
function generateTicketPDF(options: GeneratePDFOptions): Blob {
  const { sale, customer, companySettings } = options;
  const CURRENCY_SYMBOL = CURRENCY;

  // 80mm = 227px at 72dpi
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 150],
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 3;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  const addText = (text: string, x: number, y: number, options: any = {}) => {
    pdf.setFont(options.font || 'helvetica', options.weight || 'normal');
    pdf.setFontSize(options.size || 8);
    if (options.color) {
      pdf.setTextColor(options.color[0], options.color[1], options.color[2]);
    }
    pdf.text(text, x, y, { align: options.align || 'left', maxWidth: options.maxWidth || contentWidth - 6 });
    pdf.setTextColor(0, 0, 0);
  };

  const addLine = (x: number, y: number, length: number) => {
    pdf.setDrawColor(0, 0, 0);
    pdf.line(x, y, x + length, y);
  };

  // Header
  addText(companySettings.name, margin + contentWidth / 2, yPosition, {
    size: 9,
    weight: 'bold',
    align: 'center',
  });
  yPosition += 5;

  addText(companySettings.address, margin + contentWidth / 2, yPosition, {
    size: 6,
    align: 'center',
  });
  yPosition += 3;

  addText(companySettings.city, margin + contentWidth / 2, yPosition, {
    size: 6,
    align: 'center',
  });
  yPosition += 4;

  addLine(margin, yPosition, contentWidth);
  yPosition += 2;

  // Meta
  addText(`Ticket: ${sale.invoiceNumber || sale.id.slice(-6).toUpperCase()}`, margin, yPosition, {
    size: 7,
  });
  yPosition += 3;

  addText(`Date: ${new Date(sale.date).toLocaleDateString()}`, margin, yPosition, { size: 7 });
  yPosition += 3;

  addText(`Client: ${customer?.name || sale.customerName}`, margin, yPosition, {
    size: 7,
    maxWidth: contentWidth - 6,
  });
  yPosition += 4;

  addLine(margin, yPosition, contentWidth);
  yPosition += 2;

  // Items
  pdf.setFontSize(7);
  sale.items.forEach((item) => {
    addText(`${item.productName}`, margin, yPosition, { size: 6, weight: 'bold' });
    yPosition += 2;

    addText(`${item.quantity}x ${item.unitPrice.toFixed(2)} = ${item.total.toFixed(2)}`, margin + 1, yPosition, {
      size: 6,
    });
    yPosition += 3;
  });

  addLine(margin, yPosition, contentWidth);
  yPosition += 2;

  // Totals
  addText('TOTAL HT:', margin, yPosition, { size: 7, weight: 'bold' });
  addText(calculateHT(sale.subtotalAmount, sale.taxRate).toFixed(2), margin + contentWidth - 15, yPosition, {
    size: 7,
    weight: 'bold',
    align: 'right',
  });
  yPosition += 3;

  addText(`TVA (${sale.taxRate * 100}%):`, margin, yPosition, { size: 7 });
  addText(sale.taxAmount.toFixed(2), margin + contentWidth - 15, yPosition, {
    size: 7,
    align: 'right',
  });
  yPosition += 4;

  pdf.setFillColor(0, 0, 0);
  addText('TOTAL TTC:', margin, yPosition, { size: 8, weight: 'bold', color: [0, 0, 0] });
  addText(`${sale.totalAmount.toFixed(2)} ${CURRENCY_SYMBOL}`, margin + contentWidth - 15, yPosition, {
    size: 8,
    weight: 'bold',
    align: 'right',
  });
  yPosition += 4;

  addLine(margin, yPosition, contentWidth);
  yPosition += 3;

  // Footer
  addText('Merci de votre visite!', margin + contentWidth / 2, yPosition, {
    size: 7,
    align: 'center',
  });
  yPosition += 2;

  addText(companySettings.website, margin + contentWidth / 2, yPosition, {
    size: 6,
    align: 'center',
  });

  return pdf.output('blob');
}

/**
 * Download PDF file
 */
export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Share PDF (if supported by browser)
 */
export async function sharePDF(blob: Blob, filename: string, title: string) {
  if (!navigator.share) {
    throw new Error('Web Share API not supported');
  }

  const file = new File([blob], filename, { type: 'application/pdf' });

  await navigator.share({
    title,
    text: `Partagez ce document: ${filename}`,
    files: [file],
  });
}
