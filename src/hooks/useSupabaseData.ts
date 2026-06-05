/**
 * Custom React hooks for Supabase data management
 */

/** Row returned by recalibrate_stock_preview() RPC */
export interface StockRecalibratePreviewRow {
  product_id:     string;
  warehouse_id:   string;
  producto:       string;
  almacen:        string;
  stock_actual:   number;
  stock_correcto: number;
  diferencia:     number;
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, retryOnColdStart } from '../services/supabaseClient';
import { Warehouse, WarehouseCompany, UserCompany, Customer, Product, Sale, SaleItem, Transfer, Return, AuditLogEntry, User, Payment, UserRole, CheckPaymentStatus, CustomerPrice, Supplier, PurchaseOrder, PurchaseOrderItem, Charge } from '../types';
import { logger } from '../utils/logger';
import { fromReturn, toReturn } from '../types/supabase';
import type { DbReturn, DbReturnItem } from '../types/supabase';
import { useRealtimeTable } from './useRealtime';
import { useStore } from '../store/useStore';
import {
  cacheProducts, getCachedProducts,
  cacheCustomers, getCachedCustomers,
  cacheWarehouses, getCachedWarehouses,
  cacheSales, getCachedSales,
} from '../services/offline/offlineDb';

/**
 * Helper function to get active company ID from the store.
 * Returns the activeCompanyId selected by the user in the header dropdown.
 * Returns null when no company is selected (Admin viewing all data).
 */
export const getCurrentUserCompanyId = async (): Promise<string | null> => {
  return useStore.getState().activeCompanyId || null;
};

/**
 * Helper function to apply company filtering to a Supabase query
 * Returns the query with company_id filter applied (if user is not Admin)
 * @param query - Supabase query builder
 * @param companyId - User's company ID (null for Admin users)
 * @returns Query with company filter applied
 */
export const applyCompanyFilter = <T>(query: any, companyId: string | null): any => {
  // No company selected (Admin viewing all) - return unfiltered
  if (companyId === null) {
    return query;
  }

  // Filter by company OR legacy records without company (NULL)
  // This ensures existing data created before multi-company remains visible
  return query.or(`company_id.eq.${companyId},company_id.is.null`);
};

