
import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Package, ShoppingCart, Bot, Menu, Bell, Search, Droplet, ArrowRightLeft, Users, AlertTriangle, ChevronUp, UserCircle2, LogOut, Save, RotateCcw, X, CheckCircle, Info, Globe, Building, Building2, ScrollText, Undo2, Settings, Download, Calculator, Store, Wallet, Banknote, AlertOctagon, Truck, CheckCheck, ClipboardList, BarChart2, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Product, Customer, Sale, Transfer, User } from '../types';
import { useLanguage } from '../services/i18n';
import { Logo } from './Logo';
import GlobalSearch from './GlobalSearch';
import { useNotifications, NotificationType } from '../hooks/useNotifications';
import { logger } from '../utils/logger';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { OfflineBanner } from './OfflineBanner';
import { FEATURES } from '../config/features';
import { useStore } from '../store/useStore';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const bgColors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <AlertTriangle className="w-5 h-5 text-rose-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  return (
    <div className={`fixed bottom-4 right-4 z-100 flex items-center p-4 rounded-lg border shadow-lg max-w-sm animate-in slide-in-from-right-5 fade-in duration-300 ${bgColors[type]}`}>
      <div className="me-3">{icons[type]}</div>
      <div className="text-sm font-medium me-4">{message}</div>
      <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export interface TabNavPayload {
  productId?: string;
  actionSubTab?: string;
  saleId?: string;
  customerId?: string;
}

