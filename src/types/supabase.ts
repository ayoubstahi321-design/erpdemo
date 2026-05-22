/**
 * Supabase Type Definitions and Converters
 *
 * This module handles bidirectional type conversion between:
 * - Database schema (snake_case, normalized tables)
 * - Application types (camelCase, denormalized objects)
 *
 * Special handling for stockLevels:
 * - App: Record<warehouseId, quantity>
 * - DB: Separate stock_levels table with foreign keys
 */

import {
  User,
  UserRole,
  Warehouse,
  WarehouseCompany,
  Product,
  ProductCategory,
  Customer,
  Sale,
  SaleItem,
  PaymentMethod,
  PaymentStatus,
  Payment,
  Transfer,
  TransferType,
  Return,
  ReturnItem,
  AuditLogEntry,
  AuditAction,
  AuditEntity,
  CompanySettings,
} from '../types'; // Adjusted the path to match the correct location
// ==================== DATABASE TYPES ====================

/**
 * profiles table (extends Supabase Auth users)
 * SCHEMA ACTUALIZADO: id, name, role, warehouse_id, discount_limit, created_at, updated_at
 * email viene de auth.users (JOIN requerido)
 */
export interface DbProfile {
  id: string;
  name: string;
  role: UserRole;
  warehouse_id?: string | null;
  discount_limit?: number;
  created_at: string;
  updated_at: string;
}

/**
 * warehouses table
 */
export interface DbWarehouse {
  id: string;
  name: string;
  location: string;
  type: 'Central' | 'Branch' | 'Transit';
  created_at: string;
  updated_at: string;
}

/**
 * warehouse_companies table (N:M junction table for multi-tenancy)
 */