// WAREHOUSES HOOK
export function useWarehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeCompanyId = useStore(s => s.activeCompanyId);

  const fetchWarehouses = async () => {
    try {
      setLoading(true);

      // Query warehouses directly - RLS handles company filtering at DB level
      // (includes company warehouses + legacy unassigned warehouses)
      const { data, error: fetchError } = await retryOnColdStart(() =>
        supabase
          .from('warehouses')
          .select('*')
          .order('name', { ascending: true })
      );

      if (fetchError) throw fetchError;
      const warehousesData: Warehouse[] = data || [];

      setWarehouses(warehousesData);
      setError(null);
      cacheWarehouses(warehousesData).catch(() => {});
    } catch (err: any) {
      logger.error(`Error fetching warehouses: ${err?.code} - ${err?.message}`, err);
      setError(err);
      // Fall back to cached warehouses so the app keeps working offline
      try {
        const cached = await getCachedWarehouses();
        if (cached.length > 0) {
          setWarehouses(cached as Warehouse[]);
          logger.info('[useWarehouses] Using cached data after fetch error');
        } else {
          setWarehouses([]);
        }
      } catch {
        setWarehouses([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWarehouses(); }, [activeCompanyId]);

  const addWarehouse = async (warehouse: Omit<Warehouse, 'id'>) => {
    const { data, error: insertError } = await supabase.from('warehouses').insert([warehouse]).select().single();
    if (insertError) throw insertError;
    setWarehouses(prev => [...prev, data]);
    return data;
  };

  const updateWarehouse = async (id: string, updates: Partial<Warehouse>) => {
    const { data, error: updateError } = await supabase.from('warehouses').update(updates).eq('id', id).select().single();
    if (updateError) throw updateError;
    setWarehouses(prev => prev.map(w => w.id === id ? data : w));
    return data;
  };

  const deleteWarehouse = async (id: string) => {
    // Check if warehouse is used in transfers
    const { data: transfersData, error: transfersError } = await supabase
      .from('transfers')
      .select('id')
      .or(`from_warehouse_id.eq.${id},to_warehouse_id.eq.${id}`)
      .limit(1);

    if (transfersError) throw transfersError;

    if (transfersData && transfersData.length > 0) {
      throw new Error('No se puede eliminar este almacén porque tiene transferencias asociadas. Elimina o reasigna las transferencias primero.');
    }

    // Check if warehouse is used in sales
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select('id')
      .eq('warehouse_id', id)
      .limit(1);

    if (salesError) throw salesError;

    if (salesData && salesData.length > 0) {
      throw new Error('No se puede eliminar este almacén porque tiene ventas asociadas.');
    }

    // Check if warehouse is used in returns
    const { data: returnsData, error: returnsError } = await supabase
      .from('returns')
      .select('id')
      .eq('warehouse_id', id)
      .limit(1);

    if (returnsError) throw returnsError;

    if (returnsData && returnsData.length > 0) {
      throw new Error('No se puede eliminar este almacén porque tiene devoluciones asociadas.');
    }

    // If no dependencies, proceed with deletion
    const { error: deleteError } = await supabase.from('warehouses').delete().eq('id', id);
    if (deleteError) throw deleteError;
    setWarehouses(prev => prev.filter(w => w.id !== id));
  };

  // Realtime: auto-refresh on changes from other users
  useRealtimeTable('warehouses', () => { fetchWarehouses(); });

  return { warehouses, loading, error, addWarehouse, updateWarehouse, deleteWarehouse, refresh: fetchWarehouses };
}

// USER COMPANIES HOOK (N:M relationship between users and companies)
export function useUserCompanies(userId?: string) {
  const [userCompanies, setUserCompanies] = useState<{ id: string; userId: string; companyId: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUserCompanies = useCallback(async () => {
    if (!userId) {
      setUserCompanies([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await retryOnColdStart(() =>
        supabase
          .from('user_companies')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
      );

      if (fetchError) throw fetchError;

      const mapped = (data || []).map((uc: any) => ({
        id: uc.id,
        userId: uc.user_id,
        companyId: uc.company_id,
        createdAt: uc.created_at
      }));

      setUserCompanies(mapped);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching user companies', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchUserCompanies(); }, [fetchUserCompanies]);

  const assignCompany = async (targetUserId: string, companyId: string) => {
    const { data, error: insertError } = await supabase
      .from('user_companies')
      .insert([{ user_id: targetUserId, company_id: companyId }])
      .select()
      .single();

    if (insertError) throw insertError;

    const mapped = {
      id: data.id,
      userId: data.user_id,
      companyId: data.company_id,
      createdAt: data.created_at
    };

    setUserCompanies(prev => [...prev, mapped]);
    return mapped;
  };

  const unassignCompany = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('user_companies')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    setUserCompanies(prev => prev.filter(uc => uc.id !== id));
  };

  const setCompaniesForUser = async (targetUserId: string, companyIds: string[]) => {
    // Delete all existing assignments for this user
    const { error: deleteError } = await supabase
      .from('user_companies')
      .delete()
      .eq('user_id', targetUserId);

    if (deleteError) throw deleteError;

    // Insert new assignments
    if (companyIds.length > 0) {
      const inserts = companyIds.map(companyId => ({
        user_id: targetUserId,
        company_id: companyId
      }));

      const { error: insertError } = await supabase
        .from('user_companies')
        .insert(inserts);

      if (insertError) throw insertError;
    }

    // Refresh if this is the current user
    if (targetUserId === userId) {
      await fetchUserCompanies();
    }
  };

  return {
    userCompanies,
    loading,
    error,
    assignCompany,
    unassignCompany,
    setCompaniesForUser,
    refresh: fetchUserCompanies
  };
}

// Fetch companies for any user (used by Admin in Users.tsx)
export async function fetchUserCompaniesForUser(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map(uc => uc.company_id);
  } catch (err) {
    logger.error('Error fetching companies for user', err);
    return [];
  }
}

// CUSTOMERS HOOK
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeCompanyId = useStore(s => s.activeCompanyId);

  const fetchCustomers = async () => {
    try {
      setLoading(true);

      const companyId = await getCurrentUserCompanyId();
      const { data, error: fetchError } = await retryOnColdStart(() => {
        let q = supabase.from('customers').select('*').order('name', { ascending: true });
        if (companyId) {
          // Show customers for this company + legacy customers (no company assigned)
          q = q.or(`company_id.eq.${companyId},company_id.is.null`);
        }
        return q;
      });

      if (fetchError) throw fetchError;

      // Convert snake_case to camelCase
      const customersData: Customer[] = (data || []).map((c: any) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        contactPerson: c.contact_person,
        email: c.email,
        phone: c.phone,
        address: c.address,
        city: c.city,
        ice: c.ice,
        taxId: c.tax_id,
        creditLimit: c.credit_limit,
        notes: c.notes,
        latitude: c.latitude ?? null,
        longitude: c.longitude ?? null,
        companyId: c.company_id,
        assignedTo: c.assigned_to ?? null,
      }));

      setCustomers(customersData);
      setError(null);
      cacheCustomers(customersData).catch(() => {});
    } catch (err: any) {
      logger.error('Error fetching customers', err);
      setError(err);
      // Fall back to cached customers so the app keeps working offline
      try {
        const cached = await getCachedCustomers();
        if (cached.length > 0) {
          setCustomers(cached as Customer[]);
          logger.info('[useCustomers] Using cached data after fetch error');
        }
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, [activeCompanyId]);

  const addCustomer = async (customer: Omit<Customer, 'id'>) => {
    // Convert camelCase to snake_case for database
    const dbCustomer: any = {
      type: customer.type,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city
    };

    // Add optional fields if they exist
    if (customer.contactPerson) dbCustomer.contact_person = customer.contactPerson;
    if (customer.ice) dbCustomer.ice = customer.ice;
    if (customer.taxId) dbCustomer.tax_id = customer.taxId;
    if (customer.creditLimit !== undefined) dbCustomer.credit_limit = customer.creditLimit;
    if (customer.notes) dbCustomer.notes = customer.notes;
    if (customer.latitude != null) dbCustomer.latitude = customer.latitude;
    if (customer.longitude != null) dbCustomer.longitude = customer.longitude;
    if (customer.companyId !== undefined) dbCustomer.company_id = customer.companyId;

    const { data, error: insertError } = await supabase.from('customers').insert([dbCustomer]).select().single();
    if (insertError) throw insertError;

    // Convert snake_case back to camelCase for state
    const customerData: Customer = {
      id: data.id,
      type: data.type,
      name: data.name,
      contactPerson: data.contact_person,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      ice: data.ice,
      taxId: data.tax_id,
      creditLimit: data.credit_limit,
      notes: data.notes,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      companyId: data.company_id
    };

    setCustomers(prev => [...prev, customerData]);
    return customerData;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    // Convert camelCase to snake_case for database
    const dbUpdates: any = {};
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.contactPerson !== undefined) dbUpdates.contact_person = updates.contactPerson;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.address !== undefined) dbUpdates.address = updates.address;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.ice !== undefined) dbUpdates.ice = updates.ice;
    if (updates.taxId !== undefined) dbUpdates.tax_id = updates.taxId;
    if (updates.creditLimit !== undefined) dbUpdates.credit_limit = updates.creditLimit;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
    if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
    if (updates.companyId !== undefined) dbUpdates.company_id = updates.companyId;

    const { data, error: updateError } = await supabase.from('customers').update(dbUpdates).eq('id', id).select().single();
    if (updateError) throw updateError;

    // Convert snake_case back to camelCase for state
    const customerData: Customer = {
      id: data.id,
      type: data.type,
      name: data.name,
      contactPerson: data.contact_person,
      email: data.email,
      phone: data.phone,
      address: data.address,
      city: data.city,
      ice: data.ice,
      taxId: data.tax_id,
      creditLimit: data.credit_limit,
      notes: data.notes,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      companyId: data.company_id
    };

    setCustomers(prev => prev.map(c => c.id === id ? customerData : c));
    return customerData;
  };

  const deleteCustomer = async (id: string) => {
    // Check if customer has existing sales
    const { count } = await supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', id);

    if (count && count > 0) {
      throw new Error(`Ce client a ${count} vente(s) associée(s). Impossible de le supprimer.`);
    }

    const { error: deleteError } = await supabase.from('customers').delete().eq('id', id);
    if (deleteError) throw deleteError;
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  // Realtime: auto-refresh on changes from other users
  useRealtimeTable('customers', () => { fetchCustomers(); });

  return { customers, loading, error, addCustomer, updateCustomer, deleteCustomer, refresh: fetchCustomers };
}

// PRODUCTS HOOK
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      logger.debug('Fetching products...');
      const { data, error: fetchError } = await retryOnColdStart(() =>
        supabase
          .from('products')
          .select(`
            *,
            stock_levels (
              warehouse_id,
              quantity
            )
          `)
          .order('name', { ascending: true })
      );

      logger.debug('Products response', { count: data?.length, error: fetchError?.message, errorCode: fetchError?.code });

      if (fetchError) throw fetchError;

      // Transform database format to app format
      const productsData: Product[] = (data || []).map((p: any) => {
        // Build stockLevels object from stock_levels array
        const stockLevels: Record<string, number> = {};
        if (p.stock_levels && Array.isArray(p.stock_levels)) {
          p.stock_levels.forEach((sl: any) => {
            stockLevels[sl.warehouse_id] = sl.quantity;
          });
        }

        return {
          id: p.id,
          sku: p.sku,
          barcode: p.barcode || undefined,
          name: p.name,
          category: p.category,
          viscosity: p.viscosity || undefined,
          packSize: p.pack_size,
          unit: p.unit,
          unitsPerBox: p.units_per_box || 1,
          price: p.price,
          vipPrice: p.vip_price ?? undefined,
          points: p.points ?? 1,
          cost: p.cost,
          supplierId: p.supplier_id || undefined,
          supplierRef: p.supplier_ref || undefined,
          customTaxRate: p.custom_tax_rate || undefined,
          stockLevels,
          minStock: p.min_stock,
          lastRestock: p.last_restock
        };
      });

      setProducts(productsData);
      logger.debug('Products set', { count: productsData.length });
      setError(null);
      cacheProducts(productsData).catch(() => {});
    } catch (err: any) {
      logger.error(`Error fetching products: ${err?.code} - ${err?.message}`, err);
      setError(err);
      // Fall back to cached products so POS keeps working offline
      try {
        const cached = await getCachedProducts();
        if (cached.length > 0) {
          setProducts(cached as Product[]);
          logger.info('[useProducts] Using cached data after fetch error');
        } else {
          setProducts([]);
        }
      } catch {
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchProducts(); 
    // Log when component mounts
    logger.info('useProducts hook initialized');
  }, []);

  // Refresh function exposed for manual refresh
  const refresh = async () => {
    logger.info('Manual products refresh triggered');
    await fetchProducts();
  };

  // Helper: Get current authenticated user ID
  const getCurrentUserId = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return userId;
  };

  // Helper: Update product last_restock timestamp and refresh
  const updateProductTimestamp = async (productId: string): Promise<void> => {
    await supabase
      .from('products')
      .update({ last_restock: new Date().toISOString() })
      .eq('id', productId);
    await fetchProducts();
  };

  const addProduct = async (product: Omit<Product, 'id'>) => {
    const { data: productData, error: insertError } = await supabase
      .from('products')
      .insert([{
        sku: product.sku,
        barcode: product.barcode || null,
        name: product.name,
        category: product.category,
        viscosity: product.viscosity || null,
        pack_size: product.packSize,
        unit: product.unit,
        units_per_box: product.unitsPerBox || 1,
        price: product.price,
        vip_price: product.vipPrice ?? null,
        points: product.points ?? 1,
        cost: product.cost,
        supplier_id: product.supplierId || null,
        supplier_ref: product.supplierRef || null,
        custom_tax_rate: product.customTaxRate || null,
        min_stock: product.minStock,
        last_restock: product.lastRestock
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // Insert stock levels
    if (product.stockLevels && Object.keys(product.stockLevels).length > 0) {
      const stockLevelInserts = Object.entries(product.stockLevels).map(([warehouseId, quantity]) => ({
        product_id: productData.id,
        warehouse_id: warehouseId,
        quantity
      }));

      const { error: stockError } = await supabase
        .from('stock_levels')
        .insert(stockLevelInserts);

      if (stockError) throw stockError;
    }

    // Fetch the complete product with stock levels
    await fetchProducts();
    return productData;
  };

  const upsertProduct = async (product: Omit<Product, 'id'>) => {
    // Check if product exists by SKU
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id')
      .eq('sku', product.sku)
      .maybeSingle();

    if (existingProduct) {
      // Update existing product
      return await updateProduct(existingProduct.id, product);
    } else {
      // Insert new product
      return await addProduct(product);
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const productUpdates: any = {};
    if (updates.sku !== undefined) productUpdates.sku = updates.sku;
    if (updates.barcode !== undefined) productUpdates.barcode = updates.barcode || null;
    if (updates.name !== undefined) productUpdates.name = updates.name;
    if (updates.category !== undefined) productUpdates.category = updates.category;
    if (updates.viscosity !== undefined) productUpdates.viscosity = updates.viscosity || null;
    if (updates.packSize !== undefined) productUpdates.pack_size = updates.packSize;
    if (updates.unit !== undefined) productUpdates.unit = updates.unit;
    if (updates.unitsPerBox !== undefined) productUpdates.units_per_box = updates.unitsPerBox;
    if (updates.price !== undefined) productUpdates.price = updates.price;
    if (updates.vipPrice !== undefined) productUpdates.vip_price = updates.vipPrice ?? null;
    if (updates.points !== undefined) productUpdates.points = updates.points ?? 1;
    if (updates.cost !== undefined) productUpdates.cost = updates.cost;
    if (updates.supplierId !== undefined) productUpdates.supplier_id = updates.supplierId || null;
    if (updates.supplierRef !== undefined) productUpdates.supplier_ref = updates.supplierRef || null;
    if (updates.customTaxRate !== undefined) productUpdates.custom_tax_rate = updates.customTaxRate || null;
    if (updates.minStock !== undefined) productUpdates.min_stock = updates.minStock;
    if (updates.lastRestock !== undefined) productUpdates.last_restock = updates.lastRestock;

    const { data, error: updateError } = await supabase
      .from('products')
      .update(productUpdates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // If stockLevels updated, handle separately
    if (updates.stockLevels) {
      // Delete existing stock levels
      await supabase.from('stock_levels').delete().eq('product_id', id);

      // Insert new stock levels
      const stockLevelInserts = Object.entries(updates.stockLevels).map(([warehouseId, quantity]) => ({
        product_id: id,
        warehouse_id: warehouseId,
        quantity
      }));

      if (stockLevelInserts.length > 0) {
        await supabase.from('stock_levels').insert(stockLevelInserts);
      }
    }

    await fetchProducts();
    return data;
  };

  const updateStock = async (
    productId: string,
    warehouseId: string,
    delta: number,        // Cambio relativo (+ para agregar, - para quitar)
    reason?: string,      // Motivo del cambio
    productName?: string, // Nombre del producto (para el registro de transferencia)
    companyId?: string | null  // Empresa (para aislamiento multi-tenant)
  ) => {
    const userId = await getCurrentUserId();

    // 1. Crear registro ADJUSTMENT en transfers ANTES de actualizar stock.
    //    Si la creación falla → stock no se toca → estado consistente.
    //    Esto garantiza que el ajuste aparece en el historial de Transferencias
    //    y es contabilizado por recalibrate_stock_preview/apply.
    const reference = delta >= 0 ? 'ADJ+' : 'ADJ-';
    const absQty = Math.abs(delta);

    const { data: newTransfer, error: transferError } = await supabase
      .from('transfers')
      .insert([{
        date: new Date().toISOString(),
        type: 'ADJUSTMENT',
        reference,
        to_warehouse_id: warehouseId,
        reason: reason || 'Manual stock adjustment',
        status: 'Completed',
        created_by: userId,
        company_id: companyId ?? null,
      }])
      .select()
      .single();

    if (transferError) throw transferError;

    const { error: itemsError } = await supabase
      .from('transfer_items')
      .insert([{
        transfer_id: newTransfer.id,
        product_id: productId,
        product_name: productName || '',
        quantity: absQty,
      }]);

    if (itemsError) throw itemsError;

    // 2. Actualizar stock_levels de forma atómica (row-lock + audit_log).
    //    Si falla aquí el transfer ya está creado — situación transitoria
    //    que la recalibración puede corregir. En la práctica, este RPC
    //    no falla si el transfer ya pasó correctamente.
    const { error } = await supabase.rpc('update_stock_level', {
      p_product_id: productId,
      p_warehouse_id: warehouseId,
      p_delta: delta,
      p_reason: reason || 'Manual stock adjustment',
      p_user_id: userId
    });

    if (error) throw error;

    await updateProductTimestamp(productId);
  };

  const transferStock = async (
    productId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    quantity: number,
    reason?: string
  ) => {
    const userId = await getCurrentUserId();

    // Use atomic RPC to transfer stock between warehouses
    const { data, error } = await supabase.rpc('transfer_stock_between_warehouses', {
      p_product_id: productId,
      p_from_warehouse_id: fromWarehouseId,
      p_to_warehouse_id: toWarehouseId,
      p_quantity: quantity,
      p_reason: reason || 'Stock transfer',
      p_user_id: userId
    });

    if (error) throw error;

    // Check if RPC returned an error
    if (data && data.length > 0 && !data[0].success) {
      throw new Error(data[0].error_message || 'Transfer failed');
    }

    await updateProductTimestamp(productId);
  };

  const deleteProduct = async (id: string) => {
    // Stock levels will be deleted by CASCADE
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Realtime: auto-refresh on changes from other users
  useRealtimeTable('products', () => { fetchProducts(); });
  useRealtimeTable('stock_levels', () => { fetchProducts(); });

  return { products, loading, error, addProduct, upsertProduct, updateProduct, updateStock, transferStock, deleteProduct, refresh };
}

// SALES HOOK
export function useSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeCompanyId = useStore(s => s.activeCompanyId);

  const fetchSales = async () => {
    try {
      setLoading(true);

      // Get user's company ID for multi-tenant filtering
      const companyId = await getCurrentUserCompanyId();

      // Apply company filtering (automatically handles Admin vs regular users)
      const { data, error: fetchError } = await retryOnColdStart(() =>
        applyCompanyFilter(
          supabase
            .from('sales')
            .select(`
              *,
              sale_items (
                id,
                product_id,
                product_name,
                quantity,
                unit_price,
                discount,
                discount_type,
                total,
                sell_mode,
                units_per_box
              ),
              payments (
                id,
                date,
                amount,
                method,
                reference,
                check_number,
                due_date,
                payment_status,
                recorded_by,
                bank_name
              )
            `),
          companyId
        ).order('date', { ascending: false })
      );

      if (fetchError) throw fetchError;

      // Transform database format to app format
      const salesData: Sale[] = (data || []).map((s: any) => ({
        id: s.id,
        invoiceNumber: s.invoice_number || undefined,
        deliveryNoteNumber: s.delivery_note_number || undefined,
        date: s.date,
        warehouseId: s.warehouse_id,
        customerId: s.customer_id,
        customerName: s.customer_name,
        customerType: s.customer_type,
        items: (s.sale_items || []).map((item: any) => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          discount: item.discount,
          discountType: item.discount_type || 'percentage',
          total: item.total,
          sellMode: item.sell_mode || 'unit',
          unitsPerBox: item.units_per_box || 1
        })),
        source: s.source || 'B2B',
        documentType: s.document_type || 'INVOICE',
        isFastSale: s.is_fast_sale || false,
        globalDiscountType: s.global_discount_type || undefined,
        globalDiscountValue: s.global_discount_value || undefined,
        globalDiscountAmount: s.global_discount_amount || undefined,
        itemsSubtotal: s.items_subtotal,
        subtotalAmount: s.subtotal_amount,
        taxRate: s.tax_rate,
        taxAmount: s.tax_amount,
        totalAmount: s.total_amount,
        amountPaid: s.amount_paid,
        paymentStatus: s.payment_status,
        payments: (s.payments || []).map((p: any) => ({
          id: p.id,
          date: p.date,
          amount: p.amount,
          method: p.method,
          reference: p.reference || undefined,
          checkNumber: p.check_number || undefined,
          dueDate: p.due_date || undefined,
          paymentStatus: p.payment_status || undefined,
          recordedBy: p.recorded_by,
          bankName: p.bank_name || undefined
        })),
        creditedAmount: s.credited_amount || 0,
        returnStatus: s.return_status || undefined,
        status: s.status,
        companyId: s.company_id || null,
        updatedAt: s.updated_at || s.date
      }));

      setSales(salesData);
      setError(null);
      cacheSales(salesData).catch(() => {});
    } catch (err: any) {
      logger.error('Error fetching sales', err);
      setError(err);
      // Fall back to cached sales so the app keeps working offline
      try {
        const cached = await getCachedSales();
        if (cached.length > 0) {
          // Transform raw cached (snake_case from syncEngine) or camelCase from previous cache
          const transformed: Sale[] = cached.map((s: any) => {
            // Already transformed (cached by useSales itself)
            if (s.totalAmount !== undefined) return s as Sale;
            // Raw from syncEngine cache (snake_case)
            return {
              id: s.id,
              invoiceNumber: s.invoice_number || undefined,
              deliveryNoteNumber: s.delivery_note_number || undefined,
              date: s.date,
              warehouseId: s.warehouse_id,
              customerId: s.customer_id,
              customerName: s.customer_name,
              customerType: s.customer_type,
              items: (s.sale_items || []).map((item: any) => ({
                productId: item.product_id,
                productName: item.product_name,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                discount: item.discount,
                discountType: item.discount_type || 'percentage',
                total: item.total,
                sellMode: item.sell_mode || 'unit',
                unitsPerBox: item.units_per_box || 1,
              })),
              source: s.source || 'B2B',
              documentType: s.document_type || 'INVOICE',
              isFastSale: s.is_fast_sale || false,
              totalAmount: s.total_amount,
              amountPaid: s.amount_paid,
              paymentStatus: s.payment_status,
              payments: (s.payments || []).map((p: any) => ({
                id: p.id, date: p.date, amount: p.amount, method: p.method,
                reference: p.reference || undefined, checkNumber: p.check_number || undefined,
                dueDate: p.due_date || undefined, paymentStatus: p.payment_status || undefined,
                recordedBy: p.recorded_by, bankName: p.bank_name || undefined,
              })),
              creditedAmount: s.credited_amount || 0,
              status: s.status,
              companyId: s.company_id || null,
              updatedAt: s.updated_at || s.date,
            } as unknown as Sale;
          });
          setSales(transformed);
          logger.info('[useSales] Using cached data after fetch error');
        }
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSales(); }, [activeCompanyId]);

  /**
   * Creates a sale atomically via PostgreSQL RPC.
   * Inserts sale header + items + payments and deducts stock in a single transaction.
   * @param sale - Sale data (without id, which is auto-generated)
   * @param userId - ID of the user creating the sale
   * @throws Error if sale has no items or RPC fails
   */
  const createSale = async (sale: Omit<Sale, 'id'>, userId: string) => {
    // Validate: sale must have at least one item
    if (!sale.items || sale.items.length === 0) {
      throw new Error('Cannot create sale without items');
    }

    // Build sale JSONB for atomic RPC
    const saleId = (sale as any).id || crypto.randomUUID();
    const saleJson = {
      id: saleId,
      date: sale.date,
      warehouseId: sale.warehouseId,
      customerId: sale.customerId,
      customerName: sale.customerName,
      customerType: sale.customerType,
      source: sale.source || 'B2B',
      documentType: sale.documentType || 'INVOICE',
      isFastSale: sale.isFastSale || false,
      companyId: sale.companyId || null,
      invoiceNumber: sale.invoiceNumber || null,
      deliveryNoteNumber: sale.deliveryNoteNumber || null,
      globalDiscountType: sale.globalDiscountType || null,
      globalDiscountValue: sale.globalDiscountValue || null,
      globalDiscountAmount: sale.globalDiscountAmount || null,
      itemsSubtotal: sale.itemsSubtotal,
      subtotalAmount: sale.subtotalAmount,
      taxRate: sale.taxRate,
      taxAmount: sale.taxAmount,
      totalAmount: sale.totalAmount,
      amountPaid: sale.amountPaid,
      paymentStatus: sale.paymentStatus,
      creditedAmount: sale.creditedAmount || 0,
      status: sale.status,
      payments: (sale.payments || []).map(p => ({
        id: p.id || crypto.randomUUID(),
        date: p.date,
        amount: p.amount,
        method: p.method,
        checkNumber: p.checkNumber || null,
        dueDate: p.dueDate || null,
        paymentStatus: p.paymentStatus || null,
        recordedBy: p.recordedBy,
        bankName: p.bankName || null
      }))
    };

    // Build items JSONB
    const itemsJson = sale.items.map(item => ({
      id: crypto.randomUUID(),
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      discountType: item.discountType || 'percentage',
      total: item.total,
      isGift: item.isGift || false,
      sellMode: item.sellMode || 'unit',
      unitsPerBox: item.unitsPerBox || 1
    }));

    // Stock is stored in individual units after migration.
    // Box mode: deduct quantity × packSize units; unit mode: deduct quantity units.
    const stockUpdates = sale.items.map(item => {
      const packSize = item.unitsPerBox || 1;
      const delta = item.stockDelta
        ?? (item.sellMode === 'box' ? -(item.quantity * packSize) : -item.quantity);
      return { product_id: item.productId, warehouse_id: sale.warehouseId, delta };
    });

    // Atomic RPC: sale + items + payments + stock in one transaction
    const { error } = await supabase.rpc('create_sale_atomic', {
      p_sale: saleJson,
      p_items: itemsJson,
      p_stock_updates: stockUpdates
    });

    if (error) throw error;

    await fetchSales();
    // Return the full sale object so callers (useOfflineSales) get what they expect
    return { ...sale, id: saleId } as any;
  };

  /**
   * Registers a payment against a sale.
   * Validates amount > 0 and does not exceed remaining balance.
   * Automatically updates sale's amount_paid and payment_status.
   * @param saleId - ID of the sale to pay
   * @param payment - Payment data (amount, method, check details, etc.)
   * @throws Error if amount exceeds remaining balance or is invalid
   */
  const registerPayment = async (saleId: string, payment: Omit<Payment, 'id'>) => {
    // First, get the sale to obtain its company_id
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .select('company_id, amount_paid, total_amount, credited_amount')
      .eq('id', saleId)
      .single();

    if (saleError) throw saleError;

    // Validate: payment amount must be > 0
    if (!payment.amount || payment.amount <= 0) {
      throw new Error('Le montant du paiement doit être supérieur à 0');
    }

    // Validate: payment cannot exceed remaining balance (include credited_amount from returns)
    const creditedAmount = saleData.credited_amount || 0;
    const remainingBalance = Math.round((saleData.total_amount - saleData.amount_paid - creditedAmount) * 100) / 100;
    if (payment.amount > remainingBalance + 0.01) {
      throw new Error(`Le paiement (${payment.amount.toFixed(2)}) dépasse le solde restant (${remainingBalance.toFixed(2)})`);
    }

    // Clamp to remaining balance
    const effectiveAmount = Math.round(Math.min(payment.amount, remainingBalance) * 100) / 100;

    // Insert payment with company_id from sale
    const { error: paymentError } = await supabase
      .from('payments')
      .insert([{
        sale_id: saleId,
        date: payment.date,
        amount: effectiveAmount,
        method: payment.method,
        reference: payment.reference || null,
        check_number: payment.checkNumber || null,
        due_date: payment.dueDate || null,
        payment_status: payment.paymentStatus || null,
        recorded_by: payment.recordedBy,
        bank_name: payment.bankName || null,
        company_id: saleData.company_id  // Inherit company_id from sale
      }]);

    if (paymentError) throw paymentError;

    const newAmountPaid = Math.round((saleData.amount_paid + effectiveAmount) * 100) / 100;
    // Include creditedAmount in payment status: sale is "Paid" when amountPaid + creditedAmount >= totalAmount
    const effectiveTotal = newAmountPaid + creditedAmount;
    const newPaymentStatus =
      effectiveTotal >= saleData.total_amount
        ? 'Paid'
        : effectiveTotal > 0
        ? 'Partial'
        : 'Unpaid';

    // Update sale
    const { error: updateError } = await supabase
      .from('sales')
      .update({
        amount_paid: newAmountPaid,
        payment_status: newPaymentStatus
      })
      .eq('id', saleId);

    if (updateError) throw updateError;

    await fetchSales();
  };

  /**
   * Updates a payment's status (Pending/Cashed/Bounced/Recovered).
   * On bounce: recalculates sale's amount_paid excluding bounced payments
   * and reverts payment_status to Unpaid/Partial.
   * On recovery: recalculates sale's amount_paid including recovered payments.
   * @param paymentId - ID of the payment to update
   * @param newStatus - New check/traite status
   */
  const updatePaymentStatus = async (paymentId: string, newStatus: CheckPaymentStatus) => {
    // Get payment details to find the parent sale
    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('id, sale_id, amount, payment_status')
      .eq('id', paymentId)
      .single();

    if (fetchErr || !payment) throw fetchErr || new Error('Payment not found');

    const oldStatus = payment.payment_status;

    // Update payment status
    const { error: updateError } = await supabase
      .from('payments')
      .update({ payment_status: newStatus })
      .eq('id', paymentId);

    if (updateError) throw updateError;

    // Recalculate sale payment status when check bounces or is recovered
    const statusChanged = oldStatus !== newStatus;
    const isBounce = newStatus === 'Bounced' && oldStatus !== 'Bounced';
    const isRecovery = oldStatus === 'Bounced' && newStatus !== 'Bounced';

    if (statusChanged && (isBounce || isRecovery) && payment.sale_id) {
      // Get all payments for this sale to recalculate effective amount paid
      const { data: saleData } = await supabase
        .from('sales')
        .select('total_amount, credited_amount')
        .eq('id', payment.sale_id)
        .single();

      const { data: allPayments } = await supabase
        .from('payments')
        .select('amount, payment_status')
        .eq('sale_id', payment.sale_id);

      if (saleData && allPayments) {
        // Only count non-bounced payments as effective
        const effectivePaid = Math.round(
          allPayments
            .filter(p => p.payment_status !== 'Bounced')
            .reduce((sum, p) => sum + (p.amount || 0), 0) * 100
        ) / 100;

        const credited = saleData.credited_amount || 0;
        const remaining = Math.round((saleData.total_amount - effectivePaid - credited) * 100) / 100;

        const newSaleStatus = remaining <= 0 ? 'Paid'
          : effectivePaid > 0 || credited > 0 ? 'Partial'
          : 'Unpaid';

        await supabase
          .from('sales')
          .update({ amount_paid: effectivePaid, payment_status: newSaleStatus })
          .eq('id', payment.sale_id);
      }
    }

    await fetchSales();
  };

  const deletePayment = async (saleId: string, paymentId: string) => {
    // Get the payment amount before deleting
    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('amount')
      .eq('id', paymentId)
      .single();
    if (fetchErr) throw fetchErr;

    // Delete the payment record
    const { error: deleteErr } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);
    if (deleteErr) throw deleteErr;

    // Recalculate amount_paid and payment_status on the sale
    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .select('amount_paid, total_amount, credited_amount')
      .eq('id', saleId)
      .single();
    if (saleErr) throw saleErr;

    const newAmountPaid = Math.max(0, (sale.amount_paid || 0) - (payment.amount || 0));
    const effective = newAmountPaid + (sale.credited_amount || 0);
    const total = sale.total_amount || 0;
    const newStatus = effective >= total - 0.01 ? 'Paid' : newAmountPaid > 0 ? 'Partial' : 'Unpaid';

    const { error: updateErr } = await supabase
      .from('sales')
      .update({ amount_paid: newAmountPaid, payment_status: newStatus })
      .eq('id', saleId);
    if (updateErr) throw updateErr;

    await fetchSales();
  };

  const updatePaymentDueDate = async (paymentId: string, newDueDate: string) => {
    // Update payment due date
    const { error: updateError } = await supabase
      .from('payments')
      .update({ due_date: newDueDate })
      .eq('id', paymentId);

    if (updateError) throw updateError;

    await fetchSales();
  };

  // Update sale items (for editing invoices - atomic with optimistic locking)
  /**
   * Updates a sale's items and totals atomically via PostgreSQL RPC.
   * Reverses old stock, applies new stock, and checks optimistic lock (updated_at).
   * Includes creditedAmount in payment status recalculation.
   * @param saleId - ID of the sale to update
   * @param newItems - New array of sale items
   * @param totals - Recalculated financial totals
   * @param userId - ID of the user performing the update
   * @throws Error if sale was modified by another user (CONFLICT) or has returns
   */
  const updateSaleItems = async (
    saleId: string,
    newItems: SaleItem[],
    totals: {
      itemsSubtotal: number;
      globalDiscountAmount: number;
      subtotalAmount: number;
      taxAmount: number;
      totalAmount: number;
    },
    userId: string
  ) => {
    // Validate: sale must have at least one item
    if (!newItems || newItems.length === 0) {
      throw new Error('Cannot update sale without items');
    }

    // Get current sale from local state
    const sale = sales.find(s => s.id === saleId);
    if (!sale) throw new Error('Sale not found');

    const oldItems = sale.items || [];

    // Stock is stored in individual units (post-migration).
    // Box-mode items must be multiplied by unitsPerBox — same logic as createSale.
    const oldStockReversals = oldItems.map(item => {
      const units = item.sellMode === 'box'
        ? item.quantity * (item.unitsPerBox || 1)
        : item.quantity;
      return { product_id: item.productId, warehouse_id: sale.warehouseId, delta: units };
    });

    const newStockDeductions = newItems.map(item => {
      const units = item.sellMode === 'box'
        ? item.quantity * (item.unitsPerBox || 1)
        : item.quantity;
      return { product_id: item.productId, warehouse_id: sale.warehouseId, delta: -units };
    });

    // Build new items JSONB
    const newItemsJson = newItems.map(item => ({
      id: crypto.randomUUID(),
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      discountType: item.discountType || 'percentage',
      total: item.total,
      isGift: item.isGift || false,
      sellMode: item.sellMode || 'unit',
      unitsPerBox: item.unitsPerBox || 1
    }));

    // Sale updates JSONB
    // Include creditedAmount in payment status calculation
    const creditedAmount = sale.creditedAmount || 0;
    const effectivePaid = sale.amountPaid + creditedAmount;
    const remaining = Math.round((totals.totalAmount - effectivePaid) * 100) / 100;

    const saleUpdates = {
      itemsSubtotal: totals.itemsSubtotal,
      globalDiscountAmount: totals.globalDiscountAmount,
      subtotalAmount: totals.subtotalAmount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      amountPaid: sale.amountPaid,
      paymentStatus: remaining <= 0 ? 'Paid'
        : effectivePaid > 0 ? 'Partial' : 'Unpaid'
    };

    // Use the sale's last known updated_at for optimistic lock
    const expectedUpdatedAt = (sale as any).updatedAt || sale.date;

    // Atomic RPC: lock check + reverse stock + delete items + insert items + deduct stock + update totals
    const { error } = await supabase.rpc('update_sale_optimistic', {
      p_sale_id: saleId,
      p_expected_updated_at: expectedUpdatedAt,
      p_new_items: newItemsJson,
      p_old_stock_reversals: oldStockReversals,
      p_new_stock_deductions: newStockDeductions,
      p_sale_updates: saleUpdates
    });

    if (error) {
      // Check for conflict error from optimistic lock
      if (error.message?.includes('CONFLICT')) {
        throw new Error('Cette vente a été modifiée par un autre utilisateur. Veuillez rafraîchir la page et réessayer.');
      }
      throw error;
    }

    await fetchSales();
  };

  // Realtime: auto-refresh on changes from other users
  useRealtimeTable('sales', () => { fetchSales(); });

  return { sales, loading, error, createSale, updateSaleItems, registerPayment, updatePaymentStatus, updatePaymentDueDate, deletePayment, refresh: fetchSales };
}

// TRANSFERS HOOK
export function useTransfers() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeCompanyId = useStore(s => s.activeCompanyId);

  const fetchTransfers = async () => {
    try {
      setLoading(true);

      // Get user's company ID for multi-tenant filtering
      const companyId = await getCurrentUserCompanyId();

      // Apply company filtering (automatically handles Admin vs regular users)
      const { data, error: fetchError } = await retryOnColdStart(() =>
        applyCompanyFilter(
          supabase
            .from('transfers')
            .select(`
              *,
              transfer_items (
                id,
                product_id,
                product_name,
                quantity,
                boxes_entered,
                loose_entered
              )
            `),
          companyId
        ).order('date', { ascending: false })
      );

      if (fetchError) throw fetchError;

      // Convert snake_case to camelCase for application use
      const formattedTransfers = (data || []).map((transfer: any) => ({
        ...transfer,
        fromWarehouseId: transfer.from_warehouse_id,
        toWarehouseId: transfer.to_warehouse_id,
        createdBy: transfer.created_by,
        createdAt: transfer.created_at,
        updatedAt: transfer.updated_at,
        companyId: transfer.company_id || null,
        items: (transfer.transfer_items || []).map((item: any) => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          boxesEntered: item.boxes_entered ?? null,
          looseEntered: item.loose_entered ?? null,
        }))
      }));

      setTransfers(formattedTransfers);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching transfers', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTransfers(); }, [activeCompanyId]);
  useRealtimeTable('transfers', () => { fetchTransfers(); });

  // Helper: update stock_levels via existing RPCs (same as used in Inventory)
  const applyStockUpdate = async (
    type: string,
    reference: string,
    fromWarehouseId: string | undefined,
    toWarehouseId: string | undefined,
    items: Array<{ productId: string; quantity: number }>,
    userId: string,
    direction: 1 | -1  // 1 = apply forward, -1 = reverse (for delete)
  ) => {
    for (const item of items) {
      if (type === 'INTERNAL' && fromWarehouseId && toWarehouseId) {
        if (direction === 1) {
          const { data, error } = await supabase.rpc('transfer_stock_between_warehouses', {
            p_product_id: item.productId,
            p_from_warehouse_id: fromWarehouseId,
            p_to_warehouse_id: toWarehouseId,
            p_quantity: item.quantity,
            p_reason: 'Internal transfer',
            p_user_id: userId
          });
          if (error) throw error;
          if (data && data.length > 0 && !data[0].success) {
            throw new Error(data[0].error_message || 'Transfer RPC failed');
          }
        } else {
          // Reverse: move stock back from toWarehouse to fromWarehouse
          const { data, error } = await supabase.rpc('transfer_stock_between_warehouses', {
            p_product_id: item.productId,
            p_from_warehouse_id: toWarehouseId,
            p_to_warehouse_id: fromWarehouseId,
            p_quantity: item.quantity,
            p_reason: 'Reverse internal transfer (deleted)',
            p_user_id: userId
          });
          if (error) throw error;
          if (data && data.length > 0 && !data[0].success) {
            throw new Error(data[0].error_message || 'Reverse transfer RPC failed');
          }
        }
      } else if (
        (type === 'IMPORT' || (type === 'ADJUSTMENT' && reference === 'ADJ+')) &&
        toWarehouseId
      ) {
        const delta = item.quantity * direction;
        const { error } = await supabase.rpc('update_stock_level', {
          p_product_id: item.productId,
          p_warehouse_id: toWarehouseId,
          p_delta: delta,
          p_reason: type === 'IMPORT'
            ? (direction === 1 ? 'Import reception' : 'Import reversed')
            : (direction === 1 ? 'Adjustment +' : 'Adjustment + reversed'),
          p_user_id: userId
        });
        if (error) throw error;
      } else if (type === 'ADJUSTMENT' && reference === 'ADJ-' && toWarehouseId) {
        const delta = item.quantity * direction * -1;  // ADJ- normally decreases
        const { error } = await supabase.rpc('update_stock_level', {
          p_product_id: item.productId,
          p_warehouse_id: toWarehouseId,
          p_delta: delta,
          p_reason: direction === 1 ? 'Adjustment -' : 'Adjustment - reversed',
          p_user_id: userId
        });
        if (error) throw error;
      }
    }
  };

  const createTransfer = async (transfer: Omit<Transfer, 'id'>) => {
    const { items, ...transferData } = transfer as any;

    // Convert camelCase to snake_case for database columns
    const dbTransferData: any = {
      date: transferData.date,
      type: transferData.type,
      reference: transferData.reference,
      status: transferData.status || 'Completed'
    };

    if (transferData.fromWarehouseId) {
      dbTransferData.from_warehouse_id = transferData.fromWarehouseId;
    }
    if (transferData.toWarehouseId) {
      dbTransferData.to_warehouse_id = transferData.toWarehouseId;
    }
    if (transferData.reason) {
      dbTransferData.reason = transferData.reason;
    }
    if (transferData.createdBy) {
      dbTransferData.created_by = transferData.createdBy;
    }
    if (transferData.companyId !== undefined) {
      dbTransferData.company_id = transferData.companyId;
    }

    // 1. Insert the transfer record
    const { data: newTransfer, error: transferError } = await supabase
      .from('transfers')
      .insert([dbTransferData])
      .select()
      .single();

    if (transferError) throw transferError;

    // 2. Insert transfer items
    if (items && items.length > 0) {
      const transferItems = items.map((item: any) => ({
        transfer_id: newTransfer.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        boxes_entered: item.boxesEntered ?? null,
        loose_entered: item.looseEntered ?? null,
      }));

      const { error: itemsError } = await supabase
        .from('transfer_items')
        .insert(transferItems);

      if (itemsError) throw itemsError;

      // DB trigger was removed (migration add-transfer-stock-trigger.sql).
      // Stock is now updated app-side via applyStockUpdate, same logic as deleteTransfer.
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (userId) {
        await applyStockUpdate(
          transferData.type,
          transferData.reference || '',
          transferData.fromWarehouseId,
          transferData.toWarehouseId,
          items.map((item: any) => ({ productId: item.productId, quantity: item.quantity })),
          userId,
          1
        );
      }
    }

    await fetchTransfers();
    return newTransfer;
  };

  const deleteTransfer = async (id: string) => {
    // 1. Fetch the transfer + items before deleting, to reverse stock
    const { data: transferData } = await supabase
      .from('transfers')
      .select('type, reference, from_warehouse_id, to_warehouse_id')
      .eq('id', id)
      .single();

    const { data: transferItems } = await supabase
      .from('transfer_items')
      .select('product_id, quantity')
      .eq('transfer_id', id);

    // 2. Reverse the stock changes
    if (transferData && transferItems && transferItems.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (userId) {
        try {
          await applyStockUpdate(
            transferData.type,
            transferData.reference || '',
            transferData.from_warehouse_id,
            transferData.to_warehouse_id,
            transferItems.map((i: any) => ({ productId: i.product_id, quantity: i.quantity })),
            userId,
            -1
          );
        } catch (err) {
          logger.warn('Could not fully reverse stock on transfer delete', err);
        }
      }
    }

    // 3. Delete transfer items then the transfer record
    const { error: itemsError } = await supabase
      .from('transfer_items')
      .delete()
      .eq('transfer_id', id);

    if (itemsError) throw itemsError;

    const { error: deleteError } = await supabase
      .from('transfers')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    setTransfers(prev => prev.filter(t => t.id !== id));
  };

  /**
   * Preview what would change if recalibration is applied.
   * Read-only — safe to call without side effects.
   * Returns rows where stock_levels differs from the sum of all movements
   * (transfers + sales + returns).
   */
  const previewStockRecalibration = async (): Promise<StockRecalibratePreviewRow[]> => {
    const { data, error } = await supabase.rpc('recalibrate_stock_preview');
    if (error) throw error;
    return (data || []) as StockRecalibratePreviewRow[];
  };

  /**
   * Apply full stock recalibration: corrects stock_levels to match the sum of
   * all movements (transfers + sales + returns) and writes an audit log entry.
   * Admin only — enforced server-side by user_is_admin() guard.
   */
  const applyStockRecalibration = async (): Promise<string> => {
    const { data, error } = await supabase.rpc('recalibrate_stock_apply');
    if (error) throw error;
    return data as string;
  };

  return {
    transfers,
    loading,
    error,
    createTransfer,
    deleteTransfer,
    previewStockRecalibration,
    applyStockRecalibration,
    refresh: fetchTransfers,
  };
}

// RETURNS HOOK
export function useReturns() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeCompanyId = useStore(s => s.activeCompanyId);

  const fetchReturns = async () => {
    try {
      setLoading(true);

      // returns table has no company_id column — fetch all and filter client-side if needed
      const { data, error: fetchError } = await retryOnColdStart(() =>
        supabase
          .from('returns')
          .select(`
            id,
            date,
            original_sale_id,
            customer_id,
            customer_name,
            warehouse_id,
            reason,
            created_by,
            created_at,
            return_items (
              id,
              product_id,
              product_name,
              quantity
            )
          `)
          .order('date', { ascending: false })
      );

      if (fetchError) throw fetchError;

      // Use toReturn helper to convert DB types (snake_case) to App types (camelCase)
      // Cast to any to handle incomplete return_items from query (missing return_id, created_at)
      const transformedReturns = (data || []).map((ret: any) =>
        toReturn(ret as DbReturn, (ret.return_items || []) as DbReturnItem[])
      );

      setReturns(transformedReturns);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching returns', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReturns(); }, [activeCompanyId]);

  /**
   * Creates a product return against an original sale.
   * Steps: 1) Insert return record, 2) Insert return items, 3) Restore stock,
   * 4) Calculate credited amount from original item prices, 5) Update sale status.
   * @param returnData - Return data including items, originalSaleId, and reason
   * @throws Error if database operations fail
   */
  const createReturn = async (returnData: Omit<Return, 'id'>) => {
    // Extract ALL values to local variables FIRST
    // This prevents Supabase from ever seeing the original camelCase object
    const items = (returnData as any).items;
    const customerId = (returnData as any).customerId;
    const customerName = (returnData as any).customerName;
    const originalSaleId = (returnData as any).originalSaleId;
    const warehouseId = (returnData as any).warehouseId;
    const reason = (returnData as any).reason;
    const date = (returnData as any).date;
    const companyId = (returnData as any).companyId;

    // Create a clean object with ONLY snake_case properties for database
    const returnInfo: any = {
      customer_id: customerId,
      customer_name: customerName,
      original_sale_id: originalSaleId,
      warehouse_id: warehouseId,
      reason: reason,
      date: date
    };

    // Add company_id if provided
    if (companyId !== undefined) {
      returnInfo.company_id = companyId;
    }

    // Step 1: Create the return record
    const { data: newReturn, error: returnError } = await supabase
      .from('returns')
      .insert([returnInfo])
      .select('id, date, customer_id, customer_name, original_sale_id, warehouse_id, reason')
      .single();

    if (returnError) throw returnError;

    // Step 2: Create return items
    if (items && items.length > 0) {
      const returnItems = items.map((item: any) => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        return_id: newReturn.id
      }));

      const { error: itemsError } = await supabase
        .from('return_items')
        .insert(returnItems);

      if (itemsError) throw itemsError;

      // Step 3: Fetch the original sale to get item prices and sell modes
      const { data: originalSale, error: saleError } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('id', originalSaleId)
        .single();

      if (saleError) throw new Error(`Error fetching original sale for return: ${saleError.message}`);

      // Step 4: Restore stock for each returned item
      // Stock is stored in individual units (post-migration). Box-mode sales deducted quantity×packSize
      // units, so returns must restore quantity×packSize units for box-mode items.
      const { data: { session } } = await supabase.auth.getSession();
      const returnUserId = session?.user?.id ?? null;
      for (const item of items) {
        const originalItem = originalSale.sale_items?.find(
          (si: any) => si.product_id === item.productId
        );
        const sellMode = originalItem?.sell_mode || 'unit';
        const unitsPerBox = originalItem?.units_per_box || 1;
        const deltaUnits = sellMode === 'box' ? item.quantity * unitsPerBox : item.quantity;
        const { error: stockError } = await supabase.rpc('update_stock_level', {
          p_product_id: item.productId,
          p_warehouse_id: warehouseId,
          p_delta: deltaUnits, // positive = restore stock, converted to individual units
          p_reason: `Return: ${reason}`,
          p_user_id: returnUserId
        });

        if (stockError) {
          throw new Error(`Error restoring stock for product ${item.productId}: ${stockError.message}`);
        }
      }

      // Step 5: Calculate credited amount and update the original sale
      let totalCreditedAmount = 0;
      items.forEach((returnItem: any) => {
        const originalItem = originalSale.sale_items?.find(
          (si: any) => si.product_id === returnItem.productId
        );
        if (originalItem) {
          const itemTotal = originalItem.total || 0;
          const itemQuantity = originalItem.quantity || 1;
          const creditPerUnit = Math.round((itemTotal / itemQuantity) * 100) / 100;
          const lineCredit = Math.round(creditPerUnit * returnItem.quantity * 100) / 100;
          totalCreditedAmount += lineCredit;
        }
      });
      totalCreditedAmount = Math.round(totalCreditedAmount * 100) / 100;

      // Update the sale's credited_amount
      const newCreditedAmount = Math.round(((originalSale.credited_amount || 0) + totalCreditedAmount) * 100) / 100;

      // Recalculate payment status
      const amountPaid = originalSale.amount_paid || 0;
      const totalAmount = originalSale.total_amount || 0;
      const remaining = Math.round((totalAmount - amountPaid - newCreditedAmount) * 100) / 100;

      let newPaymentStatus = originalSale.payment_status;
      if (remaining <= 0) {
        newPaymentStatus = 'Paid';
      } else if (amountPaid > 0 || newCreditedAmount > 0) {
        newPaymentStatus = 'Partial';
      }

      // Determine return_status by comparing total returned qty vs original qty per product
      const { data: saleReturnIds } = await supabase
        .from('returns')
        .select('id')
        .eq('original_sale_id', originalSaleId);

      let newReturnStatus: 'full' | 'partial' = 'partial';
      const returnIds = (saleReturnIds || []).map((r: any) => r.id);
      if (returnIds.length > 0) {
        const { data: allReturnedItems } = await supabase
          .from('return_items')
          .select('product_id, quantity')
          .in('return_id', returnIds);

        const returnedByProduct: Record<string, number> = {};
        for (const ri of allReturnedItems || []) {
          const pid = (ri as any).product_id;
          returnedByProduct[pid] = (returnedByProduct[pid] || 0) + (ri as any).quantity;
        }

        const saleItemsList = originalSale.sale_items || [];
        const allFullyReturned = saleItemsList.length > 0 && saleItemsList.every(
          (si: any) => (returnedByProduct[si.product_id] || 0) >= si.quantity
        );
        newReturnStatus = allFullyReturned ? 'full' : 'partial';
      }

      // Full return: void all payments (check returned to client, cash refunded)
      if (newReturnStatus === 'full') {
        await supabase.from('payments').delete().eq('sale_id', originalSaleId);
      }

      const { error: updateSaleError } = await supabase
        .from('sales')
        .update({
          credited_amount: newCreditedAmount,
          payment_status: 'Paid',
          return_status: newReturnStatus,
          amount_paid: newReturnStatus === 'full' ? 0 : originalSale.amount_paid,
        })
        .eq('id', originalSaleId);

      if (updateSaleError) {
        throw new Error(`Error updating sale credited_amount: ${updateSaleError.message}`);
      }
    }

    await fetchReturns();
    return newReturn;
  };

  const deleteReturn = async (returnId: string) => {
    // Step 1: Fetch return details BEFORE deleting (need warehouse_id, items, original_sale_id)
    const { data: returnRecord, error: fetchReturnError } = await supabase
      .from('returns')
      .select('id, original_sale_id, warehouse_id, return_items ( product_id, quantity )')
      .eq('id', returnId)
      .single();

    if (fetchReturnError) {
      throw new Error(`Error fetching return details: ${fetchReturnError.message}`);
    }

    const warehouseId = (returnRecord as any).warehouse_id;
    const originalSaleId = (returnRecord as any).original_sale_id;
    const returnItems: Array<{ product_id: string; quantity: number }> = (returnRecord as any).return_items || [];

    // Step 2: Delete return_items then the return record
    const { error: itemsError } = await supabase
      .from('return_items')
      .delete()
      .eq('return_id', returnId);

    if (itemsError) {
      throw new Error(`Error deleting return items: ${itemsError.message}`);
    }

    const { error: returnError } = await supabase
      .from('returns')
      .delete()
      .eq('id', returnId);

    if (returnError) {
      throw new Error(`Error deleting return: ${returnError.message}`);
    }

    // Step 3: Deduct stock (undo the restoration done by createReturn)
    // Must fetch original sale first to determine sell_mode per item (same logic as createReturn).
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;

    // Step 4: Recalculate and update the original sale (fetched here, reused for stock step)
    if (originalSaleId) {
      const { data: originalSale, error: saleError } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .eq('id', originalSaleId)
        .single();

      if (!saleError && originalSale) {
        // Step 3 (inside original sale context): deduct stock — mirror createReturn's sell_mode logic
        for (const item of returnItems) {
          const originalItem = (originalSale.sale_items || []).find(
            (si: any) => si.product_id === item.product_id
          );
          const sellMode = originalItem?.sell_mode || 'unit';
          const unitsPerBox = originalItem?.units_per_box || 1;
          const deltaUnits = sellMode === 'box' ? item.quantity * unitsPerBox : item.quantity;
          const { error: stockError } = await supabase.rpc('update_stock_level', {
            p_product_id: item.product_id,
            p_warehouse_id: warehouseId,
            p_delta: -deltaUnits,
            p_reason: `Return deleted`,
            p_user_id: userId
          });
          if (stockError) {
            logger.error(`Error deducting stock for product ${item.product_id} after return deletion`, stockError);
          }
        }

        // Subtract credit that belonged to this deleted return
        let creditToRemove = 0;
        for (const item of returnItems) {
          const originalItem = (originalSale.sale_items || []).find(
            (si: any) => si.product_id === item.product_id
          );
          if (originalItem) {
            const creditPerUnit = Math.round(((originalItem.total || 0) / (originalItem.quantity || 1)) * 100) / 100;
            creditToRemove += Math.round(creditPerUnit * item.quantity * 100) / 100;
          }
        }
        creditToRemove = Math.round(creditToRemove * 100) / 100;

        const newCreditedAmount = Math.max(0, Math.round(((originalSale.credited_amount || 0) - creditToRemove) * 100) / 100);
        const amountPaid = originalSale.amount_paid || 0;
        const totalAmount = originalSale.total_amount || 0;
        const remaining = Math.round((totalAmount - amountPaid - newCreditedAmount) * 100) / 100;

        let newPaymentStatus = originalSale.payment_status;
        if (remaining <= 0) {
          newPaymentStatus = 'Paid';
        } else if (amountPaid > 0 || newCreditedAmount > 0) {
          newPaymentStatus = 'Partial';
        } else {
          newPaymentStatus = 'Unpaid';
        }

        // Recompute return_status based on remaining returns (this one is now deleted)
        const { data: remainingReturnIds } = await supabase
          .from('returns')
          .select('id')
          .eq('original_sale_id', originalSaleId);

        let newReturnStatus: 'full' | 'partial' | null = null;
        const remainingIds = (remainingReturnIds || []).map((r: any) => r.id);
        if (remainingIds.length > 0) {
          const { data: remainingItems } = await supabase
            .from('return_items')
            .select('product_id, quantity')
            .in('return_id', remainingIds);

          const returnedByProduct: Record<string, number> = {};
          for (const ri of remainingItems || []) {
            const pid = (ri as any).product_id;
            returnedByProduct[pid] = (returnedByProduct[pid] || 0) + (ri as any).quantity;
          }
          const allFullyReturned = (originalSale.sale_items || []).every(
            (si: any) => (returnedByProduct[si.product_id] || 0) >= si.quantity
          );
          newReturnStatus = allFullyReturned ? 'full' : 'partial';
        }
        // null = no returns remaining

        await supabase
          .from('sales')
          .update({ credited_amount: newCreditedAmount, payment_status: newPaymentStatus, return_status: newReturnStatus })
          .eq('id', originalSaleId);
      }
    }

    // Step 5: Update local state
    setReturns(prev => prev.filter(r => r.id !== returnId));
  };

  return { returns, loading, error, createReturn, deleteReturn, refresh: fetchReturns };
}

// AUDIT LOGS HOOK
export function useAuditLogs() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);

      // Obtener logs de auditoría
      const { data: logsData, error: fetchError } = await retryOnColdStart(() =>
        supabase
          .from('audit_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(500)
      );

      if (fetchError) throw fetchError;

      // Obtener todos los perfiles para mapear user_id a nombre
      const { data: profilesData } = await retryOnColdStart(() =>
        supabase.from('profiles').select('id, name, role')
      );

      // Crear mapa de userId -> perfil
      const profilesMap = new Map<string, { name: string; role: string }>();
      (profilesData || []).forEach((profile: any) => {
        profilesMap.set(profile.id, { name: profile.name, role: profile.role });
      });

      // Transformar los datos para incluir userName y userRole
      const transformedLogs: AuditLogEntry[] = (logsData || []).map((log: any) => {
        const profile = profilesMap.get(log.user_id);
        return {
          id: log.id,
          timestamp: log.timestamp,
          userId: log.user_id,
          userName: profile?.name || 'Usuario desconocido',
          userRole: (profile?.role || 'Sales') as UserRole,
          action: log.action,
          entity: log.entity,
          entityId: log.entity_id,
          details: log.details,
        };
      });

      setAuditLogs(transformedLogs);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching audit logs', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAuditLogs(); }, []);

  const addAuditLog = async (log: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const { data, error: insertError} = await supabase
      .from('audit_logs')
      .insert([log])
      .select()
      .single();

    if (insertError) throw insertError;

    setAuditLogs(prev => [data, ...prev]);
    return data;
  };

  return { auditLogs, loading, error, addAuditLog, refresh: fetchAuditLogs };
}

