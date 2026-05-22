/**
 * Supabase Service Layer
 *
 * Complete CRUD abstraction for all entities with:
 * - Type-safe operations
 * - Automatic type conversion (DB ↔ App)
 * - Error handling
 * - RLS enforcement
 *
 * Usage:
 *   const warehouses = await supabaseService.warehouses.getAll();
 *   await supabaseService.products.updateStock(productId, warehouseId, delta, reason);
 */

import { supabase } from './supabaseClient';
import {
  User,
  Warehouse,
  Customer,
  Product,
  Sale,
  Payment,
  Transfer,
  Return,
  AuditLogEntry,
  CompanySettings,
} from '../types';
import {
  DbProfile,
  DbWarehouse,
  DbCustomer,
  DbProduct,
  DbStockLevel,
  DbSale,
  DbSaleItem,
  DbPayment,
  DbTransfer,
  DbTransferItem,
  DbReturn,
  DbReturnItem,
  DbAuditLog,
  toUser,
  fromUser,
  toWarehouse,
  fromWarehouse,
  toCustomer,
  fromCustomer,
  toProduct,
  fromProduct,
  fromStockLevels,
  toSale,
  fromSale,
  fromSaleItem,
  toPayment,
  fromPayment,
  toTransfer,
  fromTransfer,
  fromTransferItem,
  toReturn,
  fromReturn,
  fromReturnItem,
  toAuditLog,
  fromAuditLog,
} from '../types/supabase';
import { FEATURE_FLAGS } from '../config/features';

// Debug logging helper
const logDebug = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Supabase]', ...args);
  }
};

const logMigrationWarning = (message: string) => {
  console.warn('[Migration]', message);
};

// ==================== ERROR HANDLING ====================

export class SupabaseError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'SupabaseError';
  }
}

function handleError(error: any, operation: string): never {
  logDebug(`Supabase error in ${operation}:`, error);
  throw new SupabaseError(`Failed to ${operation}: ${error.message}`, error);
}

// ==================== WAREHOUSE SERVICE ====================

export const warehouseService = {
  async getAll(): Promise<Warehouse[]> {
    if (!FEATURE_FLAGS.USE_SUPABASE_WAREHOUSES) {
      logMigrationWarning('Warehouse service called but Supabase is disabled');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('name');

      if (error) throw error;
      return data.map(toWarehouse);
    } catch (error) {
      return handleError(error, 'fetch warehouses');
    }
  },

  async getById(id: string): Promise<Warehouse | null> {
    if (!FEATURE_FLAGS.USE_SUPABASE_WAREHOUSES) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? toWarehouse(data) : null;
    } catch (error) {
      return handleError(error, 'fetch warehouse');
    }
  },

  async create(warehouse: Omit<Warehouse, 'id'>): Promise<Warehouse> {
    if (!FEATURE_FLAGS.USE_SUPABASE_WAREHOUSES) {
      throw new SupabaseError('Warehouse creation disabled - Supabase not enabled');
    }

    try {
      const { data, error } = await supabase
        .from('warehouses')
        .insert({
          name: warehouse.name,
          location: warehouse.location,
          type: warehouse.type,
        })
        .select()
        .single();

      if (error) throw error;
      logDebug('Warehouse created:', data);
      return toWarehouse(data);
    } catch (error) {
      return handleError(error, 'create warehouse');
    }
  },

  async update(id: string, updates: Partial<Warehouse>): Promise<Warehouse> {
    if (!FEATURE_FLAGS.USE_SUPABASE_WAREHOUSES) {
      throw new SupabaseError('Warehouse update disabled');
    }

    try {
      const dbUpdates: Partial<DbWarehouse> = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.location) dbUpdates.location = updates.location;
      if (updates.type) dbUpdates.type = updates.type;

      const { data, error } = await supabase
        .from('warehouses')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      logDebug('Warehouse updated:', data);
      return toWarehouse(data);
    } catch (error) {
      return handleError(error, 'update warehouse');
    }
  },

  async delete(id: string): Promise<void> {
    if (!FEATURE_FLAGS.USE_SUPABASE_WAREHOUSES) {
      throw new SupabaseError('Warehouse deletion disabled');
    }

    try {
      // Check if warehouse has stock
      const { data: stockCheck } = await supabase
        .from('stock_levels')
        .select('quantity')
        .eq('warehouse_id', id)
        .gt('quantity', 0)
        .limit(1);

      if (stockCheck && stockCheck.length > 0) {
        throw new SupabaseError('Cannot delete warehouse with stock');
      }

      const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      logDebug('Warehouse deleted:', id);
    } catch (error) {
      return handleError(error, 'delete warehouse');
    }
  },
};

