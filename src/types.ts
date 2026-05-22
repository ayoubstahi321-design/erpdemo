
export enum ProductCategory {
  MOTOR_OIL = 'Huile Moteur',
  TRANSMISSION = 'Transmission',
  GREASE = 'Graisses',
  HYDRAULIC = 'Hydraulique',
  BRAKE_FLUID = 'Liquide de Frein',
  ADDITIVE = 'Additifs'
}

export enum StockStatus {
  IN_STOCK = 'En Stock',
  LOW_STOCK = 'Stock Faible',
  OUT_OF_STOCK = 'Rupture de Stock'
}

// Sistema de 5 roles optimizado
export type UserRole = 'Admin' | 'Manager' | 'Accountant' | 'Sales' | 'Warehouse';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  warehouseId?: string | null; // Almacén asignado (null = Admin/Manager/Accountant con acceso a todos)
  companyId?: string | null; // Empresa asignada (null = Admin con acceso a todas las empresas)
  discountLimit?: number; // Límite de descuento permitido (Admin: 100, Manager: 15, Sales: 5, otros: 0)
  // Password removed: Auth is handled externally
  lastActive?: string;
}

// ─── Tier Pricing ────────────────────────────────────────────────────────────
export type PricingTier = number;

export interface TierConfig {
  tier: PricingTier;
  label: string;
  minPoints: number;
  maxPoints: number;   // use Infinity for the top tier
  marginFactor: number; // 0.00 = no discount, 1.00 = full margin passed to client
}
// ─────────────────────────────────────────────────────────────────────────────

// Monthly volume discount tier: customers who spent >= minAmount last month
// get discountPerBox DH off per box (or equivalent per unit) on their next order.
export interface VolumeTier {
    id: string;
    label: string;           // e.g. "Plata", "Oro", "VIP"
    minAmount: number;       // Minimum spend last month (DH TTC)
    discountPerBox: number;  // Fixed discount per box (DH)
}

export interface CompanySettings {
    name: string;
    address: string;
    city: string;
    country: string;
    phone: string;
    email: string;
    website: string;
    ice: string;
    rc: string;
    if: string;
    cnss: string;
    patente: string;
    capital: string;
    bankName: string;
    rib: string;
    defaultTaxRate: number; // Default TVA rate (e.g., 0.20 for 20%)
    currencySymbol?: string;  // Currency symbol shown on invoices & UI (e.g. "DH", "€", "$", "MAD")
    logoBase64?: string;      // Company logo as base64 data URI for PDF/Print
    signatureBase64?: string; // Company signature as base64 data URI for PDF/Print
    tierConfigs?: TierConfig[]; // Legacy — used by POS point-based system
    volumeTiers?: VolumeTier[]; // Monthly-spend volume discount tiers
    volumeDiscountEnabled?: boolean; // Master on/off switch for volume discount system
}

// Company Profile: Multiple company configurations for invoicing
export interface CompanyProfile {
    id: string;
    profileName: string; // User-friendly label like "AZMOL Morocco" or "AZMOL Export"
    settings: CompanySettings;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  type: 'Central' | 'Branch' | 'Transit';
}

// N:M relationship between warehouses and companies (multi-tenant support)
export interface WarehouseCompany {
  id: string;
  warehouseId: string;
  companyId: string;
  createdAt: string;
}

// N:M relationship between users and companies (multi-tenant support)
// Users can be assigned to multiple companies
export interface UserCompany {
  id: string;
  userId: string;
  companyId: string;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode?: string; // EAN-13 or UPC
  name: string;
  category: ProductCategory;
  viscosity?: string;
  packSize: number; // Tamaño del producto (e.g., 1.5L, 5L, 400g)
  unit: string;     // Unidad de medida (e.g., 'L', 'ml', 'kg', 'g', 'ton', 'pcs')
  unitsPerBox?: number; // Unidades por caja (e.g., 12 botellas por caja). Default: 1
  price: number;      // Selling Price TTC (with TVA included) — general public price
  vipPrice?: number;  // VIP catalogue price TTC (Niveau 1 reference). NULL = tier pricing not active for this product
  points?: number;    // Volume points per unit for tier calculation (e.g. 1 = box, 10 = 204L barrel, 0.25 = small pack). Default: 1
  cost: number;       // Purchase cost HT
  supplierId?: string;  // Default supplier ID (references suppliers.id)
  supplierRef?: string; // Supplier's own product reference/code (for ordering)
  customTaxRate?: number; // Optional custom TVA rate (e.g., 0.07 for 7%, overrides default)
  stockLevels: Record<string, number>; // WarehouseID -> Quantity
  minStock: number;
  lastRestock: string;
}