// USERS HOOK
export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await retryOnColdStart(() =>
        supabase
          .from('profiles')
          .select('*')
          .order('name', { ascending: true })
      );

      if (fetchError) throw fetchError;

      // Transform profiles to User type
      const usersData: User[] = (data || []).map((profile: any) => ({
        id: profile.id,
        name: profile.name,
        role: profile.role,
        email: profile.email || '',
        warehouseId: profile.warehouse_id || null,
        companyId: profile.company_id || null,
        lastActive: profile.last_active || new Date().toISOString()
      }));

      setUsers(usersData);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching users', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const addUser = async (user: Omit<User, 'id'> & { password?: string }) => {
    // Verificar que se proporcione una contraseña
    if (!user.password) {
      throw new Error('Se requiere una contraseña para crear un nuevo usuario');
    }

    // Obtener el token de sesión actual
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No hay sesión activa');
    }

    // Llamar a la Edge Function para crear el usuario
    const requestBody = {
      email: user.email,
      password: user.password,
      name: user.name,
      role: user.role,
      warehouse_id: user.warehouseId || null,
      company_id: user.companyId || null
    };
    logger.debug('Creating user', { email: requestBody.email, role: requestBody.role });

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: requestBody
    });

    // Mejor manejo de errores para mostrar el mensaje real
    if (error) {
      console.error('Edge function error:', error);
      // El error puede venir en diferentes formatos
      const errorMessage = error.message || (error as any).error || JSON.stringify(error);
      throw new Error(errorMessage);
    }

    if (!data) {
      throw new Error('No se recibió respuesta del servidor');
    }

    if (!data.success) {
      throw new Error(data.error || 'Error al crear usuario');
    }

    const newUser: User = data.user;
    setUsers(prev => [...prev, newUser]);
    return newUser;
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    const profileUpdates: any = {};
    if (updates.name !== undefined) profileUpdates.name = updates.name;
    if (updates.role !== undefined) profileUpdates.role = updates.role;
    if (updates.email !== undefined) profileUpdates.email = updates.email;
    if (updates.warehouseId !== undefined) profileUpdates.warehouse_id = updates.warehouseId;
    if (updates.companyId !== undefined) profileUpdates.company_id = updates.companyId;
    if (updates.lastActive !== undefined) profileUpdates.last_active = updates.lastActive;

    // Primero, verificar que el perfil existe y tenemos permisos
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new Error(`No se pudo encontrar el perfil: ${fetchError.message}`);
    }

    // Realizar la actualización
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      logger.error('Error actualizando perfil', updateError);
      throw new Error(`Error al actualizar el usuario: ${updateError.message}`);
    }

    if (!data) {
      throw new Error('No se pudo actualizar el perfil. Verifica tus permisos.');
    }

    const updatedUser: User = {
      id: data.id,
      name: data.name,
      role: data.role,
      email: data.email || '',
      companyId: data.company_id || null,
      warehouseId: data.warehouse_id || null,
      lastActive: data.last_active
    };

    setUsers(prev => prev.map(u => u.id === id ? updatedUser : u));
    return updatedUser;
  };

  const deleteUser = async (id: string) => {
    // Use RPC function (SECURITY DEFINER) to delete profile + auth.users
    const { error: rpcError } = await supabase.rpc('delete_user_by_admin', {
      target_user_id: id,
    });

    if (rpcError) {
      logger.error('Error eliminando usuario', rpcError);
      throw new Error(rpcError.message || 'Error al eliminar usuario');
    }

    setUsers(prev => prev.filter(u => u.id !== id));
  };

  return { users, loading, error, addUser, updateUser, deleteUser, refresh: fetchUsers };
}

