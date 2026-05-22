/**
 * Supabase Mock Client
 *
 * Mock implementation of Supabase client for testing.
 * Provides in-memory data storage and RPC function mocking.
 *
 * Usage in tests:
 *   import { mockSupabase, resetMockData } from '@/test/mocks/supabase';
 *   beforeEach(() => resetMockData());
 */

import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// ==================== IN-MEMORY DATA STORE ====================

interface MockDataStore {
  warehouses: any[];
  customers: any[];
  profiles: any[];
  products: any[];
  stock_levels: any[];
  sales: any[];
  sale_items: any[];
  payments: any[];
  transfers: any[];
  transfer_items: any[];
  returns: any[];
  return_items: any[];
  audit_logs: any[];
  company_settings: any[];
}

let mockData: MockDataStore = {
  warehouses: [],
  customers: [],
  profiles: [],
  products: [],
  stock_levels: [],
  sales: [],
  sale_items: [],
  payments: [],
  transfers: [],
  transfer_items: [],
  returns: [],
  return_items: [],
  audit_logs: [],
  company_settings: [],
};

// ==================== HELPER FUNCTIONS ====================

export function resetMockData() {
  mockData = {
    warehouses: [],
    customers: [],
    profiles: [],
    products: [],
    stock_levels: [],
    sales: [],
    sale_items: [],
    payments: [],
    transfers: [],
    transfer_items: [],
    returns: [],
    return_items: [],
    audit_logs: [],
    company_settings: [],
  };
}

export function seedMockData(table: keyof MockDataStore, data: any[]) {
  mockData[table] = [...data];
}

export function getMockData(table: keyof MockDataStore) {
  return mockData[table];
}

// Generate a valid UUID v4 format for Postgres
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ==================== MOCK QUERY BUILDER ====================

class MockQueryBuilder {
  private table: keyof MockDataStore;
  private filters: Array<(item: any) => boolean> = [];
  private selectFields: string = '*';
  private orderByField?: string;
  private orderAscending: boolean = true;
  private limitValue?: number;
  private singleValue: boolean = false;

  constructor(table: keyof MockDataStore) {
    this.table = table;
  }

  select(fields: string = '*') {
    this.selectFields = fields;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push((item) => item[field] === value);
    return this;
  }

  gt(field: string, value: any) {
    this.filters.push((item) => item[field] > value);
    return this;
  }

  lt(field: string, value: any) {
    this.filters.push((item) => item[field] < value);
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderByField = field;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  single() {
    this.singleValue = true;
    return this;
  }

  async insert(data: any | any[]) {
    const items = Array.isArray(data) ? data : [data];
    const inserted = items.map((item) => ({
      ...item,
      id: item.id || generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    mockData[this.table].push(...inserted);

    const result = this.singleValue ? inserted[0] : inserted;
    return { data: result, error: null };
  }

  async update(data: any) {
    let updated: any[] = [];

    mockData[this.table] = mockData[this.table].map((item) => {
      const matches = this.filters.every((filter) => filter(item));
      if (matches) {
        const updatedItem = {
          ...item,
          ...data,
          updated_at: new Date().toISOString(),
        };
        updated.push(updatedItem);
        return updatedItem;
      }
      return item;
    });

    const result = this.singleValue ? updated[0] : updated;
    return { data: result, error: null };
  }

  async delete() {
    let deleted: any[] = [];

    mockData[this.table] = mockData[this.table].filter((item) => {
      const matches = this.filters.every((filter) => filter(item));
      if (matches) {
        deleted.push(item);
        return false;
      }
      return true;
    });

    return { data: deleted, error: null };
  }

  async then(resolve: (value: any) => void) {
    let results = [...mockData[this.table]];

    // Apply filters
    if (this.filters.length > 0) {
      results = results.filter((item) => this.filters.every((filter) => filter(item)));
    }

    // Apply ordering
    if (this.orderByField) {
      results.sort((a, b) => {
        const aVal = a[this.orderByField!];
        const bVal = b[this.orderByField!];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return this.orderAscending ? comparison : -comparison;
      });
    }

    // Apply limit
    if (this.limitValue !== undefined) {
      results = results.slice(0, this.limitValue);
    }

    // Handle single
    const data = this.singleValue ? results[0] : results;
    const error = this.singleValue && !results[0] ? { message: 'Not found' } : null;

    return resolve({ data, error });
  }
}

// ==================== MOCK RPC FUNCTIONS ====================

const mockRpcFunctions: Record<string, (params: any) => any> = {
  /**
   * Mock update_stock_level function
   */
  update_stock_level: (params: {
    p_product_id: string;
    p_warehouse_id: string;
    p_delta: number;
    p_reason: string;
    p_user_id: string;
  }) => {
    const { p_product_id, p_warehouse_id, p_delta, p_reason, p_user_id } = params;

    // Find existing stock level
    const stockIndex = mockData.stock_levels.findIndex(
      (sl) => sl.product_id === p_product_id && sl.warehouse_id === p_warehouse_id
    );

    if (stockIndex >= 0) {
      // Update existing
      const currentStock = mockData.stock_levels[stockIndex];
      const newQuantity = currentStock.quantity + p_delta;

      if (newQuantity < 0) {
        throw new Error(`Stock insuficiente: actual=${currentStock.quantity}, delta=${p_delta}`);
      }

      mockData.stock_levels[stockIndex] = {
        ...currentStock,
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      };

      return mockData.stock_levels[stockIndex];
    } else {
      // Create new
      if (p_delta < 0) {
        throw new Error(`Stock insuficiente: actual=0, delta=${p_delta}`);
      }

      const newStockLevel = {
        id: generateId(),
        product_id: p_product_id,
        warehouse_id: p_warehouse_id,
        quantity: p_delta,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockData.stock_levels.push(newStockLevel);
      return newStockLevel;
    }
  },
};

// ==================== MOCK CHANNEL (REALTIME) ====================

class MockChannel {
  private channelName: string;
  private listeners: Array<{ event: string; callback: Function }> = [];

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  on(event: string, filter: any, callback: Function) {
    this.listeners.push({ event, callback });
    return this;
  }

  subscribe() {
    return this;
  }

  unsubscribe() {
    this.listeners = [];
    return this;
  }

  // Test helper: Trigger event manually
  trigger(event: string, payload: any) {
    this.listeners.forEach((listener) => {
      if (listener.event === 'postgres_changes') {
        listener.callback(payload);
      }
    });
  }
}

const mockChannels = new Map<string, MockChannel>();

// ==================== MOCK SUPABASE CLIENT ====================

export const mockSupabase = {
  from: (table: string) => {
    return new MockQueryBuilder(table as keyof MockDataStore);
  },

  rpc: async (functionName: string, params: any = {}) => {
    if (mockRpcFunctions[functionName]) {
      try {
        const result = mockRpcFunctions[functionName](params);
        return { data: result, error: null };
      } catch (error: any) {
        return { data: null, error: { message: error.message } };
      }
    }

    return {
      data: null,
      error: { message: `RPC function ${functionName} not mocked` },
    };
  },

  channel: (channelName: string) => {
    if (!mockChannels.has(channelName)) {
      mockChannels.set(channelName, new MockChannel(channelName));
    }
    return mockChannels.get(channelName)!;
  },

  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'mock-user-id',
            email: 'test@azmol.ma',
          },
        },
      },
      error: null,
    }),

