
import React, { useRef } from 'react';
import { Sale, Customer, Warehouse, CompanySettings, Product } from '../types';
import { X, Printer, Share2, FileDown, Loader2, Mail, MessageCircle, PenLine } from 'lucide-react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { pdf, PDFViewer } from '@react-pdf/renderer';
import { CURRENCY } from '../constants';
import { logger } from '../utils/logger';
import { PDFInvoiceDocument } from './PDFInvoiceDocument';

// ─── Round company stamp generator ───────────────────────────────────────────
function generateStampDataUrl(cs: CompanySettings): string {
    const SIZE = 360;
    const cx = SIZE / 2, cy = SIZE / 2;
    const R_OUTER = 162; // bold outer ring
    const R_BAND  = 152; // inner edge of text band
    const R_TEXT  = 134; // arc text midpoint
    const R_INNER = 116; // inner circle

    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);

    const COLOR = '#1E3A8A';
    ctx.strokeStyle = COLOR;
    ctx.fillStyle = COLOR;

    // Ring 1 — bold outer
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(cx, cy, R_OUTER, 0, Math.PI * 2); ctx.stroke();
    // Ring 2 — thin band edge
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R_BAND, 0, Math.PI * 2); ctx.stroke();
    // Ring 3 — medium inner
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, R_INNER, 0, Math.PI * 2); ctx.stroke();

    // Arc text helper
    const drawArcText = (text: string, radius: number, startAngle: number, clockwise: boolean) => {
        const chars = text.toUpperCase().split('');
        const totalArc = Math.min(Math.PI * 1.35, (chars.length * 16) / radius);
        const step = totalArc / Math.max(chars.length - 1, 1);
        const offset = clockwise ? -totalArc / 2 : totalArc / 2;
        ctx.font = 'bold 19px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        chars.forEach((ch, i) => {
            const angle = startAngle + offset + (clockwise ? 1 : -1) * i * step;
            ctx.save();
            ctx.translate(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
            ctx.rotate(angle + (clockwise ? Math.PI / 2 : -Math.PI / 2));
            ctx.fillText(ch, 0, 0);
            ctx.restore();
        });
    };

    // Company name — top arc
    drawArcText(cs.name, R_TEXT, -Math.PI / 2, true);
    // City — bottom arc
    const city = (cs.city || cs.country || '').toUpperCase();
    drawArcText(city, R_TEXT, Math.PI / 2, false);

    // ★ separators at left and right
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', cx + R_TEXT, cy);
    ctx.fillText('★', cx - R_TEXT, cy);

    // Center: phone bold
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cs.phone || '', cx, cy - 12);

    // ICE below phone
    if (cs.ice) {
        ctx.font = '14px Arial, sans-serif';
        ctx.fillText(`ICE: ${cs.ice}`, cx, cy + 12);
    }

    return canvas.toDataURL('image/png');
}

// Print-compatible logo component
// Logo is now loaded dynamically from companySettings.logoBase64
const PrintLogo = ({ logoBase64, className = "w-48 h-auto" }: { logoBase64?: string; className?: string }) => {
    if (!logoBase64) return null;
    return <img src={logoBase64} alt="Company Logo" className={className} />;
};