export interface DbWarehouseCompany {
  id: string;
  warehouse_id: string;
  company_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * customers table
 */
export interface DbCustomer {
  id: string;
  type: 'Individual' | 'Professional';
  name: string;
  contact_person?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  ice?: string;
  tax_id?: string;
  created_at: string;
  updated_at: string;
}

/**
 * products table (without stock_levels)
 */
export interface DbProduct {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  category: ProductCategory;
  viscosity?: string;
  pack_size: number;
  unit: string;
  price: number;
  cost: number;
  min_stock: number;
  last_restock: string;
  created_at: string;
  updated_at: string;
}

/**
 * stock_levels table (normalized, separate from products)
 */
export interface DbStockLevel {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

/**
 * sales table
 */
export interface DbSale {
  id: string;
  date: string;
  warehouse_id: string;
  customer_id: string;
  customer_name: string;
  customer_type: 'Individual' | 'Professional';
  source?: 'POS' | 'B2B';
  document_type?: 'INVOICE' | 'DELIVERY_NOTE' | 'TICKET';
  items_subtotal?: number; // Items subtotal before discounts
  subtotal_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  payment_status: PaymentStatus;
  credited_amount: number;
  return_status?: 'partial' | 'full' | null; // Return tracking
  status: 'Completed' | 'Pending' | 'Cancelled';
  company_id?: string | null; // Multi-tenant: Company ID selected by user at sale time
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * sale_items table
 */
export interface DbSaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  created_at: string;
}

/**
 * payments table
 */
export interface DbPayment {
  id: string;
  sale_id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  recorded_by: string;
  created_at: string;
}

/**
 * transfers table
 */
export interface DbTransfer {
  id: string;
  date: string;
  type: TransferType;
  from_warehouse_id?: string;
  to_warehouse_id: string;
  status: 'Completed' | 'Pending';
  reference: string;
  reason?: string;
  company_id?: string | null; // Multi-tenant: Transfers occur within same company only
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * transfer_items table
 */
export interface DbTransferItem {
  id: string;
  transfer_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  created_at: string;
}

/**
 * returns table
 */
export interface DbReturn {
  id: string;
  date: string;
  original_sale_id: string;
  customer_id: string;
  customer_name: string;
  warehouse_id: string;
  reason: string;
  company_id?: string | null; // Multi-tenant: Inherited from original sale
  created_by: string;
  created_at: string;
}

/**
 * return_items table
 */
export interface DbReturnItem {
  id: string;
  return_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  created_at: string;
}

/**
 * audit_logs table
 */
export interface DbAuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  action: AuditAction;
  entity: AuditEntity;
  entity_id: string;
  details: string;
  created_at: string;
}

// ==================== TYPE CONVERTERS ====================

// --- User/Profile Converters ---

export function toUser(db: DbProfile, email?: string): User {
  return {
    id: db.id,
    name: db.name,
    role: db.role,
    email: email || '', // Email debe venir de auth.users como parámetro
    warehouseId: db.warehouse_id || null,
    discountLimit: db.discount_limit ?? undefined,
    lastActive: undefined,
  };
}

export function fromUser(user: User): Partial<DbProfile> {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    warehouse_id: user.warehouseId || null,
    discount_limit: user.discountLimit ?? undefined,
    // email NO se guarda en profiles (solo en auth.users)
  };
}

// --- Warehouse Converters ---

export function toWarehouse(db: DbWarehouse): Warehouse {
  return {
    id: db.id,
    name: db.name,
    location: db.location,
    type: db.type,
  };
}

export function fromWarehouse(warehouse: Warehouse): Partial<DbWarehouse> {
  return {
    id: warehouse.id,
    name: warehouse.name,
    location: warehouse.location,
    type: warehouse.type,
  };
}

// --- Warehouse Company Converters ---

export function toWarehouseCompany(db: DbWarehouseCompany): WarehouseCompany {
  return {
    id: db.id,
    warehouseId: db.warehouse_id,
    companyId: db.company_id,
    createdAt: db.created_at,
  };
}

export function fromWarehouseCompany(wc: WarehouseCompany): Partial<DbWarehouseCompany> {
  return {
    id: wc.id,
    warehouse_id: wc.warehouseId,
    company_id: wc.companyId,
  };
}

// --- Customer Converters ---

export function toCustomer(db: DbCustomer): Customer {
  return {
    id: db.id,
    type: db.type,
    name: db.name,
    contactPerson: db.contact_person,
    email: db.email,
    phone: db.phone,
    address: db.address,
    city: db.city,
    ice: db.ice,
    taxId: db.tax_id,
  };
}

export function fromCustomer(customer: Customer): Partial<DbCustomer> {
  return {
    id: customer.id,
    type: customer.type,
    name: customer.name,
    contact_person: customer.contactPerson,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    city: customer.city,
    ice: customer.ice,
    tax_id: customer.taxId,
  };
}

// --- Product Converters (with stockLevels transformation) ---

/**
 * Convert DB product + stock_levels array to App product with stockLevels object
 */
export function toProduct(db: DbProduct, stockLevels: DbStockLevel[] = []): Product {
  return {
    id: db.id,
    sku: db.sku,
    barcode: db.barcode,
    name: db.name,
    category: db.category,
    viscosity: db.viscosity,
    packSize: db.pack_size,
    unit: db.unit,
    price: db.price,
    cost: db.cost,
    stockLevels: stockLevels.reduce((acc, sl) => ({
      ...acc,
      [sl.warehouse_id]: sl.quantity,
    }), {} as Record<string, number>),
    minStock: db.min_stock,
    lastRestock: db.last_restock,
  };
}

/**
 * Convert App product to DB product (without stockLevels)
 */
export function fromProduct(product: Product): Partial<DbProduct> {
  return {
    id: product.id,
    sku: product.sku,
    barcode: product.barcode,
    name: product.name,
    category: product.category,
    viscosity: product.viscosity,
    pack_size: product.packSize,
    unit: product.unit,
    price: product.price,
    cost: product.cost,
    min_stock: product.minStock,
    last_restock: product.lastRestock,
  };
}

/**
 * Convert App stockLevels object to DB stock_levels array
 */
export function fromStockLevels(
  productId: string,
  stockLevels: Record<string, number>
): Omit<DbStockLevel, 'id' | 'created_at' | 'updated_at'>[] {
  return Object.entries(stockLevels).map(([warehouseId, quantity]) => ({
    product_id: productId,
    warehouse_id: warehouseId,
    quantity,
  }));
}

// --- Sale Converters ---

export function toSale(
  db: DbSale,
  items: DbSaleItem[] = [],
  payments: DbPayment[] = []
): Sale {
  return {
    id: db.id,
    date: db.date,
    warehouseId: db.warehouse_id,
    customerId: db.customer_id,
    customerName: db.customer_name,
    customerType: db.customer_type,
    source: db.source || 'B2B',
    documentType: db.document_type || 'INVOICE',
    items: items.map(toSaleItem),
    itemsSubtotal: db.items_subtotal || db.subtotal_amount, // Suma de líneas TTC
    subtotalAmount: db.subtotal_amount,
    taxRate: db.tax_rate,
    taxAmount: db.tax_amount,
    totalAmount: db.total_amount,
    amountPaid: db.amount_paid,
    paymentStatus: db.payment_status,
    payments: payments.map(toPayment),
    creditedAmount: db.credited_amount,
    returnStatus: db.return_status,
    status: db.status,
    companyId: db.company_id || null,
  };
}

export function fromSale(sale: Sale, userId: string): Partial<DbSale> {
  return {
    id: sale.id,
    date: sale.date,
    warehouse_id: sale.warehouseId,
    customer_id: sale.customerId,
    customer_name: sale.customerName,
    customer_type: sale.customerType,
    subtotal_amount: sale.subtotalAmount,
    tax_rate: sale.taxRate,
    tax_amount: sale.taxAmount,
    total_amount: sale.totalAmount,
    amount_paid: sale.amountPaid,
    payment_status: sale.paymentStatus,
    credited_amount: sale.creditedAmount,
    status: sale.status,
    company_id: sale.companyId || null,
    created_by: userId,
  };
}

export function toSaleItem(db: DbSaleItem): SaleItem {
  return {
    productId: db.product_id,
    productName: db.product_name,
    quantity: db.quantity,
    unitPrice: db.unit_price,
    discount: db.discount,
    total: db.total,
  };
}

export function fromSaleItem(item: SaleItem, saleId: string): Omit<DbSaleItem, 'id' | 'created_at'> {
  return {
    sale_id: saleId,
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    discount: item.discount,
    total: item.total,
  };
}

// --- Payment Converters ---

export function toPayment(db: DbPayment): Payment {
  return {
    id: db.id,
    date: db.date,
    amount: db.amount,
    method: db.method,
    reference: db.reference,
    recordedBy: db.recorded_by,
  };
}

export function fromPayment(payment: Payment, saleId: string): Omit<DbPayment, 'id' | 'created_at'> {
  return {
    sale_id: saleId,
    date: payment.date,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    recorded_by: payment.recordedBy,
  };
}

// --- Transfer Converters ---

export function toTransfer(db: DbTransfer, items: DbTransferItem[] = []): Transfer {
  return {
    id: db.id,
    date: db.date,
    type: db.type,
    fromWarehouseId: db.from_warehouse_id,
    toWarehouseId: db.to_warehouse_id,
    items: items.map(item => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
    })),
    status: db.status,
    reference: db.reference,
    reason: db.reason,
    companyId: db.company_id || null,
  };
}

