import React, { useEffect, useRef, useCallback } from 'react';
import { Product } from '../types';
import { X, Printer } from 'lucide-react';
import { useLanguage } from '../services/i18n';
import { CURRENCY } from '../constants';
import JsBarcode from 'jsbarcode';

interface BarcodeLabelsProps {
  products: Product[];
  onClose: () => void;
}

const BarcodeLabel: React.FC<{ product: Product }> = ({ product }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      const code = product.barcode || product.sku || product.id.slice(0, 12);
      try {
        JsBarcode(svgRef.current, code, {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 10,
          margin: 2,
          textMargin: 2,
        });
      } catch {
        // Fallback if barcode generation fails
        JsBarcode(svgRef.current, product.sku || '000000', {
          format: 'CODE128',
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 10,
          margin: 2,
          textMargin: 2,
        });
      }
    }
  }, [product]);

  return (
    <div className="barcode-label border border-slate-200 rounded-lg p-3 flex flex-col items-center text-center bg-white" style={{ width: '240px', pageBreakInside: 'avoid' }}>
      <p className="text-xs font-bold text-slate-900 mb-1 leading-tight line-clamp-2" style={{ maxWidth: '220px' }}>
        {product.name}
      </p>
      <p className="text-[10px] text-slate-500 mb-1">SKU: {product.sku}</p>
      <svg ref={svgRef} className="barcode-svg" />
      <p className="text-sm font-bold text-slate-900 mt-1">
        {(product.price || 0).toFixed(2)} {CURRENCY}
      </p>
    </div>
  );
};

const BarcodeLabels: React.FC<BarcodeLabelsProps> = ({ products, onClose }) => {
  const { t } = useLanguage();

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          body > *:not(.barcode-print-modal) { display: none !important; }
          .barcode-print-modal { position: static !important; background: white !important; }
          .barcode-print-modal .no-print { display: none !important; }
          .barcode-print-modal .print-grid {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
            padding: 8px !important;
          }
          .barcode-label {
            border: 1px solid #ccc !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="barcode-print-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="no-print flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('barcode_labels')}</h3>
              <p className="text-xs text-slate-500">{products.length} {t('products')}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                <Printer className="w-4 h-4 mr-2" />
                {t('print')}
              </button>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Labels Grid */}
          <div className="print-grid flex-1 overflow-y-auto p-6">
            <div className="flex flex-wrap gap-4 justify-center">
              {products.map(product => (
                <BarcodeLabel key={product.id} product={product} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BarcodeLabels;