// ==================== STOCK MIGRATION ====================

/**
 * One-time migration: converts stock from boxes to individual units.
 * Multiplies each warehouse stock value by the product's packSize.
 * Should only be called once by an Admin after enabling unit-based selling.
 */
export async function migrateStockToUnits(
  products: import('../types').Product[],
  userId: string
): Promise<{ success: number; skipped: number; errors: number }> {
  let success = 0, skipped = 0, errors = 0;

  for (const product of products) {
    const unitsPerBox = product.unitsPerBox || 1;
    if (unitsPerBox <= 1) { skipped++; continue; } // Nothing to migrate

    for (const [warehouseId, currentQty] of Object.entries(product.stockLevels || {})) {
      if (!currentQty || currentQty === 0) { skipped++; continue; }

      // delta = current boxes × (unitsPerBox - 1) to reach total units
      // e.g. 3 boxes × unitsPerBox 12 → add 3×(12-1)=33 → reach 36 units
      const delta = currentQty * (unitsPerBox - 1);
      if (delta === 0) { skipped++; continue; }

      const { error } = await supabase.rpc('update_stock_level', {
        p_product_id: product.id,
        p_warehouse_id: warehouseId,
        p_delta: delta,
        p_reason: 'Migración: stock cajas → unidades individuales',
        p_user_id: userId,
      });

      if (error) {
        logger.error(`Migration error for product ${product.id}:`, error);
        errors++;
      } else {
        success++;
      }
    }
  }

  return { success, skipped, errors };
}