export function fromTransfer(transfer: Transfer, userId: string): Partial<DbTransfer> {
  return {
    id: transfer.id,
    date: transfer.date,
    type: transfer.type,
    from_warehouse_id: transfer.fromWarehouseId,
    to_warehouse_id: transfer.toWarehouseId,
    status: transfer.status,
    reference: transfer.reference,
    reason: transfer.reason,
    company_id: transfer.companyId || null,
    created_by: userId,
  };
}

export function fromTransferItem(
  item: { productId: string; productName: string; quantity: number },
  transferId: string
): Omit<DbTransferItem, 'id' | 'created_at'> {
  return {
    transfer_id: transferId,
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
  };
}

// --- Return Converters ---

export function toReturn(db: DbReturn, items: DbReturnItem[] = []): Return {
  return {
    id: db.id,
    date: db.date,
    originalSaleId: db.original_sale_id,
    customerId: db.customer_id,
    customerName: db.customer_name,
    items: items.map(item => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
    })),
    reason: db.reason,
    warehouseId: db.warehouse_id,
    companyId: db.company_id || null,
  };
}

export function fromReturn(returnData: Return, userId: string): Partial<DbReturn> {
  return {
    id: returnData.id,
    date: returnData.date,
    original_sale_id: returnData.originalSaleId,
    customer_id: returnData.customerId,
    customer_name: returnData.customerName,
    warehouse_id: returnData.warehouseId,
    reason: returnData.reason,
    company_id: returnData.companyId || null,
    created_by: userId,
  };
}

export function fromReturnItem(
  item: ReturnItem,
  returnId: string
): Omit<DbReturnItem, 'id' | 'created_at'> {
  return {
    return_id: returnId,
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
  };
}

// --- Audit Log Converters ---

export function toAuditLog(db: DbAuditLog, userMap: Map<string, User>): AuditLogEntry {
  const user = userMap.get(db.user_id);
  return {
    id: db.id,
    timestamp: db.timestamp,
    userId: db.user_id,
    userName: user?.name || 'Unknown',
    userRole: user?.role || 'Sales',
    action: db.action,
    entity: db.entity,
    entityId: db.entity_id,
    details: db.details,
  };
}

export function fromAuditLog(entry: AuditLogEntry): Partial<DbAuditLog> {
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    user_id: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId,
    details: entry.details,
  };
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate total stock from stockLevels object
 */
export function calculateTotalStock(stockLevels: Record<string, number>): number {
  return Object.values(stockLevels).reduce((sum, qty) => sum + qty, 0);
}

/**
 * Check if product has low stock in any warehouse
 */
export function hasLowStock(product: Product): boolean {
  const totalStock = calculateTotalStock(product.stockLevels);
  return totalStock < product.minStock;
}

/**
 * Get warehouses with stock for a product
 */
export function getWarehousesWithStock(product: Product): string[] {
  return Object.entries(product.stockLevels)
    .filter(([_, qty]) => qty > 0)
    .map(([warehouseId]) => warehouseId);
}