interface NavItemProps {
  id: string;
  icon: any;
  label: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCloseSidebar: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ id, icon: Icon, label, activeTab, onTabChange, onCloseSidebar }) => (
  <button
    type="button"
    onClick={() => {
      onTabChange(id);
      onCloseSidebar();
    }}
    className={`flex items-center w-full px-4 py-3 mb-1 text-sm font-medium transition-all duration-200 rounded-lg group relative ${
      activeTab === id
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 transform scale-[1.02]'
        : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
    }`}
  >
    {activeTab === id && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
    )}
    <Icon className={`w-5 h-5 me-3 ${activeTab === id ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'}`} />
    <span className="font-semibold">{label}</span>
  </button>
);

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string, payload?: TabNavPayload) => void;
  products?: Product[];
  customers?: Customer[];
  sales?: Sale[];
  transfers?: Transfer[];
  currentUser: User;
  onLogout: () => void;
  onBackup?: () => void;
  onRestore?: () => void;
  notification?: { message: string; type: 'success' | 'error' | 'info' } | null;
  onClearNotification?: () => void;
  onRefreshData?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  products = [],
  customers = [],
  sales = [],
  transfers = [],
  currentUser,
  onLogout,
  onBackup,
  onRestore,
  notification,
  onClearNotification,
  onRefreshData
}) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineBanner, setShowOfflineBanner] = useState(!navigator.onLine);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = React.useState(false);
  
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const { t, language, setLanguage, dir } = useLanguage();

  // Company selector state from store
  const { companyProfiles, activeCompanyId, setActiveCompany, userAssignedCompanyIds } = useStore();

  // Filter profiles to only show user's assigned companies (unless Admin or Manager)
  const availableCompanies = ['Admin', 'Manager'].includes(currentUser.role)
    ? companyProfiles
    : companyProfiles.filter(cp => userAssignedCompanyIds.includes(cp.id));

  // Show selector if user has at least one company configured
  const showCompanySelector = availableCompanies.length >= 1;

  const { notifications: alerts, unreadCount, dismissed, markAsRead, markAllAsRead } = useNotifications({ products, sales, transfers });

  // Global search shortcut (Ctrl+K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Handle PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBanner(false);
      logger.info('[Network] Connection restored - refreshing data...');
      // Auto-refresh data when connection is restored
      if (onRefreshData) {
        setIsRefreshing(true);
        Promise.resolve(onRefreshData()).finally(() => setIsRefreshing(false));
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBanner(true);
      logger.warn('[Network] Connection lost - working offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onRefreshData]);

  const handleManualRefresh = async () => {
    if (!isOnline || isRefreshing) return;
    setIsRefreshing(true);
    if (onRefreshData) await Promise.resolve(onRefreshData());
    setIsRefreshing(false);
  };

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          logger.info('User accepted the install prompt');
        }
        setDeferredPrompt(null);
      });
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItemProps = { activeTab, onTabChange, onCloseSidebar: () => setSidebarOpen(false) };

  const getRoleColor = (role: string) => {
      switch(role) {
          case 'Admin': return 'bg-indigo-100 text-indigo-700';
          case 'Manager': return 'bg-violet-100 text-violet-700';
          case 'Sales': return 'bg-emerald-100 text-emerald-700';
          case 'Cashier': return 'bg-cyan-100 text-cyan-700';
          case 'Delivery': return 'bg-amber-100 text-amber-700';
          default: return 'bg-slate-100 text-slate-700';
      }
  };

  const isRole = (roles: string[]) => roles.includes(currentUser.role);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden" dir={dir}>
      {/* Offline Banner - shown when disconnected */}
      {FEATURES.OFFLINE_MODE && <OfflineBanner position="top" />}

      {notification && onClearNotification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={onClearNotification}
        />
      )}

      {/* Offline Banner */}
      {showOfflineBanner && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white text-center text-sm font-semibold py-2 flex items-center justify-center gap-2 shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span>Sin conexión a internet — los cambios no se guardarán en el servidor</span>
          <button onClick={() => setShowOfflineBanner(false)} className="ml-4 opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:relative lg:inset-0 ${
          sidebarOpen ? 'translate-x-0' : (dir === 'rtl' ? 'translate-x-full' : '-translate-x-full')
        } flex flex-col`}
      >
        <div className="flex items-center justify-center h-20 border-b border-slate-100 bg-white shrink-0 px-4">
          <Logo className="h-10 w-auto" showSubtitle={false} />
        </div>

        <nav className="p-4 mt-4 space-y-2 flex-1 overflow-y-auto">
          <NavItem id="dashboard" icon={LayoutDashboard} label={t('dashboard')} {...navItemProps} />
          
          {isRole(['Admin', 'Manager', 'Sales']) && (
            <NavItem id="pos" icon={Store} label={t('pos')} {...navItemProps} />
          )}

          {isRole(['Admin', 'Manager', 'Sales']) && (
            <NavItem id="inventory" icon={Package} label={t('inventory')} {...navItemProps} />
          )}

          {isRole(['Admin', 'Manager', 'Warehouse']) && (
            <NavItem id="transfers" icon={ArrowRightLeft} label={t('transfers')} {...navItemProps} />
          )}

          {isRole(['Admin', 'Manager', 'Sales']) && (
             <NavItem id="customers" icon={Users} label={t('customers')} {...navItemProps} />
          )}

          {isRole(['Admin', 'Manager', 'Sales']) && (
             <NavItem id="sales" icon={ShoppingCart} label={t('sales')} {...navItemProps} />
          )}

          {isRole(['Admin', 'Manager', 'Sales']) && (
             <NavItem id="returns" icon={Undo2} label={t('returns')} {...navItemProps} />
          )}
          
          {/* Treasury — visible to Accountant outside the Admin+Manager block */}
          {isRole(['Accountant']) && (
            <>
              <div className="my-2 border-t border-slate-100"></div>
              <NavItem id="treasury" icon={Wallet} label={t('treasury')} {...navItemProps} />
            </>
          )}

          {/* Admin & Manager Shared Modules */}
          {isRole(['Admin', 'Manager']) && (
              <>
                <div className="my-2 border-t border-slate-100"></div>

                {/* Accounting Tab */}
                <NavItem id="accounting" icon={Calculator} label={t('accounting')} {...navItemProps} />

                {/* Treasury */}
                <NavItem id="treasury" icon={Wallet} label={t('treasury')} {...navItemProps} />

                {/* Users only for Admin */}
                {isRole(['Admin']) && <NavItem id="users" icon={UserCircle2} label={t('users')} {...navItemProps} />}
                
                <NavItem id="warehouses" icon={Building} label={t('warehouses')} {...navItemProps} />
                <NavItem id="company-consumption" icon={BarChart2} label={t('company_consumption')} {...navItemProps} />
                {/* Suppliers & Purchase Orders hidden - not applicable to this business model */}
                <NavItem id="audit" icon={ScrollText} label={t('audit_log')} {...navItemProps} />
                
                {/* Settings for Admin only */}
                {isRole(['Admin']) && <NavItem id="settings" icon={Settings} label={t('settings')} {...navItemProps} />}
              </>
          )}
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-secondary-200 shrink-0 bg-gradient-secondary relative" ref={userMenuRef}>
            <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center w-full p-2 rounded-lg hover:bg-secondary-200 transition-all duration-200 hover:shadow-soft"
                aria-expanded={userMenuOpen}
                aria-label="User menu"
                aria-haspopup="true"
            >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${getRoleColor(currentUser.role)} shadow-soft`}>
                    {currentUser.name.charAt(0)}{currentUser.name.split(' ')[1]?.charAt(0)}
                </div>
                <div className="text-start ms-3 flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary-700 truncate">{currentUser.name}</p>
                    <p className="text-xs text-secondary-500 truncate">{currentUser.role}</p>
                    <p className="text-[9px] text-secondary-400">v2.4</p>
                </div>
                <ChevronUp className={`w-4 h-4 text-secondary-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>

            {/* Logout Dropdown */}
            {userMenuOpen && (
                <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                    {/* INSTALL APP BUTTON */}
                    {deferredPrompt && (
                        <button
                            onClick={() => {
                                handleInstallClick();
                                setUserMenuOpen(false);
                            }}
                            className="w-full text-start px-4 py-3 hover:bg-slate-50 text-blue-600 flex items-center space-x-3 transition-colors border-b border-slate-100 font-medium"
                        >
                            <Download className="w-4 h-4 me-3" />
                            <span className="text-sm">{t('install_app')}</span>
                        </button>
                    )}

                    {onBackup && (
                      <button
                          onClick={() => {
                            onBackup();
                            setUserMenuOpen(false);
                          }}
                          className="w-full text-start px-4 py-3 hover:bg-slate-50 text-slate-700 flex items-center space-x-3 transition-colors border-b border-slate-100"
                      >
                          <Save className="w-4 h-4 text-blue-500 me-3" />
                          <span className="text-sm font-medium">{t('backup_create')}</span>
                      </button>
                    )}
                    {onRestore && currentUser.role === 'Admin' && (
                      <button
                          onClick={() => {
                            onRestore();
                            setUserMenuOpen(false);
                          }}
                          className="w-full text-start px-4 py-3 hover:bg-slate-50 text-slate-700 flex items-center space-x-3 transition-colors border-b border-slate-100"
                      >
                          <RotateCcw className="w-4 h-4 text-amber-500 me-3" />
                          <span className="text-sm font-medium">{t('backup_restore')}</span>
                      </button>
                    )}
                    <button
                        onClick={onLogout}
                        className="w-full text-start px-4 py-3 hover:bg-rose-50 text-rose-600 flex items-center space-x-3 transition-colors"
                    >
                        <LogOut className="w-4 h-4 me-3" />
                        <span className="text-sm font-medium">{t('logout')}</span>
                    </button>
                </div>
            )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white border-b border-secondary-200 flex items-center justify-between px-4 lg:px-8 z-20 relative shadow-soft">
          <button
            className="lg:hidden p-2 text-secondary-500 hover:bg-secondary-100 rounded-lg transition-all duration-200 hover:shadow-soft"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 max-w-lg mx-auto hidden lg:block px-4">
            <button
              onClick={() => setShowGlobalSearch(true)}
              className="flex items-center w-full ps-3 pe-3 py-2 border border-secondary-200 rounded-lg bg-secondary-50 text-secondary-400 hover:border-primary-400 hover:text-secondary-600 sm:text-sm transition-all duration-200 shadow-soft cursor-pointer"
            >
              <Search className="h-4 w-4 me-2 shrink-0" />
              <span className="flex-1 text-start">{t('search_placeholder')}</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 text-xs font-mono text-secondary-400 bg-white rounded border border-secondary-200">Ctrl+K</kbd>
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 relative" ref={notificationRef}>
            {/* Connection Status Indicator */}
            <button
              onClick={handleManualRefresh}
              title={isOnline ? 'Conectado — clic para actualizar datos' : 'Sin conexión a internet'}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold transition-all ${
                isOnline
                  ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 cursor-pointer'
                  : 'text-amber-600 bg-amber-50 cursor-default'
              }`}
            >
              {isRefreshing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : isOnline ? (
                <Wifi className="w-3.5 h-3.5" />
              ) : (
                <WifiOff className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{isOnline ? (isRefreshing ? 'Actualizando...' : 'Online') : 'Offline'}</span>
            </button>

            {/* Company Selector - only visible if user has multiple companies */}
            {showCompanySelector && (
              <div className="flex items-center bg-indigo-50 border border-indigo-200 rounded-lg px-2 shadow-soft">
                <Building2 className="w-4 h-4 text-indigo-500 me-1 hidden sm:block" />
                <select
                  value={activeCompanyId || ''}
                  onChange={(e) => { if (e.target.value) setActiveCompany(e.target.value); }}
                  className="bg-transparent border-none text-xs sm:text-sm font-medium text-indigo-700 focus:ring-0 p-1 cursor-pointer transition-colors duration-200 max-w-[120px] sm:max-w-[180px] truncate"
                >
                  {!activeCompanyId && (
                    <option value="" disabled>— Seleccionar empresa —</option>
                  )}
                  {availableCompanies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.profileName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Language Selector */}
            <div className="flex items-center bg-secondary-100 rounded-lg px-1.5 sm:px-2 shadow-soft">
                <Globe className="w-4 h-4 text-secondary-500 me-1 hidden sm:block" />
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="bg-transparent border-none text-xs sm:text-sm font-medium text-secondary-700 focus:ring-0 p-1 cursor-pointer transition-colors duration-200"
                >
                    <option value="fr">FR</option>
                    <option value="es">ES</option>
                    <option value="en">EN</option>
                    <option value="ar">AR</option>
                </select>
            </div>

            <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={`relative p-2 transition-all duration-200 rounded-full hover:shadow-soft ${notificationsOpen ? 'bg-primary-100 text-primary-600 shadow-soft' : 'text-secondary-400 hover:text-secondary-500 hover:bg-secondary-100'}`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>

            {/* Notification Dropdown */}
            {notificationsOpen && (
                <div className="absolute top-12 end-0 w-[calc(100vw-2rem)] sm:w-96 max-w-md bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-900 text-sm">{t('notifications')}</h3>
                        <div className="flex items-center gap-2">
                          {unreadCount > 0 && (
                            <button onClick={markAllAsRead} className="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">
                              <CheckCheck className="w-3 h-3" /> {t('mark_all_read')}
                            </button>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${unreadCount > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>{unreadCount}</span>
                        </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {alerts.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 flex flex-col items-center">
                                <Bell className="w-8 h-8 mb-2 opacity-20" />
                                <p className="text-xs">{t('all_caught_up')}</p>
                            </div>
                        ) : (
                            <div>
                                {alerts.map(n => {
                                    const isRead = dismissed.includes(n.id);
                                    const iconMap: Record<NotificationType, { bg: string; icon: React.ReactNode }> = {
                                      low_stock: { bg: 'bg-amber-100', icon: <AlertTriangle className="w-4 h-4 text-amber-600" /> },
                                      overdue_payment: { bg: 'bg-rose-100', icon: <Banknote className="w-4 h-4 text-rose-600" /> },
                                      bounced_check: { bg: 'bg-red-100', icon: <AlertOctagon className="w-4 h-4 text-red-600" /> },
                                      pending_transfer: { bg: 'bg-blue-100', icon: <Truck className="w-4 h-4 text-blue-600" /> },
                                    };
                                    const labelMap: Record<NotificationType, string> = {
                                      low_stock: t('low_stock_alert'),
                                      overdue_payment: t('overdue_payment'),
                                      bounced_check: t('bounced_check'),
                                      pending_transfer: t('pending_transfer'),
                                    };
                                    const { bg, icon } = iconMap[n.type];
                                    return (
                                      <div
                                        key={n.id}
                                        className="p-3 border-b border-slate-50 hover:bg-blue-50 transition-colors cursor-pointer group"
                                        onClick={() => {
                                            markAsRead(n.id);
                                            onTabChange(n.tab, {
                                              productId: n.productId,
                                              actionSubTab: n.actionSubTab,
                                              saleId: n.saleId,
                                              customerId: n.customerId,
                                            });
                                            setNotificationsOpen(false);
                                        }}
                                      >
                                        <div className="flex items-start">
                                            <div className={`${bg} p-2 rounded-lg me-3 shrink-0 group-hover:opacity-80 transition-colors`}>
                                                {icon}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{labelMap[n.type]}</p>
                                                <p className="text-sm font-bold text-slate-800 truncate">{n.title}</p>
                                                <p className="text-xs text-slate-500 mt-0.5 truncate">{n.description}</p>
                                            </div>
                                        </div>
                                      </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 relative bg-gradient-secondary">
            {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
            className="fixed inset-0 z-40 bg-secondary-900 bg-opacity-50 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Global Search Modal */}
      {showGlobalSearch && (
        <GlobalSearch
          products={products}
          customers={customers}
          sales={sales}
          onNavigate={onTabChange}
          onClose={() => setShowGlobalSearch(false)}
        />
      )}
    </div>
  );
};
