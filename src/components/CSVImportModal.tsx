import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { parseCSVFile, validateCSVProducts, ProductCSVRow, ValidationError } from '../utils/csvImportExport';
import { Product } from '../types';
import { useLanguage } from '../services/i18n';

interface CSVImportModalProps {
  onClose: () => void;
  onImport: (products: ProductCSVRow[]) => Promise<void>;
  existingProducts?: Product[];
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({ onClose, onImport, existingProducts = [] }) => {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [products, setProducts] = useState<ProductCSVRow[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      alert(t('csv_select_file_alert'));
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const parsedProducts = await parseCSVFile(selectedFile);
      const validationErrors = validateCSVProducts(parsedProducts, existingProducts);

      setProducts(parsedProducts);
      setErrors(validationErrors);
      setStep('preview');
    } catch (error: any) {
      alert(`${t('csv_read_error')} : ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (errors.length > 0) {
      alert(t('csv_fix_errors_alert'));
      return;
    }

    setStep('importing');
    try {
      await onImport(products);
      alert(`✅ ${products.length} ${t('csv_import_success')}`);
      onClose();
    } catch (error: any) {
      alert(`${t('csv_import_error')} : ${error.message}`);
      setStep('preview');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900 bg-opacity-60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-xl text-slate-900">{t('csv_import_title')}</h3>
            <p className="text-sm text-slate-500 mt-1">{t('csv_import_desc')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Upload Area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <Upload className="w-16 h-16 mx-auto text-slate-400 mb-4" />
                <h4 className="font-semibold text-lg text-slate-700 mb-2">
                  {t('csv_click_select_file')}
                </h4>
                <p className="text-sm text-slate-500">
                  {t('csv_drag_drop')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-semibold text-blue-900 mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  {t('csv_format_title')}
                </h5>
                <ul className="text-sm text-blue-800 space-y-1 ml-6 list-disc">
                  <li>{t('csv_required_cols_desc')}</li>
                  <li>{t('csv_mandatory_fields')}</li>
                  <li>{t('csv_skus_unique')}</li>
                  <li>{t('csv_separator_hint')}</li>
                  <li>{t('csv_edit_hint')}</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-600 font-medium">{t('csv_total_products')}</p>
                  <p className="text-3xl font-bold text-blue-900">{products.length}</p>
                </div>
                <div className={`border rounded-lg p-4 ${errors.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <p className={`text-sm font-medium ${errors.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{t('csv_errors_label')}</p>
                  <p className={`text-3xl font-bold ${errors.length > 0 ? 'text-rose-900' : 'text-emerald-900'}`}>{errors.length}</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-600 font-medium">{t('csv_file_label')}</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{file?.name}</p>
                </div>
              </div>

              {/* Errors */}
              {errors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                  <h5 className="font-semibold text-rose-900 mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {t('csv_errors_found')} ({errors.length})
                  </h5>
                  <ul className="text-sm text-rose-800 space-y-1">
                    {errors.slice(0, 10).map((error, index) => (
                      <li key={index}>
                        <strong>{t('csv_row_label')} {error.row}</strong> - {error.field}: {error.message}
                      </li>
                    ))}
                    {errors.length > 10 && (
                      <li className="text-rose-600 font-medium">
                        {t('csv_more_errors').replace('{n}', String(errors.length - 10))}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                  <h5 className="font-semibold text-slate-700">{t('csv_preview_title')}</h5>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-slate-600">{t('sku')}</th>
                        <th className="px-4 py-2 text-left font-semibold text-slate-600">{t('product_name')}</th>
                        <th className="px-4 py-2 text-left font-semibold text-slate-600">{t('category')}</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">{t('pack_size')}</th>
                        <th className="px-4 py-2 text-right font-semibold text-slate-600">{t('price')}</th>
                        <th className="px-4 py-2 text-center font-semibold text-slate-600">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.slice(0, 50).map((product, index) => {
                        const rowErrors = errors.filter(e => e.row === index + 2);
                        const hasError = rowErrors.length > 0;

                        return (
                          <tr key={index} className={hasError ? 'bg-rose-50' : 'hover:bg-slate-50'}>
                            <td className="px-4 py-2 font-mono text-xs">{product.sku}</td>
                            <td className="px-4 py-2">{product.name}</td>
                            <td className="px-4 py-2">{product.category}</td>
                            <td className="px-4 py-2 text-right">{product.packSize} {product.unit}</td>
                            <td className="px-4 py-2 text-right">{product.price.toFixed(2)}</td>
                            <td className="px-4 py-2 text-center">
                              {hasError ? (
                                <div title={rowErrors.map(e => e.message).join(', ')}>
                                  <AlertCircle className="w-4 h-4 text-rose-600 mx-auto" />
                                </div>
                              ) : (
                                <CheckCircle className="w-4 h-4 text-emerald-600 mx-auto" />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {products.length > 50 && (
                    <div className="p-4 text-center text-sm text-slate-500 bg-slate-50 border-t border-slate-200">
                      {t('csv_showing_products')} {products.length}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-16 h-16 animate-spin text-blue-600 mb-4" />
              <h4 className="font-semibold text-lg text-slate-700 mb-2">{t('csv_importing')}</h4>
              <p className="text-sm text-slate-500">{t('csv_wait_message')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={step === 'importing'}
            className="px-6 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('cancel')}
          </button>

          <div className="flex gap-3">
            {step === 'preview' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-6 py-3 border border-slate-300 rounded-lg text-slate-600 font-medium hover:bg-slate-100"
                >
                  {t('select_another_file')}
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={errors.length > 0 || products.length === 0}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {t('csv_import_n_products').replace('{n}', String(products.length))}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