// ==================== CUSTOMER SERVICE ====================

export const customerService = {
  async getAll(): Promise<Customer[]> {
    if (!FEATURE_FLAGS.USE_SUPABASE_CUSTOMERS) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      if (error) throw error;
      return data.map(toCustomer);
    } catch (error) {
      return handleError(error, 'fetch customers');
    }
  },

  async getById(id: string): Promise<Customer | null> {
    if (!FEATURE_FLAGS.USE_SUPABASE_CUSTOMERS) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? toCustomer(data) : null;
    } catch (error) {
      return handleError(error, 'fetch customer');
    }
  },

  async create(customer: Omit<Customer, 'id'>): Promise<Customer> {
    if (!FEATURE_FLAGS.USE_SUPABASE_CUSTOMERS) {
      throw new SupabaseError('Customer creation disabled');
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert(fromCustomer({ ...customer, id: '' }))
        .select()
        .single();

      if (error) throw error;
      return toCustomer(data);
    } catch (error) {
      return handleError(error, 'create customer');
    }
  },

  async update(id: string, updates: Partial<Customer>): Promise<Customer> {
    if (!FEATURE_FLAGS.USE_SUPABASE_CUSTOMERS) {
      throw new SupabaseError('Customer update disabled');
    }

    try {
      const customerUpdate = { 
        ...updates, 
        id,
        name: updates.name || 'Cliente',
        type: updates.type || 'Individual' as const
      };
      const { data, error } = await supabase
        .from('customers')
        .update(fromCustomer(customerUpdate))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return toCustomer(data);
    } catch (error) {
      return handleError(error, 'update customer');
    }
  },

  async delete(id: string): Promise<void> {
    if (!FEATURE_FLAGS.USE_SUPABASE_CUSTOMERS) {
      throw new SupabaseError('Customer deletion disabled');
    }

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      return handleError(error, 'delete customer');
    }
  },
};

// ==================== USER/PROFILE SERVICE ====================

export const userService = {
  async getAll(): Promise<User[]> {
    if (!FEATURE_FLAGS.USE_SUPABASE_USERS) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, email:id(email)')
        .order('name');

      if (error) throw error;
      return data.map(profile => toUser(profile, profile.email?.[0]?.email));
    } catch (error) {
      return handleError(error, 'fetch users');
    }
  },

  async getById(id: string): Promise<User | null> {
    if (!FEATURE_FLAGS.USE_SUPABASE_USERS) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, email:id(email)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? toUser(data, data.email?.[0]?.email) : null;
    } catch (error) {
      return handleError(error, 'fetch user');
    }
  },

  async updateProfile(id: string, updates: Partial<User>): Promise<User> {
    if (!FEATURE_FLAGS.USE_SUPABASE_USERS) {
      throw new SupabaseError('User update disabled');
    }

    try {
      const userUpdate = {
        ...updates,
        id,
        email: updates.email || '',
        name: updates.name || 'Usuario',
        role: updates.role || 'Sales' as const
      };
      const { data, error } = await supabase
        .from('profiles')
        .update(fromUser(userUpdate))
        .eq('id', id)
        .select('*, email:id(email)')
        .single();

      if (error) throw error;
      return toUser(data, data.email?.[0]?.email || updates.email);
    } catch (error) {
      return handleError(error, 'update user');
    }
  },

  async updateLastActive(userId: string): Promise<void> {
    if (!FEATURE_FLAGS.USE_SUPABASE_USERS) {
      return;
    }

    try {
      // Schema NO tiene last_active - skip silently
      // await supabase
      //   .from('profiles')
      //   .update({ last_active: new Date().toISOString() })
      //   .eq('id', userId);
      logDebug('last_active field not in schema - skipping update');
    } catch (error) {
      // Don't throw on last active update failures
      logDebug('Failed to update last active:', error);
    }
  },
};