// ==================== APP SETTINGS (cloud key-value store) ====================

/**
 * Reads a global app setting from Supabase.
 * Supabase is always the source of truth — localStorage is only a fallback on network error.
 * Starts as null (not migrated) until Supabase responds to avoid stale-cache bugs.
 */
export function useAppSetting(key: string): { value: string | null; loading: boolean } {
  // Initialise from localStorage synchronously so consumers never see a false-null flash
  const [value, setValue] = useState<string | null>(() => localStorage.getItem(`app_setting_${key}`));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', key)
          .maybeSingle();
        if (cancelled) return;
        const serverVal = data?.value ?? null;
        setValue(serverVal);
        if (serverVal !== null) {
          localStorage.setItem(`app_setting_${key}`, serverVal);
        } else {
          localStorage.removeItem(`app_setting_${key}`);
        }
      } catch {
        // Network error — fall back to localStorage so the app still works offline
        const cached = localStorage.getItem(`app_setting_${key}`);
        if (!cancelled && cached !== null) setValue(cached);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  return { value, loading };
}

/**
 * Writes a global app setting to Supabase and updates the local cache.
 * Requires Admin role (enforced by RLS).
 */
export async function setAppSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
  localStorage.setItem(`app_setting_${key}`, value);
}

// WAREHOUSE COMPANIES HOOK (Multi-Tenant Assignments)
export function useWarehouseCompanies() {
  const [warehouseCompanies, setWarehouseCompanies] = useState<WarehouseCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWarehouseCompanies = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await retryOnColdStart(() =>
        supabase
          .from('warehouse_companies')
          .select('*')
          .order('created_at', { ascending: false })
      );

      if (fetchError) throw fetchError;

      // Transform to application format
      const wcData: WarehouseCompany[] = (data || []).map((wc: any) => ({
        id: wc.id,
        warehouseId: wc.warehouse_id,
        companyId: wc.company_id,
        createdAt: wc.created_at,
      }));

      setWarehouseCompanies(wcData);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching warehouse companies', err);
      setError(err);
      setWarehouseCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWarehouseCompanies(); }, []);

  const assignWarehouseToCompany = async (warehouseId: string, companyId: string) => {
    const { data, error: insertError } = await supabase
      .from('warehouse_companies')
      .insert([{
        warehouse_id: warehouseId,
        company_id: companyId
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // Add to local state
    const newAssignment: WarehouseCompany = {
      id: data.id,
      warehouseId: data.warehouse_id,
      companyId: data.company_id,
      createdAt: data.created_at,
    };
    setWarehouseCompanies(prev => [newAssignment, ...prev]);

    return newAssignment;
  };

  const unassignWarehouseFromCompany = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('warehouse_companies')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Remove from local state
    setWarehouseCompanies(prev => prev.filter(wc => wc.id !== id));
  };

  return {
    warehouseCompanies,
    loading,
    error,
    assignWarehouseToCompany,
    unassignWarehouseFromCompany,
    refresh: fetchWarehouseCompanies,
  };
}

// ========== CUSTOMER PRICES ==========
export function useCustomerPrices(customerId?: string) {
  const [prices, setPrices] = useState<CustomerPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrices = async () => {
    if (!customerId) return;
    try {
      setLoading(true);
      const companyId = await getCurrentUserCompanyId();
      const { data, error: fetchError } = await retryOnColdStart(() => {
        let q = supabase.from('customer_prices').select('*').eq('customer_id', customerId);
        if (companyId) q = q.eq('company_id', companyId);
        return q;
      });

      if (fetchError) throw fetchError;

      const mapped: CustomerPrice[] = (data || []).map((row: any) => ({
        id: row.id,
        customerId: row.customer_id,
        productId: row.product_id,
        specialPrice: row.special_price,
        discountPercentage: row.discount_percentage,
        notes: row.notes,
      }));
      setPrices(mapped);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching customer prices', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPrices(); }, [customerId]);

  const addPrice = async (price: Omit<CustomerPrice, 'id'>) => {
    const companyId = await getCurrentUserCompanyId();
    const { error } = await supabase.from('customer_prices').insert({
      company_id: companyId,
      customer_id: price.customerId,
      product_id: price.productId,
      special_price: price.specialPrice || null,
      discount_percentage: price.discountPercentage || null,
      notes: price.notes || null,
    });
    if (error) throw error;
    await fetchPrices();
  };

  const updatePrice = async (id: string, updates: Partial<CustomerPrice>) => {
    const payload: any = {};
    if (updates.specialPrice !== undefined) payload.special_price = updates.specialPrice;
    if (updates.discountPercentage !== undefined) payload.discount_percentage = updates.discountPercentage;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { error } = await supabase.from('customer_prices').update(payload).eq('id', id);
    if (error) throw error;
    await fetchPrices();
  };

  const deletePrice = async (id: string) => {
    const { error } = await supabase.from('customer_prices').delete().eq('id', id);
    if (error) throw error;
    await fetchPrices();
  };

  return { prices, loading, error, addPrice, updatePrice, deletePrice, refresh: fetchPrices };
}

// ========== SUPPLIERS ==========
export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeCompanyId = useStore(s => s.activeCompanyId);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const companyId = await getCurrentUserCompanyId();
      const { data, error: fetchError } = await retryOnColdStart(() => {
        let q = supabase.from('suppliers').select('*').order('name');
        if (companyId) q = q.eq('company_id', companyId);
        return q;
      });

      if (fetchError) throw fetchError;

      const mapped: Supplier[] = (data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        contactPerson: s.contact_person,
        email: s.email,
        phone: s.phone,
        address: s.address,
        city: s.city,
        ice: s.ice,
        taxId: s.tax_id,
        status: s.status || 'Active',
        notes: s.notes,
      }));
      setSuppliers(mapped);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching suppliers', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, [activeCompanyId]);

  const addSupplier = async (supplier: Omit<Supplier, 'id'>) => {
    const companyId = await getCurrentUserCompanyId();
    const { error } = await supabase.from('suppliers').insert({
      company_id: companyId,
      name: supplier.name,
      contact_person: supplier.contactPerson || null,
      email: supplier.email || null,
      phone: supplier.phone || null,
      address: supplier.address || null,
      city: supplier.city || null,
      ice: supplier.ice || null,
      tax_id: supplier.taxId || null,
      status: supplier.status || 'Active',
      notes: supplier.notes || null,
    });
    if (error) throw error;
    await fetchSuppliers();
  };

  const updateSupplier = async (id: string, supplier: Partial<Supplier>) => {
    const payload: any = {};
    if (supplier.name !== undefined) payload.name = supplier.name;
    if (supplier.contactPerson !== undefined) payload.contact_person = supplier.contactPerson;
    if (supplier.email !== undefined) payload.email = supplier.email;
    if (supplier.phone !== undefined) payload.phone = supplier.phone;
    if (supplier.address !== undefined) payload.address = supplier.address;
    if (supplier.city !== undefined) payload.city = supplier.city;
    if (supplier.ice !== undefined) payload.ice = supplier.ice;
    if (supplier.taxId !== undefined) payload.tax_id = supplier.taxId;
    if (supplier.status !== undefined) payload.status = supplier.status;
    if (supplier.notes !== undefined) payload.notes = supplier.notes;

    const { error } = await supabase.from('suppliers').update(payload).eq('id', id);
    if (error) throw error;
    await fetchSuppliers();
  };

  const deleteSupplier = async (id: string) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    await fetchSuppliers();
  };

  return { suppliers, loading, error, addSupplier, updateSupplier, deleteSupplier, refresh: fetchSuppliers };
}