// ─── Signature Pad ────────────────────────────────────────────────────────────
const SignaturePad: React.FC<{ onSave: (dataUrl: string) => void; onCancel: () => void }> = ({ onSave, onCancel }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    // Store last two points for quadratic bezier midpoint smoothing
    const pts = useRef<{ x: number; y: number }[]>([]);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        if ('touches' in e) {
            return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
        }
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const initCtx = (ctx: CanvasRenderingContext2D) => {
        ctx.strokeStyle = '#1E3A8A';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };

    const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        isDrawing.current = true;
        const pos = getPos(e);
        pts.current = [pos];
        const ctx = canvasRef.current!.getContext('2d')!;
        initCtx(ctx);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing.current) return;
        const ctx = canvasRef.current!.getContext('2d')!;
        const pos = getPos(e);
        pts.current.push(pos);
        const p = pts.current;
        const len = p.length;
        if (len < 2) return;
        // Midpoint bezier smoothing: control = previous point, end = midpoint
        const mid = { x: (p[len - 2].x + p[len - 1].x) / 2, y: (p[len - 2].y + p[len - 1].y) / 2 };
        ctx.quadraticCurveTo(p[len - 2].x, p[len - 2].y, mid.x, mid.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
    };

    const stopDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current) return;
        // Draw final segment to exact end point
        const p = pts.current;
        if (p.length >= 1) {
            const ctx = canvasRef.current!.getContext('2d')!;
            const last = p[p.length - 1];
            ctx.lineTo(last.x, last.y);
            ctx.stroke();
        }
        isDrawing.current = false;
        pts.current = [];
    };

    const handleClear = () => {
        const canvas = canvasRef.current!;
        canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSave = () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;

        // Find bounding box of drawn pixels
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                if (d[(y * canvas.width + x) * 4 + 3] > 10) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX <= minX || maxY <= minY) return; // nothing drawn

        // Add padding and crop to drawn area
        const pad = 12;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(canvas.width, maxX + pad);
        maxY = Math.min(canvas.height, maxY + pad);

        const crop = document.createElement('canvas');
        crop.width = maxX - minX;
        crop.height = maxY - minY;
        crop.getContext('2d')!.drawImage(canvas, minX, minY, crop.width, crop.height, 0, 0, crop.width, crop.height);
        onSave(crop.toDataURL('image/png'));
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-slate-900 mb-1">Signature</h3>
                <p className="text-sm text-slate-500 mb-4">Signez dans le cadre ci-dessous</p>
                <canvas
                    ref={canvasRef}
                    width={560} height={200}
                    className="border-2 border-slate-300 rounded-lg cursor-crosshair w-full touch-none bg-white"
                    onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                    onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                />
                <div className="flex justify-between items-center mt-4">
                    <button onClick={handleClear} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                        Effacer
                    </button>
                    <div className="flex gap-2">
                        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                            Annuler
                        </button>
                        <button onClick={handleSave} className="px-5 py-2 text-sm font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors">
                            Confirmer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface PrintableDocumentProps {
    sale: Sale;
    type: 'INVOICE' | 'DELIVERY_NOTE' | 'QUOTE';
    format?: 'A4' | 'TICKET';
    customer?: Customer;
    warehouse?: Warehouse;
    companySettings: CompanySettings;
    products?: Product[];
    onClose: () => void;
    onSaveSignature?: (signatureBase64: string) => void;
}