// ==================== PRODUCT SERVICE ====================

export const productService = {
  /**
   * Get all products with their stock levels
   */
  async getAllWithStock(): Promise<Product[]> {
    if (!FEATURE_FLAGS.USE_SUPABASE_PRODUCTS) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, stock_levels(*)')
        .order('name');

      if (error) throw error;

      return data.map((p: any) => toProduct(p, p.stock_levels || []));
    } catch (error) {
      return handleError(error, 'fetch products');
    }
  },

  async getById(id: string): Promise<Product | null> {
    if (!FEATURE_FLAGS.USE_SUPABASE_PRODUCTS) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, stock_levels(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? toProduct(data, data.stock_levels || []) : null;
    } catch (error) {
      return handleError(error, 'fetch product');
    }
  },

  async create(product: Omit<Product, 'id'>): Promise<Product> {
    if (!FEATURE_FLAGS.USE_SUPABASE_PRODUCTS) {
      throw new SupabaseError('Product creation disabled');
    }

    try {
      // Create product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert(fromProduct({ ...product, id: '' }))
        .select()
        .single();

      if (productError) throw productError;

      // Create stock levels
      const stockLevelInserts = fromStockLevels(productData.id, product.stockLevels);
      if (stockLevelInserts.length > 0) {
        const { error: stockError } = await supabase
          .from('stock_levels')
          .insert(stockLevelInserts);

        if (stockError) throw stockError;
      }

      // Return product with stock levels
      return await this.getById(productData.id) as Product;
    } catch (error) {
      return handleError(error, 'create product');
    }
  },

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    if (!FEATURE_FLAGS.USE_SUPABASE_PRODUCTS) {
      throw new SupabaseError('Product update disabled');
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .update(fromProduct({ ...updates, id, stockLevels: {} } as Product))
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // If stockLevels updated, handle separately
      if (updates.stockLevels) {
        // Delete existing stock levels
        await supabase.from('stock_levels').delete().eq('product_id', id);

        // Insert new stock levels
        const stockLevelInserts = fromStockLevels(id, updates.stockLevels);
        if (stockLevelInserts.length > 0) {
          await supabase.from('stock_levels').insert(stockLevelInserts);
        }
      }

      return await this.getById(id) as Product;
    } catch (error) {
      return handleError(error, 'update product');
    }
  },

  async delete(id: string): Promise<void> {
    if (!FEATURE_FLAGS.USE_SUPABASE_PRODUCTS) {
      throw new SupabaseError('Product deletion disabled');
    }

    try {
      // Check if product has been sold
      const { data: saleCheck } = await supabase
        .from('sale_items')
        .select('id')
        .eq('product_id', id)
        .limit(1);

      if (saleCheck && saleCheck.length > 0) {
        throw new SupabaseError('Cannot delete product with sales history');
      }

      // Delete stock levels (cascade should handle this, but explicit is safer)
      await supabase.from('stock_levels').delete().eq('product_id', id);

      // Delete product
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      return handleError(error, 'delete product');
    }
  },

  /**
   * Update stock atomically using database function
   * @param productId Product ID
   * @param warehouseId Warehouse ID
   * @param delta Change in quantity (positive for increase, negative for decrease)
   * @param reason Reason for stock change
   */
  async updateStock(
    productId: string,
    warehouseId: string,
    delta: number,
    reason: string,
    userId: string
  ): Promise<void> {
    if (!FEATURE_FLAGS.USE_SUPABASE_STOCK_LEVELS) {
      throw new SupabaseError('Stock update disabled');
    }

    try {
      const { data, error } = await supabase.rpc('update_stock_level', {
        p_product_id: productId,
        p_warehouse_id: warehouseId,
        p_delta: delta,
        p_reason: reason,
        p_user_id: userId,
      });

      if (error) throw error;
      logDebug('Stock updated:', { productId, warehouseId, delta, reason });
    } catch (error) {
      return handleError(error, 'update stock');
    }
  },
};