// ========== PURCHASE ORDERS ==========
export function usePurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeCompanyId = useStore(s => s.activeCompanyId);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const companyId = await getCurrentUserCompanyId();
      const { data, error: fetchError } = await retryOnColdStart(() => {
        let q = supabase.from('purchase_orders').select('*').order('date', { ascending: false });
        if (companyId) q = q.eq('company_id', companyId);
        return q;
      });

      if (fetchError) throw fetchError;

      const mapped: PurchaseOrder[] = (data || []).map((po: any) => ({
        id: po.id,
        reference: po.reference,
        supplierId: po.supplier_id,
        supplierName: po.supplier_name,
        warehouseId: po.warehouse_id,
        date: po.date,
        expectedDate: po.expected_date,
        status: po.status,
        items: (po.items || []).map((item: any) => ({
          productId: item.product_id || item.productId,
          productName: item.product_name || item.productName,
          quantity: item.quantity,
          unitCost: item.unit_cost || item.unitCost,
          total: item.total,
        })),
        totalAmount: po.total_amount,
        notes: po.notes,
      }));
      setOrders(mapped);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching purchase orders', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [activeCompanyId]);

  const addOrder = async (order: Omit<PurchaseOrder, 'id'>) => {
    const companyId = await getCurrentUserCompanyId();
    const { error } = await supabase.from('purchase_orders').insert({
      company_id: companyId,
      reference: order.reference,
      supplier_id: order.supplierId,
      supplier_name: order.supplierName,
      warehouse_id: order.warehouseId,
      date: order.date,
      expected_date: order.expectedDate || null,
      status: order.status,
      items: order.items.map(item => ({
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        total: item.total,
      })),
      total_amount: order.totalAmount,
      notes: order.notes || null,
    });
    if (error) throw error;
    await fetchOrders();
  };

  const updateOrderStatus = async (id: string, status: PurchaseOrder['status']) => {
    const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', id);
    if (error) throw error;
    await fetchOrders();
  };

  const deleteOrder = async (id: string) => {
    const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
    if (error) throw error;
    await fetchOrders();
  };

  return { orders, loading, error, addOrder, updateOrderStatus, deleteOrder, refresh: fetchOrders };
}

