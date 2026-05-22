import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// Standalone translation lookup (ErrorBoundary is outside LanguageProvider)
const errorTranslations: Record<string, Record<string, string>> = {
  fr: {
    title: "Oups ! Quelque chose s'est mal passé",
    message: "L'application a rencontré une erreur inattendue. Ne vous inquiétez pas, vos données sont en sécurité.",
    details: "Détails techniques (dev uniquement)",
    retry: "Réessayer",
    go_home: "Aller à l'accueil",
    support: "Si le problème persiste, contactez le support",
  },
  es: {
    title: "¡Ups! Algo salió mal",
    message: "La aplicación encontró un error inesperado. No te preocupes, tus datos están seguros.",
    details: "Detalles técnicos (solo en desarrollo)",
    retry: "Reintentar",
    go_home: "Ir al inicio",
    support: "Si el problema persiste, contacta con soporte",
  },
  ar: {
    title: "عذراً! حدث خطأ ما",
    message: "واجه التطبيق خطأ غير متوقع. لا تقلق، بياناتك آمنة.",
    details: "التفاصيل التقنية (للمطورين فقط)",
    retry: "إعادة المحاولة",
    go_home: "الذهاب للرئيسية",
    support: "إذا استمرت المشكلة، تواصل مع الدعم",
  },
  en: {
    title: "Oops! Something went wrong",
    message: "The application encountered an unexpected error. Don't worry, your data is safe.",
    details: "Technical details (dev only)",
    retry: "Retry",
    go_home: "Go to home",
    support: "If the problem persists, contact support",
  },
};

function getErrorText(key: string): string {
  const lang = localStorage.getItem('azmol_lang') || 'fr';
  return errorTranslations[lang]?.[key] || errorTranslations['fr'][key] || key;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]:', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // Auto-reload on stale chunk errors (after deploy, old JS files no longer exist)
    const msg = error.message || '';
    const isChunkError = msg.includes('Failed to fetch dynamically imported module')
      || msg.includes('Loading chunk')
      || msg.includes('Loading CSS chunk');
    if (isChunkError && !sessionStorage.getItem('chunk_reload')) {
      sessionStorage.setItem('chunk_reload', '1');
      window.location.reload();
      return;
    }

    this.setState({
      error,
      errorInfo
    });

    if (import.meta.env.PROD) {
      this.logErrorToSupabase(error, errorInfo);
    }
  }

  async logErrorToSupabase(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const { supabase } = await import('../services/supabaseClient');

      await supabase.from('error_logs').insert({
        message: error.message,
        stack: error.stack,
        component_stack: errorInfo.componentStack,
        user_agent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('[ErrorBoundary] Failed to log error:', e);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      const dir = (localStorage.getItem('azmol_lang') || 'fr') === 'ar' ? 'rtl' : 'ltr';

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir={dir}>
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900">
                {getErrorText('title')}
              </h1>
            </div>

            <p className="text-gray-600 mb-4">
              {getErrorText('message')}
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="mb-4 p-4 bg-red-50 rounded border border-red-200">
                <summary className="cursor-pointer font-semibold text-red-700 mb-2">
                  {getErrorText('details')}
                </summary>
                <pre className="text-xs text-red-600 overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                {getErrorText('retry')}
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
              >
                {getErrorText('go_home')}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4 text-center">
              {getErrorText('support')}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