// ==================== SALE SERVICE ====================

export const saleService = {
  async getAll(): Promise<Sale[]> {
    if (!FEATURE_FLAGS.USE_SUPABASE_SALES) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*), payments(*)')
        .order('date', { ascending: false });

      if (error) throw error;

      return data.map((s: any) => toSale(s, s.sale_items || [], s.payments || []));
    } catch (error) {
      return handleError(error, 'fetch sales');
    }
  },

  async getById(id: string): Promise<Sale | null> {
    if (!FEATURE_FLAGS.USE_SUPABASE_SALES) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, sale_items(*), payments(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? toSale(data, data.sale_items || [], data.payments || []) : null;
    } catch (error) {
      return handleError(error, 'fetch sale');
    }
  },

  /**
   * Create sale using Edge Function for transactional integrity
   * Edge Function handles: sale creation, items insert, stock reduction, audit log
   */
  async create(sale: Omit<Sale, 'id'>, userId: string): Promise<Sale> {
    if (!FEATURE_FLAGS.USE_SUPABASE_SALES) {
      throw new SupabaseError('Sale creation disabled');
    }

    try {
      // Call Edge Function (to be created in Phase 3)
      const { data, error } = await supabase.functions.invoke('create-sale', {
        body: { sale: { ...sale, userId } },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.sale;
    } catch (error) {
      return handleError(error, 'create sale');
    }
  },

  async registerPayment(saleId: string, payment: Omit<Payment, 'id'>, userId: string): Promise<void> {
    if (!FEATURE_FLAGS.USE_SUPABASE_PAYMENTS) {
      throw new SupabaseError('Payment registration disabled');
    }

    try {
      // Insert payment
      const { error: paymentError } = await supabase
        .from('payments')
        .insert(fromPayment({ ...payment, id: '' }, saleId));

      if (paymentError) throw paymentError;

      // Update sale amount_paid and payment_status
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('amount_paid, total_amount')
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      const newAmountPaid = sale.amount_paid + payment.amount;
      const paymentStatus =
        newAmountPaid >= sale.total_amount
          ? 'Paid'
          : newAmountPaid > 0
          ? 'Partial'
          : 'Unpaid';

      const { error: updateError } = await supabase
        .from('sales')
        .update({
          amount_paid: newAmountPaid,
          payment_status: paymentStatus,
        })
        .eq('id', saleId);

      if (updateError) throw updateError;
    } catch (error) {
      return handleError(error, 'register payment');
    }
  },
};

// ==================== TRANSFER SERVICE ====================

export const transferService = {
  async getAll(): Promise<Transfer[]> {
    if (!FEATURE_FLAGS.USE_SUPABASE_TRANSFERS) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('transfers')
        .select('*, transfer_items(*)')
        .order('date', { ascending: false });

      if (error) throw error;

      return data.map((t: any) => toTransfer(t, t.transfer_items || []));
    } catch (error) {
      return handleError(error, 'fetch transfers');
    }
  },

  async create(transfer: Omit<Transfer, 'id'>, userId: string): Promise<Transfer> {
    if (!FEATURE_FLAGS.USE_SUPABASE_TRANSFERS) {
      throw new SupabaseError('Transfer creation disabled');
    }

    try {
      // Will use Edge Function in Phase 4 for transactional integrity
      // For now, manual transaction
      const { data: transferData, error: transferError } = await supabase
        .from('transfers')
        .insert(fromTransfer({ ...transfer, id: '' }, userId))
        .select()
        .single();

      if (transferError) throw transferError;

      // Insert items
      const items = transfer.items.map(item => fromTransferItem(item, transferData.id));
      const { error: itemsError } = await supabase
        .from('transfer_items')
        .insert(items);

      if (itemsError) throw itemsError;

      return await this.getById(transferData.id) as Transfer;
    } catch (error) {
      return handleError(error, 'create transfer');
    }
  },

  async getById(id: string): Promise<Transfer | null> {
    if (!FEATURE_FLAGS.USE_SUPABASE_TRANSFERS) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('transfers')
        .select('*, transfer_items(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? toTransfer(data, data.transfer_items || []) : null;
    } catch (error) {
      return handleError(error, 'fetch transfer');
    }
  },
};