export interface Customer {
  id: string;
  type: 'Individual' | 'Professional';
  name: string; // Contact name for Individual, Company name for Professional
  contactPerson?: string; // Only for Professional
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  // Professional specific fields (Morocco)
  ice?: string; // Identifiant Commun de l'Entreprise
  taxId?: string; // Patente / Identifiant Fiscal
  // Credit management
  creditLimit?: number; // Maximum unpaid balance allowed (MAD). 0 = no limit
  notes?: string; // Internal notes about the customer
  // GPS location for delivery route management
  latitude?: number | null;
  longitude?: number | null;
  // Multi-tenant support
  companyId?: string | null; // Company this customer belongs to. NULL for legacy/shared customers.
  // Sales rep ownership
  assignedTo?: string | null; // auth.users.id of the Sales rep who owns this customer. NULL = visible to all roles.
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number; // Cantidad en el modo seleccionado (unidades o cajas)
  unit?: string;           // Unidad de medida ('pcs', 'kg', 'L', etc.)
  sellingMode?: 'box' | 'unit'; // Modo de venta: por caja o por unidad suelta
  stockDelta?: number;     // Unidades individuales a descontar del stock (negativo)
  unitPrice: number; // IMPORTANTE: Precio unitario TTC (con IVA incluido)
  discount: number; // Valor del descuento (porcentaje 0-100 o monto fijo en MAD)
  discountType?: 'percentage' | 'fixed'; // Tipo de descuento: porcentaje o fijo (MAD). Default: percentage
  total: number; // Total TTC de la línea (después del descuento)
  // Modo de venta flexible (unidad o caja)
  sellMode?: 'unit' | 'box'; // 'unit' = venta por unidad, 'box' = venta por caja. Default: unit
  unitsPerBox?: number; // Unidades por caja (copiado del producto para cálculos). Default: 1
  isGift?: boolean; // Línea ofrecida gratuitamente (OFFERT) — precio 0, stock se descuenta
}

export type PaymentMethod = 'Cash' | 'Check' | 'Bank Transfer' | 'Traite' | 'Credit Card';
export type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid';

// Sale source types
export type SaleSource = 'POS' | 'B2B';
export type DocumentType = 'TICKET' | 'INVOICE' | 'DELIVERY_NOTE' | 'QUOTE';

export type CheckPaymentStatus = 'Pending' | 'Cashed' | 'Bounced';

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference?: string; // General reference (bank ref, transaction ID, etc.)
  checkNumber?: string; // Specific check/traite number
  bankName?: string; // Bank name for Check, Traite, Bank Transfer
  dueDate?: string; // Maturity date for checks/traites (ISO date string)
  paymentStatus?: CheckPaymentStatus; // Status for deferred payments (Check, Traite)
  recordedBy: string;
}

export interface Sale {
  id: string;
  invoiceNumber?: string; // Sequential invoice number (e.g., "FAC-2026-00001")
  deliveryNoteNumber?: string; // Sequential delivery note number (e.g., "BL-2026-00001")
  date: string;
  warehouseId: string; // The warehouse fulfilling the order
  customerId: string;
  customerName: string;
  customerType: 'Individual' | 'Professional';
  items: SaleItem[]; // Items con precios TTC

  // Sale metadata
  source: SaleSource; // Origin of sale: POS (fast) or B2B (detailed)
  documentType: DocumentType; // Type of document: TICKET, INVOICE, or DELIVERY_NOTE
  isFastSale?: boolean; // True for quick POS sales, false for detailed B2B orders

  // Global discount (optional)
  globalDiscountType?: 'percentage' | 'fixed'; // Percentage or fixed amount
  globalDiscountValue?: number; // Value: 5 (%) or 100 (DH)
  globalDiscountAmount?: number; // Calculated discount amount

  // Financial breakdown — prices entered TTC, stored HT after extraction
  itemsSubtotal: number; // TTC sum of lines after individual discounts, before global discount
  subtotalAmount: number; // HT base (totalHT after global discount proportional split — NOT TTC)
  taxRate: number; // TVA rate as decimal (0.20 = 20%)
  taxAmount: number; // TVA extracted from TTC (subtotalAmount × taxRate)
  totalAmount: number; // TTC final = subtotalAmount + taxAmount

