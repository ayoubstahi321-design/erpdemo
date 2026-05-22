
import React, { useState } from 'react';
import { Logo } from './Logo';
import { useLanguage } from '../services/i18n';
import { supabase } from '../services/supabaseClient';
import { Mail, Lock, ArrowRight, Loader2, Globe, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { t, language, setLanguage } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    await handleSignIn();
  };

  const handleSignIn = async (retryCount = 0) => {
    let isRetrying = false;
    try {
      // 20s timeout — Supabase free tier can be slow to wake up
      const authPromise = supabase.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('__timeout__')), 20000)
      );
      const { data, error } = await Promise.race([authPromise, timeoutPromise]);
      if (error) throw error;
      setSuccess(t('login_success'));
      setError('');
      // onLogin called automatically via SIGNED_IN event in onAuthStateChange
    } catch (err: any) {
      if (err?.message === '__timeout__' && retryCount < 1) {
        // Auto-retry once: server may be waking up (Supabase free tier cold start)
        isRetrying = true;
        setError('El servidor está iniciando, reintentando automáticamente...');
        setTimeout(() => handleSignIn(retryCount + 1), 4000);
      } else if (err?.message === '__timeout__') {
        setError('Servidor no responde. El proyecto Supabase puede estar pausado — ve al dashboard de Supabase → "Restore Project" → espera 2-3 min y vuelve a intentar.');
        setSuccess('');
      } else {
        setError(err?.message ?? t('network_error'));
        setSuccess('');
      }
    } finally {
      // Keep spinner while auto-retrying; stop it on success, real error, or final timeout
      if (!isRetrying) setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth/callback`,
      });
      if (error) throw error;
      setResetMessage(t('reset_email_sent'));
      setError('');
    } catch (err: any) {
      setError(err?.message ?? t('network_error'));
      setResetMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  const languages = [
    { code: 'fr' as const, name: 'Français', flag: '🇫🇷' },
    { code: 'es' as const, name: 'Español', flag: '🇪🇸' },
    { code: 'ar' as const, name: 'العربية', flag: '🇲🇦' },
    { code: 'en' as const, name: 'English', flag: '🇬🇧' },
  ];

  return (
    <div className="min-h-screen bg-gradient-secondary flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative">
      {/* Language Selector */}
      <div className="absolute top-4 right-4 z-10">
        <div className="relative inline-block">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as any)}
            className="appearance-none bg-white border border-secondary-300 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-secondary-700 hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 cursor-pointer shadow-soft"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-secondary-700">
            <Globe className="h-4 w-4" />
          </div>
        </div>
      </div>

      {showForgotPassword ? (
        <div className="sm:mx-auto sm:w-full sm:max-w-lg animate-fade-in">
          <div className="flex justify-center">
            <Logo className="h-20 w-auto" />
          </div>
          <h2 className="mt-8 text-center text-4xl font-extrabold text-secondary-900">
            {t('recover_password')}
          </h2>
          <p className="mt-3 text-center text-base text-secondary-600">
            {t('enter_email_recover')}
          </p>

          <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-lg">
            <div className="bg-white py-10 px-6 shadow-large rounded-2xl sm:px-12 border border-secondary-200 hover:shadow-glow transition-shadow duration-300">
              <form className="space-y-6" onSubmit={handlePasswordReset}>
                <div>
                  <label htmlFor="reset-email" className="block text-sm font-medium text-secondary-700">
                    {t('email')}
                  </label>
                  <div className="mt-1 relative rounded-md shadow-soft">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-secondary-400" />
                    </div>
                    <input
                      id="reset-email"
                      name="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-secondary-300 rounded-lg py-2.5 transition-colors duration-200"
                      placeholder="admin@azmol.ma"
                    />
                  </div>
                </div>

                {resetMessage && (
                  <div className={`text-sm text-center ${resetMessage.includes('sent') ? 'text-green-600' : 'text-red-600'}`}>
                    {resetMessage}
                  </div>
                )}

                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1 flex justify-center py-3 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    {t('back_to_login')}
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      t('send_link')
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="sm:mx-auto sm:w-full sm:max-w-md animate-fade-in">
            <div className="flex justify-center">
              <Logo className="h-16 w-auto" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-secondary-900">
              {t('login_title')}
            </h2>
            <p className="mt-2 text-center text-sm text-secondary-600">
              Azmol British Petrochemicals
            </p>
          </div>

          <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow-large rounded-xl sm:px-10 border border-secondary-200 hover:shadow-glow transition-shadow duration-300">
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    {t('email')}
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-lg py-2.5"
                      placeholder="admin@azmol.ma"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    {t('password')}
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-10 sm:text-sm border-slate-300 rounded-lg py-2.5"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="text-red-600 text-sm text-center">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="text-green-600 text-sm text-center">
                    {success}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded transition-colors duration-200"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-secondary-900">
                      {t('remember_me')}
                    </label>
                  </div>

                  <div className="text-sm">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="font-medium text-primary-600 hover:text-primary-700 transition-colors duration-200"
                    >
                      {t('forgot_password')}
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-soft text-sm font-medium text-white bg-gradient-primary hover:shadow-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className="flex items-center">
                        {t('signin')} <ArrowRight className="ml-2 h-4 w-4" />
                      </span>
                    )}
                  </button>
                </div>


              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
