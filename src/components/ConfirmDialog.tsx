import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Supprimer',
  cancelLabel = 'Annuler',
  onConfirm,
  onCancel,
  variant = 'danger',
}) => {
  if (!isOpen) return null;

  const confirmColor = variant === 'danger'
    ? 'bg-rose-600 hover:bg-rose-700 text-white'
    : 'bg-amber-500 hover:bg-amber-600 text-white';

  const iconColor = variant === 'danger' ? 'text-rose-500' : 'text-amber-500';
  const iconBg = variant === 'danger' ? 'bg-rose-50' : 'bg-amber-50';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
        <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-4`}>
          <AlertTriangle className={`w-6 h-6 ${iconColor}`} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-2">{title}</h3>
        <p className="text-sm text-slate-600 text-center mb-6">{message}</p>
        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl font-semibold shadow-sm transition-colors ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