  // Treasury
  amountPaid: number;
  paymentStatus: PaymentStatus;
  payments: Payment[];
  creditedAmount: number; // Value of returned items (Credit Note)

  // Return tracking (Shopify/Odoo style)
  returnStatus?: 'partial' | 'full' | null; // null = no returns, 'partial' = partial return, 'full' = fully returned

  // Multi-tenant support
  companyId?: string | null; // Company/tenant ID - User selects company when creating sale. NULL for Admin/legacy data.

  status: 'Completed' | 'Pending' | 'Cancelled';
}

export type TransferType = 'INTERNAL' | 'IMPORT' | 'ADJUSTMENT';

export interface Transfer {
  id: string;
  date: string;
  type: TransferType; // Default is INTERNAL if undefined
  fromWarehouseId?: string; // Optional for IMPORT/ADJUSTMENT
  toWarehouseId: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;        // stored in units (drives stock trigger)
    boxesEntered?: number | null;  // null = historical data stored as raw cajas
    looseEntered?: number | null;
  }[];
  status: 'Completed' | 'Pending';
  reference: string; // Container ID or Transfer Ref
  reason?: string; // For Adjustments
  companyId?: string | null; // Company/tenant ID - Transfers occur within same company only
}

export interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
}

export interface Return {
  id: string;
  date: string;
  originalSaleId: string;
  customerId: string;
  customerName: string;
  items: ReturnItem[];
  reason: string;
  warehouseId: string; // Warehouse where stock is returned
  companyId?: string | null; // Company/tenant ID - Inherited from original sale
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'SALE' | 'TRANSFER' | 'PAYMENT' | 'LOGIN' | 'RETURN' | 'ADJUSTMENT';
export type AuditEntity = 'Product' | 'Customer' | 'User' | 'Warehouse' | 'Sale' | 'Transfer' | 'Return' | 'Settings';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  details: string; // Descriptive text of what changed
}

// --- DASHBOARD CONFIGURATION TYPES ---
export type DashboardWidgetType =
  | 'kpi_revenue'
  | 'kpi_profit'
  | 'kpi_receivables'
  | 'kpi_orders'
  | 'kpi_inventory_value'
  | 'kpi_low_stock'
  | 'chart_finance'
  | 'chart_cashflow'
  | 'chart_monthly_sales'
  | 'chart_pos_vs_b2b'
  | 'chart_top_products'
  | 'list_payment_alerts'
  | 'list_low_stock'
  | 'list_recent_transfers'
  | 'list_top_products'
  | 'list_debtor_customers'
  | 'list_warehouse_alerts'
  | 'list_daily_sales'
  | 'list_warehouse_margin'
  | 'list_profit_by_commercial';

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  w: number; // Width (col-span)
}

export interface DashboardConfig {
  userId: string;
  layout: DashboardWidget[];
}

export interface CustomerPrice {
  id: string;
  customerId: string;
  productId: string;
  specialPrice?: number;
  discountPercentage?: number;
  notes?: string;
}

export type SupplierStatus = 'Active' | 'Inactive';

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  ice?: string;
  taxId?: string;
  status: SupplierStatus;
  notes?: string;
}

export type PurchaseOrderStatus = 'Draft' | 'Sent' | 'Received' | 'Cancelled';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  supplierId: string;
  supplierName: string;
  warehouseId: string;
  date: string;
  expectedDate?: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  totalAmount: number;
  notes?: string;
}

// ─── Charges / Dépenses ───────────────────────────────────────────────────────
export type ChargePaymentMethod = 'Cash' | 'Virement' | 'Chèque';

export const CHARGE_CATEGORIES = [
  'Loyer / Location',
  'Salaires & Charges sociales',
  'Électricité & Eau',
  'Transport & Carburant',
  'Téléphone & Internet',
  'Entretien & Réparations',
  'Assurances',
  'Publicité & Marketing',
  'Frais bancaires',
  'Impôts & Taxes',
  'Achats marchandises',
  'Autres charges',
] as const;

export interface Charge {
  id: string;
  date: string;
  category: string;
  description: string;
  amountHT: number;
  taxRate: number;       // 0 or 0.20
  amountTTC: number;
  paymentMethod: ChargePaymentMethod;
  reference?: string;
  supplierId?: string;
  createdBy?: string;
  companyId?: string;
  createdAt?: string;
}
// ─────────────────────────────────────────────────────────────────────────────
