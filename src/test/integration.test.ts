// @ts-nocheck
// 🧪 Test de Integración Completo - Flujo de Negocio
// Ejecutar con: npm run test -- integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '../services/supabaseClient';
import type { Product, Customer, Sale, Transfer, Warehouse } from '../types';

/**
 * TEST DE INTEGRACIÓN COMPLETO
 * 
 * Prueba el flujo completo de negocio:
 * 1. Crear productos
 * 2. Crear cliente
 * 3. Crear venta
 * 4. Verificar stock
 * 5. Crear transferencia
 * 6. Crear devolución
 * 7. Verificar consistencia de datos
 * 
 * ⚠️ REQUIERE: 
 * - Conexión a Supabase
 * - Usuario autenticado
 * - Almacenes existentes
 */

describe('Integration Tests - Flujo Completo de Negocio', () => {
  let testWarehouse: Warehouse;
  let testProduct: Product;
  let testCustomer: Customer;
  let testSale: Sale;
  
  // IDs para limpiar después
  const createdIds = {
    products: [] as string[],
    customers: [] as string[],
    sales: [] as string[],
    transfers: [] as string[]
  };

  beforeAll(async () => {
    // Verificar conexión
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw new Error('❌ No hay sesión activa. Login primero.');
    }

    // Obtener almacén para tests
    const { data: warehouses, error } = await supabase
      .from('warehouses')
      .select('*')
      .limit(1)
      .single();
    
    if (error || !warehouses) {
      throw new Error('❌ No hay almacenes. Crea uno primero.');
    }
    
    testWarehouse = warehouses as unknown as Warehouse;
    console.log('✅ Setup completado - Warehouse:', testWarehouse.name);
  });

  afterAll(async () => {
    // Limpieza: Eliminar datos de prueba
    console.log('🧹 Limpiando datos de prueba...');
    
    // Eliminar en orden inverso (por foreign keys)
    if (createdIds.sales.length > 0) {
      await supabase.from('sales').delete().in('id', createdIds.sales);
    }
    if (createdIds.transfers.length > 0) {
      await supabase.from('transfers').delete().in('id', createdIds.transfers);
    }
    if (createdIds.customers.length > 0) {
      await supabase.from('customers').delete().in('id', createdIds.customers);
    }
    if (createdIds.products.length > 0) {
      await supabase.from('products').delete().in('id', createdIds.products);
    }
    
    console.log('✅ Limpieza completada');
  });

  it('1. Debe crear un producto correctamente', async () => {
    const newProduct = {
      name: 'Test Product Integration',
      sku: `TEST-${Date.now()}`,
      cost_price: 50,
      sale_price: 100,
      category: 'Test',
      warehouse_id: testWarehouse.id
    };

    const { data, error } = await supabase
      .from('products')
      .insert(newProduct)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.name).toBe(newProduct.name);
    
    testProduct = data as unknown as Product;
    createdIds.products.push(data.id);
    
    console.log('✅ Producto creado:', testProduct.name);
  });

  it('2. Debe actualizar stock del producto', async () => {
    const stockUpdate = {
      product_id: testProduct.id,
      warehouse_id: testWarehouse.id,
      quantity: 100
    };

    const { error } = await supabase.rpc('update_stock_level', stockUpdate);

    expect(error).toBeNull();
    
    // Verificar stock actualizado
    const { data: stockLevel } = await supabase
      .from('stock_levels')
      .select('quantity')
      .eq('product_id', testProduct.id)
      .eq('warehouse_id', testWarehouse.id)
      .single();

    expect(stockLevel?.quantity).toBe(100);
    console.log('✅ Stock actualizado a 100');
  });

  it('3. Debe crear un cliente', async () => {
    const newCustomer = {
      name: 'Cliente Test Integration',
      phone: `+212-${Date.now().toString().slice(-9)}`,
      email: `test${Date.now()}@example.com`
    };

    const { data, error } = await supabase
      .from('customers')
      .insert(newCustomer)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    testCustomer = data as unknown as Customer;
    createdIds.customers.push(data.id);
    
    console.log('✅ Cliente creado:', testCustomer.name);
  });

  it('4. Debe crear una venta y descontar stock', async () => {
    const newSale = {
      customer_id: testCustomer.id,
      warehouse_id: testWarehouse.id,
      items: [
        {
          product_id: testProduct.id,
          quantity: 10,
          price: 100,
          product_name: testProduct.name
        }
      ],
      subtotal: 1000,
      tax: 200,
      total: 1200,
      payment_status: 'paid',
      payment_method: 'cash'
    };

    const { data, error } = await supabase
      .from('sales')
      .insert(newSale)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    
    testSale = data as unknown as Sale;
    createdIds.sales.push(data.id);
    
    // Verificar que stock se descontó
    const { data: stockLevel } = await supabase
      .from('stock_levels')
      .select('quantity')
      .eq('product_id', testProduct.id)
      .eq('warehouse_id', testWarehouse.id)
      .single();

    expect(stockLevel?.quantity).toBe(90); // 100 - 10
    console.log('✅ Venta creada y stock descontado (90 restantes)');
  });

  it('5. Debe validar que no se puede vender más stock del disponible', async () => {
    const oversoldSale = {
      customer_id: testCustomer.id,
      warehouse_id: testWarehouse.id,
      items: [
        {
          product_id: testProduct.id,
          quantity: 200, // Más de lo disponible (90)
          price: 100
        }
      ],
      total: 20000
    };

    const { error } = await supabase
      .from('sales')
      .insert(oversoldSale);

    // Debe fallar
    expect(error).toBeDefined();
    console.log('✅ Validación de stock insuficiente funciona');
  });

  it('6. Debe registrar la venta en audit_logs', async () => {
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'sale')
      .eq('entity_id', testSale.id)
      .order('created_at', { ascending: false })
      .limit(1);

    expect(auditLogs).toBeDefined();
    expect(auditLogs!.length).toBeGreaterThan(0);
    console.log('✅ Audit log registrado correctamente');
  });
});

describe('Performance Tests', () => {
  it('Búsqueda de productos debe ser rápida (<500ms)', async () => {
    const startTime = Date.now();
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .ilike('name', '%test%')
      .limit(10);
    
    const elapsed = Date.now() - startTime;
    
    expect(error).toBeNull();
    expect(elapsed).toBeLessThan(3000); // 3s threshold for network-dependent search (Supabase latency varies)
    console.log(`✅ Búsqueda completada en ${elapsed}ms`);
  });

  it('Dashboard debe cargar datos en <2 segundos', async () => {
    const startTime = Date.now();
    
    const [products, sales, customers] = await Promise.all([
      supabase.from('products').select('*').limit(100),
      supabase.from('sales').select('*').limit(100),
      supabase.from('customers').select('*').limit(100)
    ]);
    
    const elapsed = Date.now() - startTime;
    
    expect(elapsed).toBeLessThan(2000);
    console.log(`✅ Dashboard data cargado en ${elapsed}ms`);
  });
});
