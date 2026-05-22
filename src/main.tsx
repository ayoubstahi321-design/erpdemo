
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { LanguageProvider } from './services/i18n';
import { ErrorBoundary } from './components/ErrorBoundary';
import { inject } from '@vercel/analytics';
import { registerServiceWorker } from './utils/registerSW';

// ✅ Monitoreo gratuito con Vercel Analytics
inject();

// ✅ Register Service Worker for PWA offline support
registerServiceWorker();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>
);
