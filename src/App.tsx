
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { AdminCodeVerification } from './components/AdminCodeVerification';

// Retry wrapper: if a lazy chunk fails to load (stale deploy), reload the page once
function lazyRetry<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(() =>
    importFn().catch((error: Error) => {
      // Only auto-reload once to avoid infinite loops
      const hasReloaded = sessionStorage.getItem('chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
      }
      throw error;
    })
  );
}

// Clear the reload flag on successful app load
sessionStorage.removeItem('chunk_reload');

// Stale bundle detector: if the app's index.html references a different main bundle
// than the one currently loaded, a new deploy is live — reload once to pick it up.
(async () => {
  try {
    const res = await fetch('/', { cache: 'no-store', headers: { 'Accept': 'text/html' } });
    const html = await res.text();
    // Extract the main bundle filename from the fresh index.html
    const match = html.match(/\/assets\/(index-[^"]+\.js)/);
    if (match) {
      const freshBundle = match[1];
      // Find what bundle this tab loaded (current script tags)
      const loadedBundles = Array.from(document.querySelectorAll('script[src]'))
        .map((s: any) => s.src)
        .join(',');
      if (!loadedBundles.includes(freshBundle)) {
        const hasReloaded = sessionStorage.getItem('version_reload');
        if (!hasReloaded) {
          sessionStorage.setItem('version_reload', '1');
          window.location.reload();
        }
      } else {
        sessionStorage.removeItem('version_reload');
      }
    }
  } catch { /* network error — ignore */ }
})();

// Lazy loaded components (with auto-reload on stale chunk errors)
const Dashboard = lazyRetry(() => import('./components/Dashboard'));
const Inventory = lazyRetry(() => import('./components/Inventory'));
const Sales = lazyRetry(() => import('./components/Sales'));
const Transfers = lazyRetry(() => import('./components/Transfers'));
const Customers = lazyRetry(() => import('./components/Customers'));
const AIAssistant = lazyRetry(() => import('./components/AIAssistant'));
const UsersComp = lazyRetry(() => import('./components/Users'));
const Warehouses = lazyRetry(() => import('./components/Warehouses'));
const AuditLog = lazyRetry(() => import('./components/AuditLog'));
const Returns = lazyRetry(() => import('./components/Returns'));
const Settings = lazyRetry(() => import('./components/Settings'));
const Accounting = lazyRetry(() => import('./components/Accounting'));
const POS = lazyRetry(() => import('./components/POS'));
const Treasury = lazyRetry(() => import('./components/Treasury'));
const Suppliers = lazyRetry(() => import('./components/Suppliers'));
const PurchaseOrders = lazyRetry(() => import('./components/PurchaseOrders'));
const CompanyStockConsumption = lazyRetry(() => import('./components/CompanyStockConsumption'));
import { COMPANY_INFO } from './constants';
import { User, UserRole, AuditAction, AuditEntity, CompanySettings, Sale } from './types';
import { ProtectedRoute } from './components/ProtectedRoute';
import { dataService, KEYS } from './services/dataService';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import { useStore } from './store/useStore';
import { fetchUserCompaniesForUser } from './hooks/useSupabaseData';
import { Loader2, Lock, Sparkles } from 'lucide-react';
import { ToastProvider } from './hooks/useToast';
import { useProducts, useCustomers, useWarehouses, useTransfers, useReturns, useAuditLogs, useCompanies, useCharges, useAppSetting, setAppSetting, migrateStockToUnits } from './hooks/useSupabaseData';
import { useOfflineSales } from './hooks/useOfflineSales';
import type { TabNavPayload } from './components/Layout';
import { logger } from './utils/logger';
import { initializeSyncEngine, destroySyncEngine } from './services/offline';
import { FEATURES } from './config/features';
import { useLanguage } from './services/i18n';
// Import migration scripts for global access
import './utils/migrateWarehouses';
import './utils/migrateCustomers';
import './utils/migrateProducts';
import './utils/migrateAll';

// localStorage key for instant session restore on F5/refresh
const PROFILE_CACHE_KEY = 'azmol_user_profile';

// 2FA verification stored in localStorage (not sessionStorage) so it survives PWA kills on mobile.
// Format: JSON { userId, verifiedAt } — valid for 8 hours per user.
const ADMIN_2FA_KEY = 'azmol_admin_2fa_verified';
const ADMIN_2FA_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function isAdmin2FAVerified(userId: string): boolean {
  try {
    const raw = localStorage.getItem(ADMIN_2FA_KEY);
    if (!raw) return false;
    const { userId: storedId, verifiedAt } = JSON.parse(raw);
    if (storedId !== userId) return false;
    return Date.now() - verifiedAt < ADMIN_2FA_TTL_MS;
  } catch { return false; }
}

function setAdmin2FAVerified(userId: string): void {
  try {
    localStorage.setItem(ADMIN_2FA_KEY, JSON.stringify({ userId, verifiedAt: Date.now() }));
  } catch { /* ignore storage errors */ }
}

function clearAdmin2FAVerified(): void {
  localStorage.removeItem(ADMIN_2FA_KEY);
}

// Route permission map - matches Layout sidebar roles (post-migration)
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  dashboard: [],                                    // all roles
  pos: ['Admin', 'Manager', 'Sales'],
  inventory: ['Admin', 'Manager', 'Sales'],
  transfers: ['Admin', 'Manager', 'Warehouse'],
  customers: ['Admin', 'Manager', 'Sales'],
  sales: ['Admin', 'Manager', 'Sales'],
  returns: ['Admin', 'Manager', 'Sales'],
  accounting: ['Admin', 'Manager', 'Accountant'],
  treasury: ['Admin', 'Manager', 'Accountant'],
  users: ['Admin'],
  warehouses: ['Admin', 'Manager'],
  audit: ['Admin', 'Manager'],
  suppliers: ['Admin', 'Manager'],
  'purchase-orders': ['Admin', 'Manager'],
  'company-consumption': ['Admin', 'Manager'],
  settings: ['Admin'],
  'ai-assistant': [],                               // all roles
};

const hasTabAccess = (tab: string, role: UserRole): boolean => {
  const allowed = ROUTE_PERMISSIONS[tab];
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(role);
};

const getDefaultTabForRole = (role: UserRole): string => {
  switch (role) {
    case 'Sales':      return 'sales';
    case 'Warehouse':  return 'transfers';
    case 'Accountant': return 'treasury';
    default:           return 'dashboard'; // Admin, Manager
  }
};

// Load user's assigned companies and set active company
const loadUserCompanies = async (userId: string, userRole: string) => {
  try {
    // Admin: access to all companies, auto-select first if none active
    if (userRole === 'Admin') {
      useStore.getState().setUserAssignedCompanyIds([]);
      const { activeCompanyId, companyProfiles } = useStore.getState();
      if (!activeCompanyId && companyProfiles.length > 0) {
        useStore.getState().setActiveCompany(companyProfiles[0].id);
      }
      return;
    }

    // Manager: access to all companies with NO company filter (sees all customers/sales)
    if (userRole === 'Manager') {
      useStore.getState().setUserAssignedCompanyIds([]);
      useStore.getState().setActiveCompany(null); // null = no filter = sees everything
      return;
    }

    const companyIds = await fetchUserCompaniesForUser(userId);
    useStore.getState().setUserAssignedCompanyIds(companyIds);

    // Auto-select first company if none is active
    const { activeCompanyId, companyProfiles } = useStore.getState();
    if (companyIds.length > 0 && (!activeCompanyId || !companyIds.includes(activeCompanyId))) {
      // Select first assigned company that exists in profiles
      const firstValidCompany = companyIds.find(id => companyProfiles.some(p => p.id === id));
      if (firstValidCompany) {
        useStore.getState().setActiveCompany(firstValidCompany);
      } else if (companyIds.length > 0) {
        useStore.getState().setActiveCompany(companyIds[0]);
      }
    }
  } catch (error) {
    console.error('Failed to load user companies:', error);
  }
};

// Password Reset Form - shown after clicking the email recovery link
const PasswordResetForm = ({ onComplete }: { onComplete: () => void }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      onComplete();
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md border border-slate-200">
        <div className="text-center mb-6">
          <Lock className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-slate-800">Nueva Contraseña</h2>
          <p className="text-slate-500 text-sm mt-1">Introduce tu nueva contraseña</p>
        </div>
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Minimo 8 caracteres"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Repetir contraseña"
            />
          </div>
          {error && <p className="text-red-600 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Loading fallback component for lazy loaded routes
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Cargando...</p>
    </div>
  </div>
);

function App() {
  // Translation hook
  const { t } = useLanguage();

  // Session State: Null indicates no active session (logged out)
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Admin 2FA: Pending verification state
  const [pendingAdminVerification, setPendingAdminVerification] = useState<{
    user: User;
    email: string;
    userId: string;
  } | null>(null);

  const [users, setUsers] = useState<User[]>(() => dataService.load(KEYS.USERS, []));

  // ✅ ALL DATA NOW MANAGED BY SUPABASE HOOKS - SHARED ACROSS ALL COMPONENTS
  const productsHook = useProducts();
  const products = productsHook.products;

  const customersHook = useCustomers();
  const customers = customersHook.customers;

  const warehousesHook = useWarehouses();
  const warehouses = warehousesHook.warehouses;

  const salesHook = useOfflineSales();
  const sales = salesHook.sales;

  const transfersHook = useTransfers();
  const transfers = transfersHook.transfers;

  const returnsHook = useReturns();
  const returns = returnsHook.returns;

  // Sales role sees only their own customers, sales and returns
  const visibleCustomers = currentUser?.role === 'Sales'
    ? customers.filter(c => c.assignedTo === currentUser?.id)
    : customers;
  const visibleSales = currentUser?.role === 'Sales'
    ? sales.filter(s => visibleCustomers.some(c => c.id === s.customerId))
    : sales;
  const visibleReturns = currentUser?.role === 'Sales'
    ? returns.filter(r => visibleCustomers.some(c => c.id === r.customerId))
    : returns;

  const auditLogsHook = useAuditLogs();
  const auditLogs = auditLogsHook.auditLogs;

  const chargesHook = useCharges();

  // Companies from Supabase — sync into Zustand store so all components work
  const companiesHook = useCompanies();
  const { setCompanyProfiles, setActiveCompany: storeSetActiveCompany, updateCompanyProfile: storeUpdateCompanyProfile } = useStore();
  useEffect(() => {
    if (!companiesHook.loading && companiesHook.companies.length > 0) {
      setCompanyProfiles(companiesHook.companies);
    }
  }, [companiesHook.companies, companiesHook.loading]);

  // Auto-migration: converts stock from boxes → units once, in the background.
  // Only marks as done when ALL updates succeed (errors === 0), so a partial failure
  // allows a retry on the next page load.
  // migrationStarted prevents the effect from firing more than once per React session
  // even if the component re-renders before the DB flag write propagates.
  const { value: stockMigratedValue, loading: migrationFlagLoading } = useAppSetting('stock_migrated');
  const stockMigrated = stockMigratedValue === 'true';
  const migrationStarted = useRef(false);
  useEffect(() => {
    if (migrationFlagLoading) return;
    if (stockMigrated) return;
    if (productsHook.loading || products.length === 0) return;
    if (!currentUser) return;
    if (migrationStarted.current) return;
    migrationStarted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const result = await migrateStockToUnits(products, currentUser.id);
        if (cancelled) return;
        if (result.errors === 0) {
          await setAppSetting('stock_migrated', 'true');
        } else {
          migrationStarted.current = false; // allow retry on next page load
          logger.error(`Stock migration had ${result.errors} error(s) — will retry next load`);
        }
      } catch (err) {
        migrationStarted.current = false; // allow retry on next page load
        logger.error('Auto stock migration failed:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [stockMigrated, migrationFlagLoading, productsHook.loading, currentUser?.id]);

  const [dashboardConfigs, setDashboardConfigs] = useState<any[]>(() => dataService.load(KEYS.DASHBOARD_CONFIG, []));
  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => dataService.load(KEYS.SETTINGS, COMPANY_INFO));

  // Use active company's settings for invoices when a company is selected
  const { activeCompanyId: storeActiveCompanyId, companyProfiles: storeCompanyProfiles } = useStore();

  // Auto-select first company when companies load and none is active
  useEffect(() => {
    if (!companiesHook.loading && storeCompanyProfiles.length > 0 && !storeActiveCompanyId) {
      storeSetActiveCompany(storeCompanyProfiles[0].id);
    }
  }, [storeCompanyProfiles, storeActiveCompanyId, companiesHook.loading]);
  const effectiveCompanySettings: CompanySettings = (() => {
    if (storeActiveCompanyId && storeCompanyProfiles.length > 0) {
      const activeProfile = storeCompanyProfiles.find(p => p.id === storeActiveCompanyId);
      if (activeProfile) return activeProfile.settings;
    }
    return companySettings;
  })();

  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Prevents login screen flash when Supabase takes longer than the 10s isLoading timeout
  const [sessionRestorePending, setSessionRestorePending] = useState(true);
  // True when cached dashboard is shown but Supabase is unreachable (network/cold start fail)
  const [isOffline, setIsOffline] = useState(false);
  // Incremented each time handleLogin confirms a valid JWT — triggers data refresh when
  // currentUser.id and activeCompanyId haven't changed (instant-restore fast path on cold start).
  const [dataRefreshTick, setDataRefreshTick] = useState(0);
  const [activeTab, setActiveTabRaw] = useState(() => {
    return sessionStorage.getItem('activeTab') || 'dashboard';
  });

  // Navigation payload from notification clicks (pre-selected product/sale/etc.)
  const [navPayload, setNavPayload] = useState<TabNavPayload | null>(null);

  // Secure tab setter - validates permissions before allowing navigation
  const setActiveTab = useCallback((tab: string, payload?: TabNavPayload) => {
    if (currentUser && !hasTabAccess(tab, currentUser.role)) {
      setActiveTabRaw('dashboard');
      return;
    }
    setActiveTabRaw(tab);
    if (payload && (payload.productId || payload.actionSubTab || payload.saleId)) {
      setNavPayload(payload);
    }
  }, [currentUser]);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isAIWidgetOpen, setIsAIWidgetOpen] = useState(false);
  const [aiButtonPosition, setAiButtonPosition] = useState(() => {
    const saved = localStorage.getItem('aiButtonPosition');
    const pos = saved ? JSON.parse(saved) : { x: window.innerWidth - 80, y: window.innerHeight - 80 };
    // If saved position overlaps the sidebar on desktop, move it to safe area
    if (window.innerWidth >= 1024 && pos.x < 276) {
      pos.x = window.innerWidth - 80;
      pos.y = window.innerHeight - 80;
    }
    return pos;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const isLoggingOutRef = useRef(false);
  const isAuthenticatedRef = useRef(false);
  const isLoginInProgressRef = useRef(false); // prevents parallel handleLogin calls
  // Set true on spurious SIGNED_OUT (token refresh) — cleared by the following SIGNED_IN or after 30s.
  // Used to distinguish token-refresh recovery from a fresh credential login in SIGNED_IN handler.
  const tokenRefreshRecoveryRef = useRef(false);
  const tokenRefreshRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guardar posición del botón AI
  useEffect(() => {
    localStorage.setItem('aiButtonPosition', JSON.stringify(aiButtonPosition));
  }, [aiButtonPosition]);

  // Handlers para arrastrar el botón AI
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: aiButtonPosition.x,
      startPosY: aiButtonPosition.y
    };
    setIsDragging(true);
    setHasDragged(false);
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragRef.current || !isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;

    // Solo considerar drag si se movió más de 5px
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setHasDragged(true);
    }

    // On desktop (lg ≥ 1024px) keep the button outside the 256px sidebar
    const minX = window.innerWidth >= 1024 ? 276 : 20;
    const newX = Math.max(minX, Math.min(window.innerWidth - 80, dragRef.current.startPosX + deltaX));
    const newY = Math.max(20, Math.min(window.innerHeight - 80, dragRef.current.startPosY + deltaY));
    setAiButtonPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    dragRef.current = null;
  }, []);

  const handleAIButtonClick = () => {
    // Solo abrir si no fue un drag
    if (!hasDragged) {
      setIsAIWidgetOpen(true);
    }
    setHasDragged(false);
  };

  // Event listeners para drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Initialize offline sync engine when user is logged in
  useEffect(() => {
    if (!currentUser || !FEATURES.OFFLINE_MODE) return;

    logger.debug('[App] Initializing offline sync engine...');
    initializeSyncEngine().then(() => {
      logger.debug('[App] Offline sync engine initialized');
    }).catch((error) => {
      logger.error('[App] Failed to initialize sync engine:', error);
    });

    return () => {
      logger.debug('[App] Destroying offline sync engine...');
      destroySyncEngine();
    };
  }, [currentUser]);

  // Guardar activeTab en sessionStorage cada vez que cambie
  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // ── Tablet / PWA session recovery ──────────────────────────────────────────
  // When the user switches away (home screen, another app) and comes back, the
  // browser may have suspended or even killed the tab.  On resume, if the Supabase
  // JWT has expired while the app was in the background, the SDK will try to
  // refresh it. This listener re-triggers the session check the moment the page
  // becomes visible again, so the user never has to manually re-login after a
  // short absence on a tablet or mobile device.
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      // If the user is already fully authenticated, nothing to do.
      if (isAuthenticatedRef.current) return;

      // If there's a cached profile, the user SHOULD be logged in — silently recheck.
      const hasCachedProfile = !!localStorage.getItem(PROFILE_CACHE_KEY);
      if (!hasCachedProfile) return;

      logger.auth('[visibilitychange] App back to foreground — rechecking session...');
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          logger.warn('[visibilitychange] getSession error — will wait for Supabase SIGNED_IN event', error.message);
          return;
        }
        if (session?.user) {
          logger.auth('[visibilitychange] Session valid — silently re-authenticating', session.user.id);
          handleLogin(session.user, true);
        } else {
          // Session gone — Supabase will fire SIGNED_OUT; our handler will decide whether to sign out.
          logger.warn('[visibilitychange] No session on return — waiting for auth events');
        }
      } catch (err) {
        logger.warn('[visibilitychange] Session recheck failed (network?) — keeping cached state', err);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ───────────────────────────────────────────────────────────────────────────

  // Validate stored tab against user permissions on login
  useEffect(() => {
    if (currentUser && !hasTabAccess(activeTab, currentUser.role)) {
      setActiveTabRaw('dashboard');
    }
  }, [currentUser]);

  // Re-fetch all data after login (initial fetch may have run before Supabase session was ready).
  // Also fires when dataRefreshTick increments (handleLogin fast path on cold start — currentUser.id
  // is unchanged from instant-restore but the JWT is now valid, so we can retry failed fetches).
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser) return;
    const userIdChanged = prevUserIdRef.current !== currentUser.id;
    if (userIdChanged) prevUserIdRef.current = currentUser.id;
    // Refresh when: user first logged in (id changed), OR JWT just became valid (tick bumped)
    if (userIdChanged || dataRefreshTick > 0) {
      productsHook.refresh?.();
      customersHook.refresh?.();
      warehousesHook.refresh?.();
      salesHook.refresh?.();
      transfersHook.refresh?.();
    }
  }, [currentUser?.id, dataRefreshTick]);

  // Listen for tab change events from Dashboard
  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      setActiveTab(event.detail);
    };

    window.addEventListener('changeTab', handleTabChange as EventListener);
    return () => window.removeEventListener('changeTab', handleTabChange as EventListener);
  }, []);

  // Wait for critical data to load before rendering dashboard
  useEffect(() => {
    if (currentUser && !warehousesHook.loading && !productsHook.loading) {
      logger.debug('Critical data loaded', { 
        warehousesCount: warehouses.length, 
        productsCount: products.length,
        loading: isLoading 
      });
      if (isLoading) {
        setIsLoading(false);
      }
    }
  }, [currentUser, warehousesHook.loading, productsHook.loading, warehouses.length, products.length, isLoading]);

  // TIMEOUT DE SEGURIDAD: Resetear isLoading después de 10 segundos máximo.
  // Solo aplica cuando el usuario YA está autenticado (desbloquea carga de datos lenta).
  // No debe dispararse durante el check inicial de sesión — sessionRestorePending ya lo gestiona.
  useEffect(() => {
    if (isLoading && currentUser) {
      const timeout = setTimeout(() => {
        logger.warn('TIMEOUT: Forzando reseteo de isLoading después de 10s (data loading)');
        setIsLoading(false);
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [isLoading, currentUser]);

  // Hard cap: sessionRestorePending never blocks UI longer than 30s (handles Supabase cold-starts)
  useEffect(() => {
    const timeout = setTimeout(() => setSessionRestorePending(false), 30000);
    return () => clearTimeout(timeout);
  }, []);

  // Check for existing Supabase session on app load (only if configured)
  useEffect(() => {
    let mounted = true;

    // Clean up any legacy cachedUserProfile keys from older versions
    sessionStorage.removeItem('cachedUserProfile');

    // ── Instant restore from localStorage ──────────────────────────────────
    // Show dashboard immediately using cached profile — no spinner, no Supabase wait.
    // Background checkSession() verifies freshness and signs out if session expired.
    const cachedStr = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cachedStr) {
      try {
        const cached: User = JSON.parse(cachedStr);
        if (cached?.id && cached?.role) {
          logger.auth('Instant restore from cache', cached.id);
          setCurrentUser(cached);
          setIsLoading(false);
          setSessionRestorePending(false);
          // isAuthenticatedRef intentionally left false — background handleLogin will set it
        }
      } catch { localStorage.removeItem(PROFILE_CACHE_KEY); }
    }
    // ───────────────────────────────────────────────────────────────────────

    if (!isSupabaseConfigured) {
      if (mounted) {
        setIsLoading(false);
        setSessionRestorePending(false);
      }
      return;
    }

    const checkSession = async () => {
      const hasCachedProfile = !!localStorage.getItem(PROFILE_CACHE_KEY);
      try {
        logger.auth('Background session check...');

        // Hard 12s timeout on getSession() — on mobile, token refresh can be slower than desktop
        const getSessionRace = await Promise.race([
          supabase.auth.getSession(),
          new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 12000)),
        ]);
        if (getSessionRace === 'timeout') {
          logger.warn('getSession() timed out (12s)');
          if (mounted) {
            // Only show offline banner if handleLogin hasn't already authenticated the user
            if (hasCachedProfile && !isAuthenticatedRef.current) setIsOffline(true);
            else if (!hasCachedProfile) { setIsLoading(false); setSessionRestorePending(false); }
          }
          return;
        }
        let { data: { session }, error: sessionError } = getSessionRace;

        // If getSession() returned an error (network fail, cold Supabase, refresh fail), treat
        // it as a transient problem — do NOT sign the user out. The SIGNED_OUT / SIGNED_IN
        // event pair will handle re-authentication automatically once connectivity resumes.
        if (!session && sessionError) {
          logger.warn('getSession() returned error — treating as transient, keeping cached state', sessionError.message);
          if (mounted && hasCachedProfile && !isAuthenticatedRef.current) setIsOffline(true);
          else if (mounted && !hasCachedProfile) { setIsLoading(false); setSessionRestorePending(false); }
          return;
        }

        // Retry null session (cold start) for both cached and non-cached users.
        // On mobile, the network or Supabase Auth can be slow to respond after the device
        // wakes from sleep — a null result on the first attempt is often transient.
        const hasStoredSession = Object.keys(localStorage).some(k => k === 'azmol-supabase-auth' || k.startsWith('sb-'));
        if (!session && hasStoredSession) {
          logger.auth('No session (cold start or wake-up?), retrying...');
          const maxRetries = hasCachedProfile ? 3 : 4;
          for (let attempt = 1; attempt <= maxRetries && !session; attempt++) {
            await new Promise(r => setTimeout(r, 2500));
            if (!mounted) return;
            const { data: retry, error: retryErr } = await supabase.auth.getSession();
            if (retryErr) { logger.warn(`Session retry ${attempt} error — aborting retries`, retryErr.message); break; }
            session = retry.session;
            if (session) logger.auth(`Session recovered on retry ${attempt}`);
          }
        }

        if (mounted && session?.user) {
          logger.auth('Session valid — refreshing profile in background', session.user.id);
          handleLogin(session.user, true); // silently updates profile, no spinner shown
        } else if (mounted && !session) {
          if (hasCachedProfile) {
            // We were showing the cached dashboard but the session is genuinely gone.
            // Only sign out if we're certain: no stored session keys remain in localStorage
            // (genuine expiry, e.g. refresh token expired). If keys are still there, keep
            // the user on the dashboard (the SIGNED_IN event will re-authenticate soon).
            if (hasStoredSession) {
              logger.warn('Session null but storage keys remain — keeping cached user on dashboard, waiting for SIGNED_IN');
              if (!isAuthenticatedRef.current) setIsOffline(true);
            } else {
              logger.auth('Cached session expired — no stored keys remain, signing out');
              localStorage.removeItem(PROFILE_CACHE_KEY);
              isAuthenticatedRef.current = false;
              setCurrentUser(null);
              setIsLoading(false);
              setSessionRestorePending(false);
              supabase.auth.signOut();
            }
          } else {
            logger.auth('No session, no cache → show login');
            setIsLoading(false);
            setSessionRestorePending(false);
          }
        }
      } catch (error) {
        // Network/Supabase unreachable — keep cached profile shown (offline resilience)
        logger.error('Session check failed (keeping cached state)', error);
        if (mounted && hasCachedProfile && !isAuthenticatedRef.current) {
          // Show "connection lost" banner only if handleLogin hasn't already authenticated
          setIsOffline(true);
        } else if (mounted && !isAuthenticatedRef.current) {
          setIsLoading(false);
          setSessionRestorePending(false);
        }
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.auth(`Auth state changed: ${event}`, session?.user?.id, { isLoggingOut: isLoggingOutRef.current });

      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        logger.auth('PASSWORD_RECOVERY event - showing password reset form');
        setIsPasswordRecovery(true);
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        // If session restore is in progress and the user didn't explicitly log out,
        // this SIGNED_OUT is likely spurious (failed token refresh on cold Supabase).
        // Ignoring it lets handleLogin complete and use the cached profile as fallback.
        if (isLoginInProgressRef.current && !isLoggingOutRef.current) {
          logger.warn('SIGNED_OUT fired during session restore — likely spurious (cold Supabase), ignoring');
          return;
        }

        // Use isLoggingOutRef (set in handleLogout) to detect explicit logout.
        // Previously used !isAuthenticatedRef, which was wrong: after instant cache restore,
        // isAuthenticatedRef is intentionally false → every SIGNED_OUT was treated as explicit
        // → cache was cleared → user disconnected. isLoggingOutRef is only true on real logout.
        const isExplicitLogout = isLoggingOutRef.current;
        const hasCachedProfile = !!localStorage.getItem(PROFILE_CACHE_KEY);

        logger.auth(`SIGNED_OUT — explicit=${isExplicitLogout}, hasCachedProfile=${hasCachedProfile}`);
        isAuthenticatedRef.current = false;
        isLoginInProgressRef.current = false;
        isLoggingOutRef.current = false;

        if (isExplicitLogout) {
          // Intentional logout — clear everything and show login screen
          setCurrentUser(null);
          setIsOffline(false);
          sessionStorage.removeItem('cachedUserProfile');
          sessionStorage.removeItem('activeTab');
          setActiveTabRaw('dashboard');
          setIsLoading(false);
          localStorage.removeItem(PROFILE_CACHE_KEY);
          clearAdmin2FAVerified();
        } else if (hasCachedProfile) {
          // Spurious SIGNED_OUT (token refresh cycle) — user has a valid cached session.
          // Keep them on the dashboard. The following SIGNED_IN will silently re-authenticate.
          logger.warn('Non-explicit SIGNED_OUT — arming recovery flag, keeping user on dashboard');
          tokenRefreshRecoveryRef.current = true;
          if (tokenRefreshRecoveryTimerRef.current) clearTimeout(tokenRefreshRecoveryTimerRef.current);
          tokenRefreshRecoveryTimerRef.current = setTimeout(() => {
            tokenRefreshRecoveryRef.current = false;
          }, 30000);
          // DO NOT call setCurrentUser(null) — user stays on dashboard, no flash to login!
        } else {
          // No cache and not explicit → treat as real session expiry, show login
          logger.auth('SIGNED_OUT — no cache, treating as real expiry');
          setCurrentUser(null);
          setIsOffline(false);
          sessionStorage.removeItem('cachedUserProfile');
          sessionStorage.removeItem('activeTab');
          setActiveTabRaw('dashboard');
          setIsLoading(false);
        }
      } else if (event === 'INITIAL_SESSION' && session?.user && !isLoggingOutRef.current) {
        // Session restored from localStorage (page refresh / new tab / browser restart)
        if (!isAuthenticatedRef.current && !isLoginInProgressRef.current) {
          logger.auth('INITIAL_SESSION event - restoring session', session.user.id);
          await handleLogin(session.user, true);
        }
      } else if (event === 'SIGNED_IN' && session?.user && !isLoggingOutRef.current) {
        // Explicit credential login OR token-refresh recovery (SIGNED_OUT + SIGNED_IN pair).
        // Instead of relying on a 30s timer (which can expire if refresh is slow),
        // check if the incoming user matches the cached profile — if so, it's a session
        // restore (token refresh), not a fresh credential login. This prevents 2FA from
        // firing mid-session when JWT auto-refresh takes longer than expected.
        tokenRefreshRecoveryRef.current = false;
        if (tokenRefreshRecoveryTimerRef.current) {
          clearTimeout(tokenRefreshRecoveryTimerRef.current);
          tokenRefreshRecoveryTimerRef.current = null;
        }

        const cachedProfileStr = localStorage.getItem(PROFILE_CACHE_KEY);
        const cachedUserId = cachedProfileStr ? (() => { try { return JSON.parse(cachedProfileStr)?.id; } catch { return null; } })() : null;
        const isSameUser = cachedUserId === session.user.id;
        // Treat as session restore if: same user is cached (token refresh) OR isLoggingOut didn't clear the cache.
        // Treat as fresh login if: no cache for this user (explicit logout then re-login).
        const isSessionRestore = isSameUser;

        logger.auth(`SIGNED_IN event — isSameUser=${isSameUser} → isSessionRestore=${isSessionRestore}`, session.user.id);

        // Skip if already authenticated and not a token-refresh cycle.
        if (isAuthenticatedRef.current && isSessionRestore) {
          logger.auth('SIGNED_IN: already authenticated with same user, skipping duplicate call');
          return;
        }

        isLoginInProgressRef.current = false;
        isAuthenticatedRef.current = false;
        await handleLogin(session.user, isSessionRestore);
      } else if (event === 'TOKEN_REFRESHED' && session?.user && !isLoggingOutRef.current) {
        if (!isAuthenticatedRef.current) {
          await handleLogin(session.user, true);
        } else {
          logger.auth('TOKEN_REFRESHED: User already authenticated, skipping re-login');
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Asynchronous Data Loading Effect (Sync with Server/GAS if available)
  useEffect(() => {
    // Solo cargar datos adicionales si el usuario ya está autenticado
    if (!currentUser) return;

    const loadData = async () => {
      try {
        const serverData = await dataService.loadAllFromServer();

        // Only update if server data exists (merging strategy could be improved for production)
        if (serverData.users) setUsers(serverData.users);
        // ✅ Products, Customers, Warehouses, Sales, Transfers, Returns, AuditLogs loaded from Supabase via hooks
        // if (serverData.sales) setSales(serverData.sales);
        // if (serverData.warehouses) setWarehouses(serverData.warehouses);
        // if (serverData.transfers) setTransfers(serverData.transfers);
        // if (serverData.customers) setCustomers(serverData.customers);
        // if (serverData.auditLogs) setAuditLogs(serverData.auditLogs);
        // if (serverData.returns) setReturns(serverData.returns);
        if (serverData.dashboardConfig) setDashboardConfigs(serverData.dashboardConfig);
        if (serverData.settings) setCompanySettings(serverData.settings);
      } catch (error) {
        logger.error("Failed to load server data, using local data", error);
      }
    };

    // No tocar isLoading aquí - ya se maneja en checkSession
    loadData();
  }, [currentUser]);

  // Persistence Effects (Save changes to localStorage)
  useEffect(() => { dataService.save(KEYS.USERS, users); }, [users]);
  // ✅ Products, Customers, Warehouses, Sales, Transfers, Returns, AuditLogs persistence handled by Supabase hooks
  // useEffect(() => { dataService.save(KEYS.SALES, sales); }, [sales]);
  // useEffect(() => { dataService.save(KEYS.TRANSFERS, transfers); }, [transfers]);
  // useEffect(() => { dataService.save(KEYS.CUSTOMERS, customers); }, [customers]);
  // useEffect(() => { dataService.save(KEYS.WAREHOUSES, warehouses); }, [warehouses]);
  // useEffect(() => { dataService.save(KEYS.AUDIT_LOGS, auditLogs); }, [auditLogs]);
  // useEffect(() => { dataService.save(KEYS.RETURNS, returns); }, [returns]);
  useEffect(() => { dataService.save(KEYS.DASHBOARD_CONFIG, dashboardConfigs); }, [dashboardConfigs]);
  useEffect(() => { dataService.save(KEYS.SETTINGS, companySettings); }, [companySettings]);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 3000);
  };

  // Refresh all Supabase data (called when connection is restored or manually)
  const handleRefreshData = async () => {
    try {
      await Promise.all([
        productsHook.refresh(),
        customersHook.refresh(),
        warehousesHook.refresh(),
        salesHook.refresh(),
        transfersHook.refresh(),
        returnsHook.refresh(),
        auditLogsHook.refresh(),
      ]);
      showNotification('Datos actualizados correctamente', 'success');
    } catch (error) {
      logger.error('Error refreshing data', error);
    }
  };

  const performBackup = useCallback(async (silent = false) => {
    try {
      if (!silent) showNotification(t('backup_creating'), "info");

      let backupModule: any;
      try {
        backupModule = await import('./services/backupService');
      } catch {
        // Stale bundle after deploy — reload once to pick up the fresh chunk
        const hasReloaded = sessionStorage.getItem('backup_chunk_reload');
        if (!hasReloaded) {
          sessionStorage.setItem('backup_chunk_reload', '1');
          window.location.reload();
        } else {
          showNotification('Error al cargar el módulo de backup. Recarga la página.', 'error');
        }
        return null;
      }
      const { createBackup, downloadBackup } = backupModule;
      const result = await createBackup(currentUser?.email);

      if (result.success && result.data) {
        downloadBackup(result.data);

        // Registrar en audit_logs (sin bloquear el backup si falla)
        try { await supabase.rpc('log_admin_backup'); } catch (_) {}

        if (!silent) showNotification(t('backup_downloaded'), "success");
        return new Date().toISOString();
      } else {
        showNotification(result.error || t('backup_failed'), "error");
        return null;
      }
    } catch (error: any) {
      console.error('Backup error:', error);
      showNotification(error.message || t('backup_failed'), "error");
      return null;
    }
  }, [currentUser, t]);

  // Auto-backup: download .gz automatically once every 24h (admin only)
  useEffect(() => {
    if (!currentUser || isLoading || currentUser.role !== 'Admin') return;

    const BACKUP_KEY = 'azmol_last_auto_backup';
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const last = localStorage.getItem(BACKUP_KEY);
    const elapsed = last ? Date.now() - new Date(last).getTime() : Infinity;

    if (elapsed >= ONE_DAY) {
      // Small delay so the UI finishes loading first
      const timer = setTimeout(async () => {
        logger.debug('Auto-backup: 24h+ since last backup, starting...');
        showNotification(t('backup_auto'), 'info');
        const timestamp = await performBackup(true);
        if (timestamp) {
          localStorage.setItem(BACKUP_KEY, timestamp);
          showNotification(t('backup_auto_done'), 'success');
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentUser, isLoading, performBackup, t]);

  // ✅ Audit logs now managed by useAuditLogs hook
  const logAction = (_action: AuditAction, _entity: AuditEntity, _entityId: string, _details: string) => {
    if (!currentUser) return;
    // Note: Audit logs are now automatically created by Supabase triggers
  };

  const handleLogout = () => {
    logger.auth('Logging out...');
    isLoggingOutRef.current = true;

    // Audit: Log logout event before clearing state (fire-and-forget)
    if (isSupabaseConfigured && currentUser) {
      supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action: 'LOGIN',
        entity: 'User',
        entity_id: currentUser.id,
        details: `Logout: ${currentUser.name}`
      }).then(() => {}, () => {});
    }

    // Destroy Supabase session tokens from localStorage immediately (don't wait for API)
    // This prevents re-authentication on page reload if signOut() API is slow
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });

    // Also call signOut() to invalidate server-side session
    if (isSupabaseConfigured) {
      supabase.auth.signOut().then(
        () => logger.auth('Supabase signOut completed'),
        (err) => logger.error('Supabase signOut error', err)
      );
    }

    // Clear all local state immediately
    logger.auth('Clearing user state...');
    isAuthenticatedRef.current = false;
    isLoggingOutRef.current = false;
    setCurrentUser(null);
    localStorage.removeItem(PROFILE_CACHE_KEY); // clear instant-restore cache on logout

    sessionStorage.removeItem('activeTab');
    sessionStorage.removeItem('cachedUserProfile');
    clearAdmin2FAVerified(); // clear 2FA flag on explicit logout
    setActiveTab('dashboard');

    logger.auth('User state cleared');
    showNotification('Logged out successfully', 'success');
  };

  // Background profile verification: silently updates role/profile if changed in DB
  const verifyProfileInBackground = async (user: any) => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error || !profileData) {
        logger.warn('Background profile verify failed', error);
        return;
      }

      // If role is missing from DB, don't overwrite with a fallback - keep existing role
      if (!profileData.role) {
        logger.warn('Background profile verify: role is null in DB, skipping update', user.id);
        return;
      }

      const updatedProfile: User = {
        id: profileData.id,
        name: profileData.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        role: profileData.role,
        email: profileData.email || user.email,
        warehouseId: profileData.warehouse_id || null,
        lastActive: new Date().toISOString()
      };

      // Update state if profile changed (e.g. admin changed role)
      setCurrentUser(updatedProfile);
      logger.auth('Background profile verified', user.id, { role: updatedProfile.role });
    } catch (e) {
      logger.warn('Background profile verify exception', e);
    }
  };

  // handleLogin: isSessionRestore=true means don't reset tab to dashboard
  const handleLogin = async (user: any, isSessionRestore: boolean = false) => {
    try {
      logger.auth('handleLogin INICIADO', user.id, { isSessionRestore });

      // PREVENIR LLAMADAS MÚLTIPLES Y PARALELAS
      if (isAuthenticatedRef.current) {
        logger.warn('handleLogin abortado: Ya hay usuario logueado (ref)');
        return;
      }
      if (isLoginInProgressRef.current) {
        logger.warn('handleLogin abortado: Login ya en progreso');
        return;
      }
      isLoginInProgressRef.current = true;
      // Note: isAuthenticatedRef.current = true is set AFTER successful login (including 2FA)

      // ── Fast path for session restore ──────────────────────────────────────
      // If we already have a valid cached profile for this user, use it immediately
      // instead of waiting up to 15s for the DB query (3 × 5s timeouts on cold Supabase).
      // verifyProfileInBackground() will refresh it silently once Supabase wakes up.
      if (isSessionRestore) {
        const cachedStr = localStorage.getItem(PROFILE_CACHE_KEY);
        if (cachedStr) {
          try {
            const cached: User = JSON.parse(cachedStr);
            if (cached?.id === user.id && cached?.role) {
              logger.auth('Session restore fast path — using cached profile, verifying in background', user.id);
              isLoginInProgressRef.current = false;
              isAuthenticatedRef.current = true;
              setCurrentUser(cached);
              setIsOffline(false);
              setIsLoading(false);
              setSessionRestorePending(false);
              // Load companies + verify profile silently (non-blocking)
              loadUserCompanies(user.id, cached.role).catch(() => {});
              verifyProfileInBackground(user);
              // JWT is valid now — refresh data hooks that may have failed during cold start
              // (currentUser.id and activeCompanyId are unchanged from instant-restore, so
              // the normal [currentUser?.id] / [activeCompanyId] effects won't re-fire)
              setDataRefreshTick(t => t + 1);
              return;
            }
          } catch { /* corrupt cache — fall through to normal DB query */ }
        }
      }
      // ───────────────────────────────────────────────────────────────────────

      // Profile query with retry + 5s timeout per attempt (prevents indefinite hang)
      logger.debug('Consultando profiles...');
      let profileData: any = null;
      let profileError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data, error } = await Promise.race([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          new Promise<{ data: null; error: { message: string } }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: { message: 'Profile query timeout (10s)' } }), 10000)
          ),
        ]);
        if (data) {
          profileData = data;
          profileError = null;
          break;
        }
        profileError = error;
        if (attempt < 3) {
          logger.warn(`Profile query attempt ${attempt} failed, retrying in 500ms...`, (error as any)?.message);
          await new Promise(r => setTimeout(r, 500));
        }
      }

      let userProfile: User;

      if (profileError || !profileData) {
        logger.warn('Error fetching profile from DB', profileError);

        // The user's Supabase session is valid (they just authenticated), but the
        // profiles table is unreachable (cold Supabase, network blip).
        // If we have a cached profile for this user, use it — a DB timeout is not
        // an expired session. This applies to both session restores AND fresh logins.
        const cachedStr = localStorage.getItem(PROFILE_CACHE_KEY);
        if (cachedStr) {
          try {
            const cached: User = JSON.parse(cachedStr);
            if (cached?.id === user.id && cached?.role) {
              logger.auth('Profile query failed — using cached profile as fallback', user.id);
              isLoginInProgressRef.current = false;
              isAuthenticatedRef.current = true;
              setCurrentUser(cached);
              setIsOffline(false);
              setIsLoading(false);
              setSessionRestorePending(false);
              loadUserCompanies(user.id, cached.role).catch(() => {});
              setDataRefreshTick(t => t + 1); // JWT valid — refresh cold-start failed fetches
              return; // Stay/enter dashboard with cached profile
            }
          } catch { /* corrupt cache — fall through to signOut */ }
        }

        // No cache available → must show error and sign out
        showNotification('Error al cargar tu perfil. Por favor inicia sesión de nuevo.', 'error');
        setIsLoading(false);
        // Defer signOut to avoid recursive auth state change inside SIGNED_IN handler
        setTimeout(() => supabase.auth.signOut(), 100);
        return;
      } else if (!profileData.role) {
        logger.warn('Profile has no role in DB', user.id);
        showNotification('Tu perfil no tiene rol asignado. Contacta al administrador.', 'error');
        setIsLoading(false);
        setTimeout(() => supabase.auth.signOut(), 100);
        return;
      } else {
        logger.auth('Perfil cargado desde BD', user.id);
        userProfile = {
          id: profileData.id,
          name: profileData.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          role: profileData.role,
          email: profileData.email || user.email,
          warehouseId: profileData.warehouse_id || null,
          lastActive: new Date().toISOString()
        };

        if (userProfile.role !== 'Admin' && userProfile.role !== 'Manager' && !userProfile.warehouseId) {
          showNotification('Advertencia: No tienes almacén asignado. Contacta al administrador.', 'info');
        } else {
          showNotification(`Welcome ${userProfile.name}!`, 'success');
        }
      }

      // Admin 2FA: Require code verification if admin hasn't verified recently.
      // Stored in localStorage (not sessionStorage) so it survives PWA kills on mobile tablets.
      // Valid for 8 hours per user — cleared on explicit logout.
      // Skip 2FA on session restore — user already has a valid Supabase session.
      // 2FA is only required when explicitly signing in with credentials (isSessionRestore=false).
      const needsVerification = userProfile.role === 'Admin' && !isAdmin2FAVerified(user.id) && !isSessionRestore;

      if (needsVerification) {
        logger.auth('Admin detected - initiating 2FA verification', user.id);

        try {
          const res = await fetch('/api/send-admin-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, userId: user.id }),
          });

          if (res.ok) {
            setPendingAdminVerification({
              user: userProfile,
              email: user.email || '',
              userId: user.id,
            });
            setIsLoading(false);
            logger.auth('2FA code sent, awaiting verification', user.id);
            return;
          } else {
            const errorData = await res.json().catch(() => ({}));
            logger.error('Failed to send 2FA code', errorData);
            showNotification('⚠️ Código 2FA no pudo enviarse — accediendo solo con contraseña.', 'info');
            // Mark session as verified so page refreshes/restores don't trigger 2FA again
            setAdmin2FAVerified(user.id);
            // Fall through: allow login without 2FA when email service is unavailable
          }
        } catch (err) {
          logger.error('Error sending 2FA code', err);
          showNotification('⚠️ Error de red al enviar código — accediendo solo con contraseña.', 'info');
          // Mark session as verified so page refreshes/restores don't trigger 2FA again
          setAdmin2FAVerified(user.id);
          // Fall through: allow login without 2FA when email service is unavailable
        }
      }

      logger.auth('Estableciendo currentUser', user.id);
      isAuthenticatedRef.current = true;
      setCurrentUser(userProfile);
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(userProfile)); // persist for instant F5 restore
      setIsOffline(false); // connection restored — clear offline banner

      // Single session enforcement: sign out all other active sessions on explicit login
      if (!isSessionRestore && isSupabaseConfigured) {
        supabase.auth.signOut({ scope: 'others' }).catch(() => {});
      }

      await loadUserCompanies(user.id, userProfile.role);

      if (!isSessionRestore) {
        const defaultTab = getDefaultTabForRole(userProfile.role);
        setActiveTabRaw(defaultTab);
        sessionStorage.setItem('activeTab', defaultTab);
      }

      setIsLoading(false);
      logger.auth('Login completado', user.id, { name: userProfile.name, role: userProfile.role, isSessionRestore });

      if (isSupabaseConfigured) {
        supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'LOGIN',
          entity: 'User',
          entity_id: user.id,
          details: `Login: ${userProfile.name} (${userProfile.role})`
        }).then(() => {}, () => {});
      }
    } catch (error) {
      logger.error('Error crítico durante login', error);
      showNotification('Error de autenticación. Por favor inicia sesión de nuevo.', 'error');
      setIsLoading(false);
      setTimeout(() => supabase.auth.signOut(), 100);
    } finally {
      isLoginInProgressRef.current = false;
      setSessionRestorePending(false);
    }
  };

  // PASSWORD RECOVERY SCREEN
  if (isPasswordRecovery) {
    return (
      <ToastProvider>
        <PasswordResetForm onComplete={() => {
          setIsPasswordRecovery(false);
          showNotification('Password updated successfully', 'success');
        }} />
      </ToastProvider>
    );
  }

  // ADMIN 2FA VERIFICATION SCREEN
  // If admin is pending verification, show the code input screen
  if (pendingAdminVerification) {
    return (
      <ToastProvider>
        <AdminCodeVerification
          email={pendingAdminVerification.email}
          userId={pendingAdminVerification.userId}
          onVerified={async () => {
            // Verification successful - complete login
            logger.auth('Admin 2FA verified, completing login');
            isAuthenticatedRef.current = true;
            setAdmin2FAVerified(pendingAdminVerification.userId);
            setCurrentUser(pendingAdminVerification.user);
            // Load user's assigned companies (Admin has access to all)
            await loadUserCompanies(pendingAdminVerification.userId, pendingAdminVerification.user.role);
            setPendingAdminVerification(null);
            const adminDefaultTab = getDefaultTabForRole(pendingAdminVerification.user.role);
            setActiveTabRaw(adminDefaultTab);
            sessionStorage.setItem('activeTab', adminDefaultTab);
            showNotification(`Welcome ${pendingAdminVerification.user.name}!`, 'success');
          }}
          onCancel={() => {
            // Cancel verification - sign out and return to login
            logger.auth('Admin 2FA cancelled, signing out');
            setPendingAdminVerification(null);
            supabase.auth.signOut();
          }}
        />
      </ToastProvider>
    );
  }

  // LOADING STATE: Show spinner while checking session
  // This prevents flash of login screen on page refresh
  if ((isLoading || sessionRestorePending) && !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-400" />
        <span className="text-lg font-medium">Verificando sesion...</span>
      </div>
    );
  }

  // ROOT-LEVEL SESSION GUARD
  // If no user is present, render the Public Login Screen
  if (!currentUser) {
    return (
      <ToastProvider>
        <Login onLogin={handleLogin} />
      </ToastProvider>
    );
  }

  // Typed adapters so POS can consume the offline-aware salesHook without JSX generic cast issues
  const posSales = salesHook.sales as Sale[];
  const posCreateSale = salesHook.createSale as (sale: Sale, userId: string) => Promise<Sale>;

  // ✅ Simplified handlers - real logic handled by Supabase hooks in components
  const handleNewSale = () => {
    // Sales component uses useSales hook directly
    showNotification("Sale recorded successfully", "success");
  };

  const handleNewReturn = () => {
    // Returns component uses useReturns hook directly
    showNotification("Return processed successfully", "success");
  };

  // ⚠️ DEPRECATED: Payment handler moved to useSales hook (Supabase)
  // Kept commented for reference during migration
  /*
  const handleRegisterPayment = (saleId: string, payment: Payment) => {
      const sale = sales.find(s => s.id === saleId);
      if (!sale) {
        showNotification("Error: Sale not found", "error");
        return;
      }
      if (payment.amount <= 0) {
        showNotification("Error: Invalid payment amount", "error");
        return;
      }
      setSales(prev => prev.map(s => {
          if (s.id === saleId) {
              const newAmountPaid = (s.amountPaid || 0) + payment.amount;
              const remaining = s.totalAmount - newAmountPaid - (s.creditedAmount || 0);
              const newStatus = remaining <= 0.01 ? 'Paid' : 'Partial';
              logAction('PAYMENT', 'Sale', saleId, `Registered payment of ${payment.amount} for Sale #${saleId}`);
              return { ...s, amountPaid: newAmountPaid, paymentStatus: newStatus, payments: [...(s.payments || []), payment] };
          }
          return s;
      }));
      showNotification("Payment Registered", "success");
  };
  */

  // ✅ Simplified handlers - real logic handled by Supabase hooks in components
  const handleTransfer = () => {
    // Transfers component uses useTransfers hook directly
  };

  const handleAddProduct = () => {
    // Inventory component uses useProducts hook directly
  };

  const handleUpdateProduct = () => {
    // Inventory component uses useProducts hook directly
  };

  const handleDeleteProduct = () => {
    // Inventory component uses useProducts hook directly
  };

  const handleAddCustomer = () => {
    // Customers component uses useCustomers hook directly
  };

  const handleUpdateCustomer = () => {
    // Customers component uses useCustomers hook directly
  };

  const handleDeleteCustomer = () => {
    // Customers component uses useCustomers hook directly
  };

  const handleAddWarehouse = () => {
    // Warehouses component uses useWarehouses hook directly
  };

  const handleUpdateWarehouse = () => {
    // Warehouses component uses useWarehouses hook directly
  };

  const handleDeleteWarehouse = () => {
    // Warehouses component uses useWarehouses hook directly
  };
  
  // User handlers (re-enabled for localStorage mode)
  const handleAddUser = (u: User) => {
      setUsers(prev => [...prev, u]);
      logAction('CREATE', 'User', u.id, `Created user ${u.name}`);
      showNotification("User created", "success");
  };
  const handleUpdateUser = (u: User) => {
      setUsers(prev => prev.map(x => x.id === u.id ? u : x));
      if(currentUser && u.id === currentUser.id) setCurrentUser(u);
      logAction('UPDATE', 'User', u.id, `Created user ${u.name}`);
      showNotification("User updated", "success");
  };

  const handleDeleteUser = (id: string) => {
      if (id === currentUser?.id) {
          showNotification("Security Alert: You cannot delete your own account.", "error");
          return;
      }
      setUsers(prev => prev.filter(x => x.id !== id));
      logAction('DELETE', 'User', id, 'Deleted user account');
      showNotification("User deleted successfully", "success");
  };
  
  const handleUpdateSettings = (newSettings: CompanySettings) => {
      setCompanySettings(newSettings);
      logAction('UPDATE', 'Settings', 'COMPANY_INFO', 'Updated company details');
      // Update Zustand store so effectiveCompanySettings reflects new tierConfigs immediately
      if (storeActiveCompanyId) {
        storeUpdateCompanyProfile(storeActiveCompanyId, { settings: newSettings });
      }
      // Persist logo, signature and tier_configs to Supabase
      if (storeActiveCompanyId) {
        supabase
          .from('companies')
          .update({
            logo: newSettings.logoBase64 || null,
            signature: newSettings.signatureBase64 || null,
            tier_configs: newSettings.tierConfigs || null,
            volume_tiers: newSettings.volumeTiers || null,
            volume_discount_enabled: newSettings.volumeDiscountEnabled ?? false,
          })
          .eq('id', storeActiveCompanyId)
          .then(({ error }) => {
            if (error) logger.error('Failed to persist settings to Supabase', error);
          });
      }
      showNotification("Company settings updated", "success");
  }
  
  const handleRestoreBackup = async () => {
    try {
      // Create file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.gz';

      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) return;

        showNotification(t('backup_validating'), "info");

        const { validateBackup, restoreBackup } = await import('./services/backupService');
        const validation = await validateBackup(file);

        if (!validation.valid) {
          showNotification(validation.error || t('backup_invalid'), "error");
          return;
        }

        // Show backup info and ask for confirmation
        const info = validation.info;
        const confirmed = window.confirm(
          `${t('backup_info_title')}:\n\n` +
          `${t('backup_date')}: ${new Date(info.timestamp).toLocaleString()}\n` +
          `${t('backup_version')}: ${info.version}\n` +
          `${t('products')}: ${info.recordCount.products}\n` +
          `${t('sales')}: ${info.recordCount.sales}\n` +
          `${t('customers')}: ${info.recordCount.customers}\n` +
          `${t('warehouses')}: ${info.recordCount.warehouses}\n` +
          `${t('payments')}: ${info.recordCount.payments || 0}\n` +
          `Stock: ${info.recordCount.stock_levels || 0}\n\n` +
          `⚠️ ${t('backup_restore_warning')}\n\n` +
          `${t('backup_restore_confirm')}`
        );

        if (!confirmed) return;

        // Perform the restore
        showNotification(t('backup_restoring'), "info");
        const result = await restoreBackup(file);

        if (result.success) {
          const statsText = result.stats
            ? Object.entries(result.stats)
                .filter(([, count]) => (count as number) > 0)
                .map(([table, count]) => `${table}: ${count}`)
                .join(', ')
            : '';
          showNotification(
            `${t('backup_restored')}${statsText ? ` (${statsText})` : ''}`,
            "success"
          );
          // Reload to reflect restored data
          setTimeout(() => window.location.reload(), 2000);
        } else {
          showNotification(result.error || t('backup_failed'), "error");
        }
      };

      input.click();
    } catch (error: any) {
      console.error('Restore error:', error);
      showNotification(error.message || t('backup_failed'), "error");
    }
  };

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
            <Loader2 className="w-8 h-8 animate-spin mr-3" />
            <span className="text-lg">Loading ERP Data...</span>
        </div>
    );
  }

  const renderContent = () => {
    const permissions = ROUTE_PERMISSIONS[activeTab] || [];
    const content = (() => {
      switch (activeTab) {
        case 'dashboard': return <Dashboard products={products} sales={sales} transfers={transfers} currentUser={currentUser} warehouses={warehouses} customers={visibleCustomers} companySettings={effectiveCompanySettings} onUpdateSettings={handleUpdateSettings} />;
        case 'inventory': return <Inventory products={products} warehouses={warehouses} transfers={transfers} currentUser={currentUser ?? undefined} onAddProduct={handleAddProduct} onUpdateProduct={handleUpdateProduct} onDeleteProduct={handleDeleteProduct} onTransfer={handleTransfer} />;
        case 'transfers': return <Transfers transfers={transfers} products={products} warehouses={warehouses} currentUser={currentUser} onTransfer={handleTransfer} initialProductId={navPayload?.productId} initialSubTab={navPayload?.actionSubTab as any} onNavPayloadConsumed={() => setNavPayload(null)} />;
        case 'sales': return <Sales sales={visibleSales} products={products} warehouses={warehouses} customers={visibleCustomers} currentUser={currentUser} companySettings={effectiveCompanySettings} onNewSale={handleNewSale} onNewReturn={handleNewReturn} onUpdateSettings={handleUpdateSettings} />;
        case 'pos': return <POS products={products} warehouses={warehouses} customers={visibleCustomers} currentUser={currentUser} companySettings={effectiveCompanySettings} sales={posSales} onCreateSale={posCreateSale} onRefreshSales={salesHook.refresh} onNewSale={handleNewSale} pendingOfflineSales={salesHook.pendingOfflineSales} />;
        case 'customers': return <Customers customers={visibleCustomers} sales={visibleSales} products={products} currentUser={currentUser} onAddCustomer={handleAddCustomer} onUpdateCustomer={handleUpdateCustomer} onDeleteCustomer={handleDeleteCustomer} />;
        case 'returns': return <Returns returns={visibleReturns} sales={visibleSales} customers={visibleCustomers} warehouses={warehouses} />;
        case 'accounting': return <Accounting sales={sales} customers={customers} warehouses={warehouses} products={products} companySettings={effectiveCompanySettings} currentUser={currentUser} onRefresh={salesHook.refresh} charges={chargesHook.charges} onAddCharge={chargesHook.addCharge} onUpdateCharge={chargesHook.updateCharge} onDeleteCharge={chargesHook.deleteCharge} />;
        case 'treasury': return <Treasury sales={sales} customers={customers} currentUser={currentUser} />;
        case 'ai-assistant': return <AIAssistant variant="page" currentUser={currentUser} products={products} sales={sales} warehouses={warehouses} customers={customers} transfers={transfers} />;
        case 'users': return <UsersComp currentUser={currentUser} users={users} warehouses={warehouses} onAddUser={handleAddUser} onUpdateUser={handleUpdateUser} onDeleteUser={handleDeleteUser} />;
        case 'warehouses': return <Warehouses warehouses={warehouses} products={products} onAddWarehouse={handleAddWarehouse} onUpdateWarehouse={handleUpdateWarehouse} onDeleteWarehouse={handleDeleteWarehouse} />;
        case 'audit': return <AuditLog logs={auditLogs} />;
        case 'company-consumption': return <CompanyStockConsumption currentUser={currentUser} warehouses={warehouses} />;
        case 'suppliers': return <Suppliers />;
        case 'purchase-orders': return <PurchaseOrders products={products} warehouses={warehouses} />;
        case 'settings': return <Settings settings={companySettings} onSave={handleUpdateSettings} currentUser={currentUser} />;
        default: return <Dashboard products={products} sales={sales} transfers={transfers} currentUser={currentUser} warehouses={warehouses} customers={visibleCustomers} companySettings={effectiveCompanySettings} onUpdateSettings={handleUpdateSettings} />;
      }
    })();

    return (
      <ProtectedRoute allowedRoles={permissions} currentUser={currentUser} onNavigate={setActiveTab}>
        {content}
      </ProtectedRoute>
    );
  };

  return (
    <ToastProvider>
      <Layout
          activeTab={activeTab}
          onTabChange={setActiveTab}
          products={products}
          customers={customers}
          sales={sales}
          transfers={transfers}
          currentUser={currentUser}
          onLogout={handleLogout}
          onBackup={() => performBackup(false)}
          onRestore={handleRestoreBackup}
          notification={notification}
          onClearNotification={() => setNotification(null)}
          onRefreshData={handleRefreshData}
      >
        {/* Connection lost banner — shown when cached dashboard is displayed but Supabase is unreachable */}
        {isOffline && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-sm font-medium px-4 py-2 flex items-center justify-between shadow-lg">
            <span>⚠️ Sin conexión al servidor — mostrando datos en caché. Los cambios no se guardarán hasta restaurar la conexión.</span>
            <button
              onClick={() => { setIsOffline(false); window.location.reload(); }}
              className="ml-4 px-3 py-1 bg-white text-amber-700 rounded font-semibold hover:bg-amber-50 transition-colors text-xs"
            >
              Reintentar
            </button>
          </div>
        )}

        <Suspense fallback={<LoadingFallback />}>
          {renderContent()}
        </Suspense>

        {/* AI Assistant Widget Toggle Button - Arrastrable */}
        {!isAIWidgetOpen && (
          <button
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onClick={handleAIButtonClick}
            style={{
              left: aiButtonPosition.x,
              top: aiButtonPosition.y,
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            className="fixed bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl hover:shadow-blue-500/50 transition-shadow duration-300 z-40 group ring-4 ring-blue-400/30 select-none"
            title="AI Assistant (arrastrar para mover)"
            aria-label="Open AI Assistant"
          >
            <Sparkles className={`w-6 h-6 transition-transform ${isDragging ? '' : 'group-hover:rotate-12 group-hover:scale-110'}`} />
          </button>
        )}

        {/* AI Assistant Widget - Flotante */}
        {isAIWidgetOpen && (
          <Suspense fallback={<div className="fixed bottom-6 right-6 bg-white p-4 rounded-lg shadow-lg">Cargando...</div>}>
            <AIAssistant
              variant="widget"
              currentUser={currentUser}
              products={products}
              sales={sales}
              warehouses={warehouses}
              customers={customers}
              transfers={transfers}
              onClose={() => setIsAIWidgetOpen(false)}
            />
          </Suspense>
        )}
      </Layout>
    </ToastProvider>
  );
}

export default App;