// COMPANIES HOOK — persistent server-side company profiles
export function useCompanies() {
  const [companies, setCompanies] = useState<import('../types').CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await retryOnColdStart(() =>
        supabase
          .from('companies')
          .select('*')
          .order('name', { ascending: true })
      );

      if (fetchError) throw fetchError;

      const profiles: import('../types').CompanyProfile[] = (data || []).map((row: any) => ({
        id: row.id,
        profileName: row.name,
        settings: {
          name: row.full_name || row.name,
          address: row.address || '',
          city: row.city || '',
          country: row.country || '',
          phone: row.phone || '',
          email: row.email || '',
          website: row.website || '',
          ice: row.ice || '',
          rc: row.rc || '',
          if: row.if_number || '',
          cnss: row.cnss || '',
          patente: row.patente || '',
          capital: row.capital || '',
          bankName: row.bank_name || '',
          rib: row.rib || '',
          defaultTaxRate: parseFloat(row.default_tax_rate) || 0.20,
          currencySymbol: row.currency_symbol || 'DH',
          logoBase64: row.logo || undefined,
          signatureBase64: row.signature || undefined,
          tierConfigs: row.tier_configs || undefined,
          volumeTiers: row.volume_tiers || undefined,
          volumeDiscountEnabled: row.volume_discount_enabled ?? false,
        }
      }));

      setCompanies(profiles);
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching companies', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, []);

  const addCompany = async (profile: import('../types').CompanyProfile) => {
    const { error: insertError } = await supabase.from('companies').insert([{
      id: profile.id,
      name: profile.profileName,
      full_name: profile.settings.name,
      address: profile.settings.address,
      city: profile.settings.city,
      country: profile.settings.country,
      phone: profile.settings.phone,
      email: profile.settings.email,
      website: profile.settings.website,
      ice: profile.settings.ice,
      rc: profile.settings.rc,
      if_number: profile.settings.if,
      cnss: profile.settings.cnss,
      patente: profile.settings.patente,
      capital: profile.settings.capital,
      bank_name: profile.settings.bankName,
      rib: profile.settings.rib,
      default_tax_rate: profile.settings.defaultTaxRate,
      currency_symbol: profile.settings.currencySymbol || 'DH',
      logo: profile.settings.logoBase64 || null,
      signature: profile.settings.signatureBase64 || null,
      tier_configs: profile.settings.tierConfigs || null,
    }]);
    if (insertError) throw insertError;
    await fetchCompanies();
  };

  const updateCompany = async (profileId: string, profile: import('../types').CompanyProfile) => {
    const { error: updateError } = await supabase.from('companies').update({
      name: profile.profileName,
      full_name: profile.settings.name,
      address: profile.settings.address,
      city: profile.settings.city,
      country: profile.settings.country,
      phone: profile.settings.phone,
      email: profile.settings.email,
      website: profile.settings.website,
      ice: profile.settings.ice,
      rc: profile.settings.rc,
      if_number: profile.settings.if,
      cnss: profile.settings.cnss,
      patente: profile.settings.patente,
      capital: profile.settings.capital,
      bank_name: profile.settings.bankName,
      rib: profile.settings.rib,
      default_tax_rate: profile.settings.defaultTaxRate,
      currency_symbol: profile.settings.currencySymbol || 'DH',
      logo: profile.settings.logoBase64 || null,
      signature: profile.settings.signatureBase64 || null,
      tier_configs: profile.settings.tierConfigs || null,
      volume_tiers: profile.settings.volumeTiers || null,
      volume_discount_enabled: profile.settings.volumeDiscountEnabled ?? false,
    }).eq('id', profileId);
    if (updateError) throw updateError;
    await fetchCompanies();
  };

  const deleteCompany = async (profileId: string) => {
    const { error } = await supabase.rpc('admin_delete_company', { target_company_id: profileId });
    if (error) throw error;
    await fetchCompanies();
  };

  return { companies, loading, error, addCompany, updateCompany, deleteCompany, refresh: fetchCompanies };
}

