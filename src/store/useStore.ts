/**
 * Zustand Store - SOLO para Company Profiles (Multi-Company Support)
 *
 * El resto de datos (products, customers, sales, etc.) se maneja con:
 * - Supabase hooks (useProducts, useCustomers, useSales, etc.)
 * - Estado local en App.tsx (currentUser, settings, etc.)
 *
 * Este store se mantiene ÚNICAMENTE para gestionar perfiles de empresa
 * que necesitan persistirse en localStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CompanyProfile, CompanySettings } from '../types';

const defaultSettings: CompanySettings = {
  name: 'Azmol Petrochemicals',
  address: '123 Avenue Mohammed V',
  city: 'Casablanca',
  country: 'Morocco',
  phone: '+212 5XX-XXXXXX',
  email: 'contact@azmol.ma',
  website: 'www.azmol.ma',
  ice: '000000000000000',
  rc: 'RC XXXXXX',
  if: 'IF XXXXXX',
  cnss: 'CNSS XXXXXX',
  patente: 'PATENTE XXXXXX',
  capital: '1,000,000 MAD',
  bankName: 'Attijariwafa Bank',
  rib: 'XXXXXXXXXXXXXXXXXXXXXXXX',
  defaultTaxRate: 0.20,
  currencySymbol: 'DH',
};

/**
 * Read activeCompanyId synchronously from localStorage before the store is
 * created so that the very first React render already has the correct value.
 *
 * Zustand's persist middleware uses createJSONStorage which wraps localStorage
 * in Promise.resolve(), making rehydration asynchronous. Without this sync
 * read the store starts with activeCompanyId=null on the first render, then
 * updates to the persisted UUID in a later microtask — causing usePaginatedSales
 * to re-fetch with the company filter and (if the UUID is stale) return empty.
 */
const getSavedState = (): { activeCompanyId: string | null; userAssignedCompanyIds: string[] } => {
  try {
    const raw = localStorage.getItem('azmol-company-profiles');
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        activeCompanyId: (parsed?.state?.activeCompanyId as string) ?? null,
        userAssignedCompanyIds: (parsed?.state?.userAssignedCompanyIds as string[]) ?? [],
      };
    }
  } catch { /* ignore parse errors */ }
  return { activeCompanyId: null, userAssignedCompanyIds: [] };
};

const savedState = getSavedState();

interface CompanyProfilesState {
  // Company Profiles (Multi-Company Support)
  companyProfiles: CompanyProfile[];
  activeCompanyId: string | null;

  // User's assigned company IDs (from user_companies table)
  userAssignedCompanyIds: string[];

  // Actions
  setCompanyProfiles: (profiles: CompanyProfile[]) => void;
  addCompanyProfile: (profile: CompanyProfile) => void;
  updateCompanyProfile: (profileId: string, updates: Partial<CompanyProfile>) => void;
  deleteCompanyProfile: (profileId: string) => void;
  setActiveCompany: (profileId: string | null) => void;
  setUserAssignedCompanyIds: (ids: string[]) => void;
}

export const useStore = create<CompanyProfilesState>()(
  persist(
    (set, get) => ({
      // Initial State — seeded synchronously from localStorage so the first
      // render already has the correct values (no async hydration re-render).
      companyProfiles: [],
      activeCompanyId: savedState.activeCompanyId,
      userAssignedCompanyIds: savedState.userAssignedCompanyIds,

      // Company Profiles Actions
      setCompanyProfiles: (profiles) => set({ companyProfiles: profiles }),

      addCompanyProfile: (profile) => set((state) => ({
        companyProfiles: [...state.companyProfiles, profile]
      })),

      updateCompanyProfile: (profileId, updates) => set((state) => ({
        companyProfiles: state.companyProfiles.map(p =>
          p.id === profileId ? { ...p, ...updates } : p
        )
      })),

      deleteCompanyProfile: (profileId) => set((state) => {
        const newProfiles = state.companyProfiles.filter(p => p.id !== profileId);
        // If deleting active profile, switch to first available or null
        const newActiveId = state.activeCompanyId === profileId
          ? (newProfiles.length > 0 ? newProfiles[0].id : null)
          : state.activeCompanyId;

        return {
          companyProfiles: newProfiles,
          activeCompanyId: newActiveId
        };
      }),

      setActiveCompany: (profileId) => set({
        activeCompanyId: profileId
      }),

      setUserAssignedCompanyIds: (ids) => set({
        userAssignedCompanyIds: ids
      })
    }),
    {
      name: 'azmol-company-profiles',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        companyProfiles: state.companyProfiles,
        activeCompanyId: state.activeCompanyId,          // Admin's company selection survives F5
        userAssignedCompanyIds: state.userAssignedCompanyIds, // correct role dropdown from first render
      })
    }
  )
);
