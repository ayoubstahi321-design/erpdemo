import React, { useState, useEffect, useRef } from 'react';
import { Logo } from './Logo';
import { useLanguage } from '../services/i18n';
import { ShieldCheck, Loader2, RefreshCw, Mail } from 'lucide-react';

interface AdminCodeVerificationProps {
  email: string;
  userId: string;
  onVerified: () => void;
  onCancel: () => void;
}

export const AdminCodeVerification: React.FC<AdminCodeVerificationProps> = ({
  email,
  userId,
  onVerified,
  onCancel,
}) => {
  const { t } = useLanguage();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (value && index === 5 && newCode.every(d => d !== '')) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      handleVerify(pasted);
    }
  };

  const handleVerify = async (codeStr: string) => {
    setIsVerifying(true);
    setError('');

    try {
      const res = await fetch('/api/verify-admin-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code: codeStr }),
      });

      const data = await res.json();

      if (data.success && data.verified) {
        onVerified();
      } else if (data.expired) {
        setError(t('code_expired') || 'Codigo expirado. Solicita uno nuevo.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else if (data.invalid) {
        setError(t('invalid_code') || 'Codigo incorrecto. Intenta de nuevo.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setError(data.error || 'Error de verificacion');
      }
    } catch (err) {
      setError(t('network_error') || 'Error de red');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setIsResending(true);
    setError('');

    try {
      const res = await fetch('/api/send-admin-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userId }),
      });

      const data = await res.json();

      if (data.success) {
        setCountdown(60); // 60 seconds before can resend
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setError(data.error || 'Erreur lors de l\'envoi du code');
      }
    } catch (err) {
      setError(t('network_error') || 'Error de red');
    } finally {
      setIsResending(false);
    }
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col justify-center py-12 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <Logo className="h-16 w-auto" />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-8 text-center">
            <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">
              {t('admin_verification') || 'Vérification Admin'}
            </h2>
            <p className="mt-2 text-blue-100 text-sm">
              {t('enter_code_sent_to') || 'Entrez le code envoyé à'}
            </p>
            <p className="text-white font-medium mt-1 flex items-center justify-center">
              <Mail className="w-4 h-4 mr-2" />
              {maskedEmail}
            </p>
          </div>

          {/* Code Input */}
          <div className="px-6 py-8">
            <div className="flex justify-center gap-2 mb-6">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={isVerifying}
                  className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl transition-all
                    ${digit ? 'border-blue-500 bg-blue-50' : 'border-slate-300'}
                    ${isVerifying ? 'opacity-50' : ''}
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none
                  `}
                />
              ))}
            </div>

            {error && (
              <div className="text-center text-red-600 text-sm mb-4 bg-red-50 py-2 px-4 rounded-lg">
                {error}
              </div>
            )}

            {isVerifying && (
              <div className="flex items-center justify-center text-blue-600 mb-4">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                {t('verifying') || 'Vérification...'}
              </div>
            )}

            {/* Resend */}
            <div className="text-center">
              <button
                onClick={handleResend}
                disabled={countdown > 0 || isResending}
                className={`inline-flex items-center text-sm ${
                  countdown > 0 || isResending
                    ? 'text-slate-400 cursor-not-allowed'
                    : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                {isResending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {countdown > 0
                  ? `${t('resend_in') || 'Renvoyer dans'} ${countdown}s`
                  : t('resend_code') || 'Renvoyer le code'}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
            <button
              onClick={onCancel}
              className="w-full py-3 text-slate-600 font-medium hover:text-slate-800 transition-colors"
            >
              {t('cancel') || 'Annuler'}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-slate-400 text-sm">
          {t('code_expires_5min') || 'El codigo expira en 5 minutos'}
        </p>
      </div>
    </div>
  );
};
