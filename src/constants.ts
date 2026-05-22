
import { Product, ProductCategory, Sale, StockStatus, Warehouse, Transfer, Customer, User } from './types';

export const APP_NAME = "Stoqly ERP";
export const CURRENCY = "MAD";

// DEMO COMPANY DATA FOR DOCUMENTS
export const COMPANY_INFO = {
    name: "DEMO COMPANY SARL",
    address: "123 Bd. Mohammed V, Zone Industrielle",
    city: "Casablanca, 20250",
    country: "Maroc",
    phone: "+212 522 99 88 77",
    email: "contact@democompany.ma",
    website: "www.stoqly.com",
    // Legal IDs
    ice: "001524367000088",
    rc: "123456",
    if: "9876543",
    cnss: "1234567",
    patente: "342516",
    capital: "100.000 DHS",
    bankName: "Attijariwafa Bank",
    rib: "007 780 0000 123456789012 99",
    // Default tax rate for Morocco (TVA standard 20%)
    defaultTaxRate: 0.20,
    // Company logo as base64 for PDF/Print (configurable from Settings)
    logoBase64: undefined,
};

export const INITIAL_USERS: User[] = [];

export const INITIAL_WAREHOUSES: Warehouse[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_SALES: Sale[] = [];

export const INITIAL_TRANSFERS: Transfer[] = [];

export const getStatusColor = (status: StockStatus) => {
  switch (status) {
    case StockStatus.IN_STOCK: return 'bg-emerald-100 text-emerald-800';
    case StockStatus.LOW_STOCK: return 'bg-amber-100 text-amber-800';
    case StockStatus.OUT_OF_STOCK: return 'bg-rose-100 text-rose-800';
  }
};
