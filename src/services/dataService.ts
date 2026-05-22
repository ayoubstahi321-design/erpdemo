
import { Product, Sale, Warehouse, Transfer, Customer, User, AuditLogEntry, Return, CompanySettings } from '../types';
import { logger } from '../utils/logger';

export const KEYS = {
  PRODUCTS: 'azmol_products',
  SALES: 'azmol_sales',
  WAREHOUSES: 'azmol_warehouses',
  CUSTOMERS: 'azmol_customers',
  USERS: 'azmol_users',
  TRANSFERS: 'azmol_transfers',
  RETURNS: 'azmol_returns',
  BACKUP: 'azmol_backup_snapshot',
  AUDIT_LOGS: 'azmol_audit_logs',
  DASHBOARD_CONFIG: 'azmol_dashboard_config',
  SETTINGS: 'azmol_company_settings'
};

export interface BackupData {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  users: User[];
  transfers: Transfer[];
  warehouses: Warehouse[];
  auditLogs: AuditLogEntry[];
  returns: Return[];
  settings?: CompanySettings;
}

export interface BackupSnapshot {
  timestamp: string;
  data: BackupData;
}

// --- DATA SERVICE ---
// Uses localStorage for client-side storage and Supabase for server persistence

export const dataService = {
  KEYS,

  // Load ALL data from server (Supabase integration handled in App.tsx)
  loadAllFromServer: (): Promise<any> => {
    return new Promise((resolve) => {
      // Supabase data loading is handled directly in components
      resolve({});
    });
  },

  load: <T>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (e) {
      logger.error(`Error loading ${key} from storage`, e);
      return fallback;
    }
  },

  save: (key: string, data: any) => {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(key, serialized);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        logger.error("Local Storage is full! Cannot save data.");
      } else {
        logger.error(`Error saving ${key} to storage`, e);
      }
    }
  },

  // Backup/Restore remains a localStorage feature for now (Client-side snapshot)
  createBackup: (data: BackupData): { success: boolean, timestamp: string, error?: string } => {
    try {
      const snapshot: BackupSnapshot = {
        timestamp: new Date().toISOString(),
        data
      };
      localStorage.setItem(KEYS.BACKUP, JSON.stringify(snapshot));
      logger.info('Backup created successfully', { timestamp: snapshot.timestamp });
      return { success: true, timestamp: snapshot.timestamp };
    } catch (e: any) {
      logger.error('Error creating backup', e);
      if (e.name === 'QuotaExceededError' || e.code === 22) {
          return { success: false, timestamp: '', error: 'Storage full. Please clear old data.' };
      }
      return { success: false, timestamp: '', error: 'Backup failed.' };
    }
  },

  restoreBackup: (): BackupSnapshot | null => {
    try {
      const item = localStorage.getItem(KEYS.BACKUP);
      if (!item) return null;

      const snapshot = JSON.parse(item);
      if (!snapshot.timestamp || !snapshot.data) return null;
      return snapshot;
    } catch (e) {
      logger.error('Error restoring backup', e);
      return null;
    }
  },

  hasBackup: (): boolean => {
    return !!localStorage.getItem(KEYS.BACKUP);
  },
  
  clearAll: () => {
    localStorage.clear();
  }
};