    getUser: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'mock-user-id',
          email: 'test@azmol.ma',
        },
      },
      error: null,
    }),

    signInWithPassword: vi.fn().mockResolvedValue({
      data: {
        user: {
          id: 'mock-user-id',
          email: 'test@azmol.ma',
        },
        session: {
          access_token: 'mock-token',
        },
      },
      error: null,
    }),

    signOut: vi.fn().mockResolvedValue({ error: null }),

    onAuthStateChange: vi.fn((callback) => {
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      };
    }),
  },

  functions: {
    invoke: vi.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    }),
  },
} as unknown as SupabaseClient;

// ==================== TEST HELPERS ====================

/**
 * Seed test data for a specific table
 */
export function createMockWarehouse(overrides: Partial<any> = {}) {
  return {
    id: generateId(),
    name: 'Test Warehouse',
    location: 'Test Location',
    type: 'Branch',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockProduct(overrides: Partial<any> = {}) {
  return {
    id: generateId(),
    sku: 'TEST-001',
    name: 'Test Product',
    category: 'MOTOR_OIL',
    pack_size: 1,
    unit: 'L',
    price: 100,
    cost: 50,
    min_stock: 10,
    last_restock: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockStockLevel(productId: string, warehouseId: string, quantity: number) {
  return {
    id: generateId(),
    product_id: productId,
    warehouse_id: warehouseId,
    quantity,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createMockCustomer(overrides: Partial<any> = {}) {
  return {
    id: generateId(),
    type: 'Professional',
    name: 'Test Customer',
    email: 'customer@test.com',
    phone: '0612345678',
    address: 'Test Address',
    city: 'Casablanca',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockSale(overrides: Partial<any> = {}) {
  return {
    id: generateId(),
    date: new Date().toISOString(),
    warehouse_id: 'warehouse-1',
    customer_id: 'customer-1',
    customer_name: 'Test Customer',
    customer_type: 'Professional',
    subtotal_amount: 1000,
    tax_rate: 0.2,
    tax_amount: 200,
    total_amount: 1200,
    amount_paid: 0,
    payment_status: 'Unpaid',
    credited_amount: 0,
    status: 'Completed',
    created_by: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Get a mock channel for testing real-time subscriptions
 */
export function getMockChannel(channelName: string): MockChannel {
  return mockChannels.get(channelName) || new MockChannel(channelName);
}

/**
 * Trigger a real-time event on a channel
 */
export function triggerRealtimeEvent(
  channelName: string,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  table: string,
  record: any
) {
  const channel = getMockChannel(channelName);
  channel.trigger('postgres_changes', {
    eventType,
    schema: 'public',
    table,
    new: eventType !== 'DELETE' ? record : undefined,
    old: eventType === 'DELETE' ? record : undefined,
  });
}

/**
 * Create mock user with valid UUID
 */
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: generateId(),
    email: 'user@test.com',
    ...overrides,
  };
}