// ==================== RETURN SERVICE ====================

export const returnService = {
  async getAll(): Promise<Return[]> {
    if (!FEATURE_FLAGS.USE_SUPABASE_RETURNS) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('returns')
        .select('*, return_items(*)')
        .order('date', { ascending: false });

      if (error) throw error;

      return data.map((r: any) => toReturn(r, r.return_items || []));
    } catch (error) {
      return handleError(error, 'fetch returns');
    }
  },

  async create(returnData: Omit<Return, 'id'>, userId: string): Promise<Return> {
    if (!FEATURE_FLAGS.USE_SUPABASE_RETURNS) {
      throw new SupabaseError('Return creation disabled');
    }

    try {
      // Will use Edge Function in Phase 4
      const { data: returnRecord, error: returnError } = await supabase
        .from('returns')
        .insert(fromReturn({ ...returnData, id: '' }, userId))
        .select()
        .single();

      if (returnError) throw returnError;

      // Insert items
      const items = returnData.items.map(item => fromReturnItem(item, returnRecord.id));
      const { error: itemsError } = await supabase
        .from('return_items')
        .insert(items);

      if (itemsError) throw itemsError;

      return await this.getById(returnRecord.id) as Return;
    } catch (error) {
      return handleError(error, 'create return');
    }
  },

  async getById(id: string): Promise<Return | null> {
    if (!FEATURE_FLAGS.USE_SUPABASE_RETURNS) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('returns')
        .select('*, return_items(*)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? toReturn(data, data.return_items || []) : null;
    } catch (error) {
      return handleError(error, 'fetch return');
    }
  },
};

// ==================== AUDIT LOG SERVICE ====================

export const auditLogService = {
  async getAll(limit: number = 1000): Promise<AuditLogEntry[]> {
    if (!FEATURE_FLAGS.USE_SUPABASE_AUDIT_LOGS) {
      return [];
    }

    try {
      // Fetch logs with user data for userName/userRole
      const { data: logs, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (logsError) throw logsError;

      // Fetch all users to build map
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('*, email:id(email)');

      if (usersError) throw usersError;

      const userMap = new Map<string, any>((users || []).map((u: any) => [u.id, toUser(u, u.email?.[0]?.email)]));

      return (logs || []).map((log: any) => toAuditLog(log, userMap));
    } catch (error) {
      return handleError(error, 'fetch audit logs');
    }
  },

  async create(entry: Omit<AuditLogEntry, 'id'>): Promise<void> {
    if (!FEATURE_FLAGS.USE_SUPABASE_AUDIT_LOGS) {
      return;
    }

    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert(fromAuditLog({ ...entry, id: '' }));

      if (error) throw error;
    } catch (error) {
      // Don't throw on audit log failures
      logDebug('Failed to create audit log:', error);
    }
  },
};

// ==================== SETTINGS SERVICE ====================

export const settingsService = {
  async getCompanySettings(): Promise<CompanySettings | null> {
    if (!FEATURE_FLAGS.USE_SUPABASE_SETTINGS) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('value')
        .eq('key', 'company_info')
        .single();

      if (error) throw error;
      return data?.value as CompanySettings;
    } catch (error) {
      logDebug('Failed to fetch company settings:', error);
      return null;
    }
  },

  async updateCompanySettings(settings: CompanySettings): Promise<void> {
    if (!FEATURE_FLAGS.USE_SUPABASE_SETTINGS) {
      throw new SupabaseError('Settings update disabled');
    }

    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          key: 'company_info',
          value: settings,
        });

      if (error) throw error;
    } catch (error) {
      return handleError(error, 'update company settings');
    }
  },
};

// ==================== EXPORT ====================

export const supabaseService = {
  warehouses: warehouseService,
  customers: customerService,
  users: userService,
  products: productService,
  sales: saleService,
  transfers: transferService,
  returns: returnService,
  auditLogs: auditLogService,
  settings: settingsService,
};