// CHARGES (EXPENSES) HOOK
export function useCharges() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const activeCompanyId = useStore(s => s.activeCompanyId);

  const fetchCharges = useCallback(async () => {
    try {
      setLoading(true);
      const companyId = await getCurrentUserCompanyId();
      let query = supabase.from('charges').select('*').order('date', { ascending: false });
      query = applyCompanyFilter(query, companyId);
      const { data, error: fetchError } = await query;
      if (fetchError) {
        if (fetchError.code === 'PGRST301' || fetchError.message?.includes('JWT')) {
          logger.warn('Session expired while fetching charges');
          return;
        }
        throw fetchError;
      }
      setCharges((data || []).map((c: any) => ({
        id: c.id,
        date: c.date,
        category: c.category,
        description: c.description,
        amountHT: c.amount_ht,
        taxRate: c.tax_rate,
        amountTTC: c.amount_ttc,
        paymentMethod: c.payment_method,
        reference: c.reference || undefined,
        supplierId: c.supplier_id || undefined,
        createdBy: c.created_by || undefined,
        companyId: c.company_id || undefined,
        createdAt: c.created_at,
      })));
      setError(null);
    } catch (err: any) {
      logger.error('Error fetching charges', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => { fetchCharges(); }, [fetchCharges]);
  useRealtimeTable('charges', fetchCharges);

  const addCharge = async (charge: Omit<Charge, 'id' | 'createdAt'>) => {
    const companyId = await getCurrentUserCompanyId();
    const { error: insertError } = await supabase.from('charges').insert([{
      date: charge.date,
      category: charge.category,
      description: charge.description,
      amount_ht: charge.amountHT,
      tax_rate: charge.taxRate,
      amount_ttc: charge.amountTTC,
      payment_method: charge.paymentMethod,
      reference: charge.reference || null,
      supplier_id: charge.supplierId || null,
      created_by: charge.createdBy || null,
      company_id: companyId,
    }]);
    if (insertError) throw insertError;
    await fetchCharges();
  };

  const updateCharge = async (id: string, updates: Partial<Charge>) => {
    const chargeUpdates: any = {};
    if (updates.date !== undefined) chargeUpdates.date = updates.date;
    if (updates.category !== undefined) chargeUpdates.category = updates.category;
    if (updates.description !== undefined) chargeUpdates.description = updates.description;
    if (updates.amountHT !== undefined) chargeUpdates.amount_ht = updates.amountHT;
    if (updates.taxRate !== undefined) chargeUpdates.tax_rate = updates.taxRate;
    if (updates.amountTTC !== undefined) chargeUpdates.amount_ttc = updates.amountTTC;
    if (updates.paymentMethod !== undefined) chargeUpdates.payment_method = updates.paymentMethod;
    if (updates.reference !== undefined) chargeUpdates.reference = updates.reference || null;
    if (updates.supplierId !== undefined) chargeUpdates.supplier_id = updates.supplierId || null;
    const { error: updateError } = await supabase.from('charges').update(chargeUpdates).eq('id', id);
    if (updateError) throw updateError;
    await fetchCharges();
  };

  const deleteCharge = async (id: string) => {
    const { error: deleteError } = await supabase.from('charges').delete().eq('id', id);
    if (deleteError) throw deleteError;
    await fetchCharges();
  };

  return { charges, loading, error, addCharge, updateCharge, deleteCharge, refresh: fetchCharges };
}