const PrintableDocument: React.FC<PrintableDocumentProps> = ({ sale, type, format = 'A4', customer, warehouse, companySettings, products, onClose, onSaveSignature }) => {
    // Use company-configured currency symbol, fall back to global CURRENCY constant
    const currency = companySettings.currencySymbol || CURRENCY;

    const productMap = React.useMemo(() => {
        const map = new Map<string, Product>();
        (products || []).forEach(p => map.set(p.id, p));
        return map;
    }, [products]);
    const documentRef = useRef<HTMLDivElement>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = React.useState(false);
    const [showSignPad, setShowSignPad] = React.useState(false);
    const [sessionSignature, setSessionSignature] = React.useState<string | undefined>(undefined);

    const getQrDataUrl = () => qrCanvasRef.current?.toDataURL('image/png') || undefined;
    const stampDataUrl = React.useMemo(() => generateStampDataUrl(companySettings), [companySettings]);

    // qrDataUrl state — populated after canvas mounts, used by PDFViewer (reactive re-render)
    const [qrDataUrl, setQrDataUrl] = React.useState<string | undefined>(undefined);
    React.useEffect(() => {
        const url = qrCanvasRef.current?.toDataURL('image/png');
        if (url) setQrDataUrl(url);
    }, [sale.id]);

    // Convert logo to JPEG for react-pdf (does not support WebP/SVG).
    // null = still converting; undefined = no logo; string = ready JPEG/PNG
    const [pdfLogoBase64, setPdfLogoBase64] = React.useState<string | undefined | null>(null);
    React.useEffect(() => {
        const logo = companySettings.logoBase64;
        if (!logo) { setPdfLogoBase64(undefined); return; }
        if (logo.startsWith('data:image/jpeg') || logo.startsWith('data:image/png')) {
            setPdfLogoBase64(logo); return;
        }
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            setPdfLogoBase64(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => setPdfLogoBase64(undefined); // conversion failed — render without logo
        img.src = logo;
    }, [companySettings.logoBase64]);

    const pdfSettings = React.useMemo(
        () => ({ ...companySettings, logoBase64: pdfLogoBase64 ?? undefined }),
        [companySettings, pdfLogoBase64]
    );

    const handlePrint = async () => {
        if (isGeneratingPDF) return;

        setIsGeneratingPDF(true);

        try {
            logger.debug('Generating PDF for print:', sale.invoiceNumber || sale.id);

            // Generate PDF using react-pdf
            const blob = await pdf(
                <PDFInvoiceDocument
                    sale={sale}
                    type={type}
                    customer={customer}
                    warehouse={warehouse}
                    companySettings={pdfSettings}
                    products={products}
                    qrCodeDataUrl={getQrDataUrl()}
                    stampDataUrl={stampDataUrl}
                    signatureBase64={sessionSignature ?? companySettings.signatureBase64}
                />
            ).toBlob();

            // Open PDF in new window for printing
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');

            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.print();
                    URL.revokeObjectURL(url);
                };
            } else {
                // Fallback: download if popup blocked
                const link = document.createElement('a');
                link.href = url;
                link.download = `${type === 'INVOICE' ? 'Facture' : 'Bon-Livraison'}_${sale.invoiceNumber || sale.id}_${new Date(sale.date).toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }

            logger.debug('PDF opened for printing');
        } catch (error) {
            logger.error('Error generating PDF for print:', error);
            alert('Erreur lors de la génération du PDF: ' + (error as Error).message);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleDownloadPDF = async () => {
        if (isGeneratingPDF) return;

        setIsGeneratingPDF(true);

        try {
            logger.debug('Generating PDF with react-pdf for invoice:', sale.invoiceNumber || sale.id);

            // Generate PDF using react-pdf - REAL PDF, not screenshot
            const blob = await pdf(
                <PDFInvoiceDocument
                    sale={sale}
                    type={type}
                    customer={customer}
                    warehouse={warehouse}
                    companySettings={pdfSettings}
                    products={products}
                    qrCodeDataUrl={getQrDataUrl()}
                    stampDataUrl={stampDataUrl}
                    signatureBase64={sessionSignature ?? companySettings.signatureBase64}
                />
            ).toBlob();

            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filename = `${type === 'INVOICE' ? 'Facture' : 'Bon-Livraison'}_${sale.invoiceNumber || sale.id}_${new Date(sale.date).toISOString().split('T')[0]}.pdf`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            logger.debug('PDF generated successfully with react-pdf:', filename);
        } catch (error) {
            logger.error('Error generating PDF:', error);
            alert('Erreur lors de la génération du PDF: ' + (error as Error).message);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    // Shared: generate PDF blob + filename
    const generateInvoiceBlob = async () => {
        const blob = await pdf(
            <PDFInvoiceDocument
                sale={sale}
                type={type}
                customer={customer}
                warehouse={warehouse}
                companySettings={pdfSettings}
                products={products}
                qrCodeDataUrl={getQrDataUrl()}
                stampDataUrl={stampDataUrl}
                signatureBase64={sessionSignature ?? companySettings.signatureBase64}
            />
        ).toBlob();
        const filename = `${type === 'INVOICE' ? 'Facture' : 'Bon-Livraison'}_${sale.invoiceNumber || sale.id}_${new Date(sale.date).toISOString().split('T')[0]}.pdf`;
        return { blob, filename };
    };

    const esc = (s: string | undefined | null) =>
        (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const handleSendEmail = async () => {
        if (isGeneratingPDF) return;

        const recipientEmail = customer?.email;
        if (!recipientEmail) {
            alert('Ce client n\'a pas d\'adresse email enregistr\u00E9e.');
            return;
        }

        setIsGeneratingPDF(true);
        try {
            const { blob, filename } = await generateInvoiceBlob();

            // Convert blob to base64 for API
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            const pdfBase64 = btoa(binary);

            const docLabel = type === 'INVOICE' ? 'facture' : 'bon de livraison';
            const docRef = sale.invoiceNumber || sale.deliveryNoteNumber || sale.id;

            const subject = `${type === 'INVOICE' ? 'Facture' : 'Bon de Livraison'} ${docRef} - ${companySettings.name}`;
            const html = `
                <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px;">
                    <p>Bonjour <strong>${esc(customer?.name || sale.customerName)}</strong>,</p>
                    <p>Veuillez trouver ci-joint votre ${docLabel} N\u00B0 <strong>${esc(docRef)}</strong>.</p>
                    <table style="margin: 20px 0; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 16px; background: #f1f5f9; border: 1px solid #e2e8f0; font-weight: bold;">Montant Total TTC</td>
                            <td style="padding: 8px 16px; border: 1px solid #e2e8f0; font-weight: bold; color: #1e3a8a;">${sale.totalAmount.toFixed(2)} ${currency}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 16px; background: #f1f5f9; border: 1px solid #e2e8f0;">Date</td>
                            <td style="padding: 8px 16px; border: 1px solid #e2e8f0;">${new Date(sale.date).toLocaleDateString('fr-FR')}</td>
                        </tr>
                    </table>
                    <p>Cordialement,<br/><strong>${esc(companySettings.name)}</strong><br/>${esc(companySettings.phone)}<br/>${esc(companySettings.email)}</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
                    <p style="font-size: 11px; color: #94a3b8;">
                        ICE: ${esc(companySettings.ice)} | IF: ${esc(companySettings.if)} | RC: ${esc(companySettings.rc)}<br/>
                        ${esc(companySettings.address)}, ${esc(companySettings.city)}
                    </p>
                </div>
            `;

            const response = await fetch('/api/send-invoice-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: recipientEmail,
                    subject,
                    html,
                    pdfBase64,
                    pdfFilename: filename,
                    replyTo: companySettings.email,
                    fromName: companySettings.name,
                    fromEmail: companySettings.email,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de l\'envoi');
            }

            alert(`Email envoy\u00E9 avec succ\u00E8s \u00E0 ${recipientEmail}`);
        } catch (error: any) {
            logger.error('Error sending email:', error);
            alert(`Erreur: ${error.message}`);
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleSendWhatsApp = async () => {
        if (isGeneratingPDF) return;
        setIsGeneratingPDF(true);
        try {
            const { blob, filename } = await generateInvoiceBlob();
            const file = new File([blob], filename, { type: 'application/pdf' });

            // Try Web Share API with file (works on mobile - can share directly to WhatsApp)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    text: `${type === 'INVOICE' ? 'Facture' : 'BL'} ${sale.invoiceNumber || ''} - ${sale.totalAmount.toFixed(2)} ${currency} | ${companySettings.name}`,
                    files: [file],
                });
            } else {
                // Fallback: open WhatsApp Web with pre-filled message
                const rawPhone = (customer?.phone || '').replace(/[\s\-\(\)\.]/g, '');
                if (!rawPhone) {
                    alert('Ce client n\'a pas de numéro de téléphone enregistré.');
                    return;
                }
                // Convert local Morocco number (0xxx) to international (212xxx)
                const intPhone = rawPhone.startsWith('0') ? `212${rawPhone.slice(1)}` : rawPhone.replace('+', '');

                const docRef = sale.invoiceNumber || sale.deliveryNoteNumber || sale.id;
                const message = encodeURIComponent(
                    `Bonjour ${customer?.name || sale.customerName},\n\n` +
                    `Voici votre ${type === 'INVOICE' ? 'facture' : 'bon de livraison'} N\u00B0 ${docRef}.\n\n` +
                    `Total TTC: ${sale.totalAmount.toFixed(2)} ${currency}\n` +
                    `Date: ${new Date(sale.date).toLocaleDateString('fr-FR')}\n\n` +
                    `${companySettings.name}\n${companySettings.phone}`
                );

                window.open(`https://wa.me/${intPhone}?text=${message}`, '_blank');

                // Also download PDF so user can share it
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                logger.error('Error sending WhatsApp:', error);
            }
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const remainingBalance = sale.totalAmount - sale.amountPaid - (sale.creditedAmount || 0);

    // Generate QR Code: link to public invoice verification page
    const qrData = `${window.location.origin}/api/verify-invoice?id=${sale.id}`;

    // Hidden QR canvas used to extract data URL for the PDF
    const hiddenQrCanvas = (
        <QRCodeCanvas
            ref={qrCanvasRef}
            value={qrData}
            size={128}
            style={{ display: 'none', position: 'absolute', pointerEvents: 'none' }}
        />
    );

    // --- TICKET LAYOUT (80mm) ---
    if (format === 'TICKET') {
        return (
            <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex justify-center overflow-y-auto p-4 print:p-0 print:bg-white print:static print:inset-auto">
                {hiddenQrCanvas}
                {/* Print Fab (Hidden when printing) */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 print:hidden flex space-x-3 z-50">
                    <button
                        onClick={handlePrint}
                        className="flex items-center px-6 py-2 bg-slate-900 text-white rounded-full shadow-lg hover:bg-black transition-colors font-bold border border-slate-700"
                    >
                        <Printer className="w-5 h-5 mr-2" />
                        Imprimer
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={isGeneratingPDF}
                        className="flex items-center px-6 py-2 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGeneratingPDF ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                ...
                            </>
                        ) : (
                            <>
                                <FileDown className="w-5 h-5 mr-2" />
                                PDF
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleSendEmail}
                        disabled={isGeneratingPDF}
                        className="flex items-center px-4 py-2 bg-amber-600 text-white rounded-full shadow-lg hover:bg-amber-700 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Mail className="w-5 h-5 mr-1" />
                        Email
                    </button>
                    <button
                        onClick={handleSendWhatsApp}
                        disabled={isGeneratingPDF}
                        className="flex items-center px-4 py-2 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <MessageCircle className="w-5 h-5 mr-1" />
                        WhatsApp
                    </button>
                    <button
                        onClick={onClose}
                        className="flex items-center px-4 py-2 bg-white text-slate-700 rounded-full shadow-lg hover:bg-slate-50 transition-colors font-bold"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div ref={documentRef} className="printable-document bg-white w-[80mm] min-h-[100mm] p-2 shadow-2xl relative print:shadow-none print:w-full print:max-w-none text-black font-mono text-[12px] leading-tight mx-auto my-auto print:m-0">
                    {/* Header */}
                    <div className="text-center mb-4 border-b border-black pb-2 border-dashed">
                        <div className="flex justify-center mb-2">
                             {/* Print-compatible logo for ticket */}
                             <PrintLogo logoBase64={companySettings.logoBase64} className="h-8 w-auto grayscale" />
                        </div>
                        <p className="font-bold text-sm uppercase">{companySettings.name}</p>
                        <p className="text-[10px]">{companySettings.address}</p>
                        <p className="text-[10px]">{companySettings.city}</p>
                        <p className="text-[10px]">Tél: {companySettings.phone}</p>
                    </div>

                    {/* Meta */}
                    <div className="mb-2">
                        <p className="flex justify-between">
                            <span>Date:</span>
                            <span>{new Date(sale.date).toLocaleDateString()} {new Date(sale.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </p>
                        <p className="flex justify-between font-bold">
                            <span>Ticket #:</span>
                            <span>{sale.invoiceNumber || sale.id.slice(-6).toUpperCase()}</span>
                        </p>
                        <p className="flex justify-between">
                            <span>Client:</span>
                            <span className="text-right max-w-[60%] truncate">{customer?.name || sale.customerName}</span>
                        </p>
                    </div>

                    {/* Items */}
                    <div className="border-t border-b border-black border-dashed py-2 mb-2">
                        <div className="flex font-bold border-b border-black border-dashed pb-1 mb-1">
                            <span className="flex-1">Art.</span>
                            <span className="w-8 text-right">Qté</span>
                            <span className="w-16 text-right">Total</span>
                        </div>
                        {sale.items.map((item, idx) => {
                            const prod = productMap.get(item.productId);
                            const packLabel = prod ? `${prod.packSize}${prod.unit}` : null;
                            return (
                            <div key={idx} className="mb-1">
                                <div className="font-bold truncate">{item.productName}{packLabel ? ` ${packLabel}` : ''}</div>
                                <div className="flex justify-between text-[11px]">
                                    <span className="pl-2">
                                        {item.sellMode === 'box' && (item.unitsPerBox || 1) > 1
                                            ? (item.unitPrice * (item.unitsPerBox || 1)).toFixed(2)
                                            : item.unitPrice.toFixed(2)
                                        } x {item.quantity}
                                    </span>
                                    <span>{item.total.toFixed(2)}</span>
                                </div>
                            </div>
                            );
                        })}
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end mb-4">
                        <div className="w-full">
                            {/* Subtotal before global discount */}
                            {sale.globalDiscountAmount && sale.globalDiscountAmount > 0 && (
                                <div className="flex justify-between text-[11px] text-gray-600">
                                    <span>Subtotal</span>
                                    <span>{sale.itemsSubtotal.toFixed(2)}</span>
                                </div>
                            )}

                            {/* Global discount */}
                            {sale.globalDiscountAmount && sale.globalDiscountAmount > 0 && (
                                <div className="flex justify-between text-[11px]">
                                    <span>
                                        Remise
                                        {sale.globalDiscountType === 'percentage' ? ` (${sale.globalDiscountValue}%)` : ''}
                                    </span>
                                    <span>-{sale.globalDiscountAmount.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between">
                                <span>Total HT</span>
                                <span>{(sale.totalAmount - sale.taxAmount).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>TVA</span>
                                <span>{sale.taxAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold mt-1 border-t border-black pt-1">
                                <span>TOTAL</span>
                                <span>{sale.totalAmount.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Details */}
                    {sale.payments && sale.payments.length > 0 && (
                        <div className="border-t border-b border-black border-dashed py-2 mb-2 text-[11px]">
                            <p className="font-bold mb-1">PAIEMENT:</p>
                            {sale.payments.map((payment, idx) => (
                                <div key={payment.id || idx} className="mb-2">
                                    <div className="flex justify-between">
                                        <span className="font-bold">
                                            {payment.method === 'Cash' && 'Espèces'}
                                            {payment.method === 'Check' && 'Chèque'}
                                            {payment.method === 'Traite' && 'Traite'}
                                            {payment.method === 'Bank Transfer' && 'Virement'}
                                            {payment.method === 'Credit Card' && 'Carte'}
                                        </span>
                                        <span>{payment.amount.toFixed(2)}</span>
                                    </div>
                                    {(payment.method === 'Check' || payment.method === 'Traite') && payment.checkNumber && (
                                        <div className="pl-2">N°: {payment.checkNumber}</div>
                                    )}
                                    {(payment.method === 'Check' || payment.method === 'Traite') && payment.dueDate && (
                                        <div className="pl-2">Échéance: {new Date(payment.dueDate).toLocaleDateString('fr-FR')}</div>
                                    )}
                                    {payment.reference && (
                                        <div className="pl-2 font-mono text-[10px]">Réf: {payment.reference}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="text-center text-[10px] mt-4">
                        <p>Merci de votre visite !</p>
                        <p className="mt-2 font-bold">{companySettings.website}</p>
                        <div className="flex justify-center mt-2">
                            <QRCodeSVG value={qrData} size={48} level="M" />
                        </div>
                    </div>
                </div>

                <style>{`
                    @media print {
                        /* Hide everything except the printable document */
                        body * {
                            visibility: hidden;
                        }

                        .printable-document,
                        .printable-document * {
                            visibility: visible;
                        }

                        /* Position and size the ticket */
                        .printable-document {
                            position: absolute !important;
                            left: 0;
                            top: 0;
                            margin: 0 !important;
                            width: 80mm !important;
                            box-shadow: none !important;
                        }

                        /* Page settings for thermal printer */
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }

                        /* Hide buttons */
                        button {
                            display: none !important;
                        }
                    }
                `}</style>
            </div>
        );
    }

    // --- A4 INVOICE LAYOUT (Standard) ---
    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
            {hiddenQrCanvas}
            {showSignPad && (
                <SignaturePad
                    onSave={(dataUrl) => {
                        setSessionSignature(dataUrl);
                        setShowSignPad(false);
                        onSaveSignature?.(dataUrl); // Persist to companySettings (Supabase)
                    }}
                    onCancel={() => setShowSignPad(false)}
                />
            )}
            {/* Action Toolbar - OUTSIDE document area */}
            <div className="sticky top-0 z-50 w-full bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 py-3 px-4 print:hidden">
                <div className="max-w-[210mm] mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handlePrint}
                            className="flex items-center px-5 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors font-medium"
                        >
                            <Printer className="w-4 h-4 mr-2" />
                            Imprimer
                        </button>
                        <button
                            onClick={() => setShowSignPad(true)}
                            className={`flex items-center px-5 py-2 rounded-lg shadow transition-colors font-medium ${sessionSignature ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
                        >
                            <PenLine className="w-4 h-4 mr-2" />
                            {sessionSignature ? 'Re-signer' : 'Signer'}
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className="flex items-center px-5 py-2 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGeneratingPDF ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Génération...
                                </>
                            ) : (
                                <>
                                    <FileDown className="w-4 h-4 mr-2" />
                                    Télécharger PDF
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleSendEmail}
                            disabled={isGeneratingPDF}
                            className="flex items-center px-4 py-2 bg-amber-600 text-white rounded-lg shadow hover:bg-amber-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Mail className="w-4 h-4 mr-2" />
                            Email
                        </button>
                        <button
                            onClick={handleSendWhatsApp}
                            disabled={isGeneratingPDF}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <MessageCircle className="w-4 h-4 mr-2" />
                            WhatsApp
                        </button>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
                        title="Fermer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Document Preview — renders the exact PDF inline */}
            <div className="flex-1 w-full" style={{ minHeight: 0 }}>
                {pdfLogoBase64 === null ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement du logo...
                    </div>
                ) : (
                    <PDFViewer
                        width="100%"
                        height="100%"
                    >
                        <PDFInvoiceDocument
                            sale={sale}
                            type={type}
                            customer={customer}
                            warehouse={warehouse}
                            companySettings={pdfSettings}
                            products={products}
                            qrCodeDataUrl={qrDataUrl}
                            stampDataUrl={stampDataUrl}
                            signatureBase64={sessionSignature ?? companySettings.signatureBase64}
                        />
                    </PDFViewer>
                )}
            </div>
        </div>
    );
};

export default PrintableDocument;
