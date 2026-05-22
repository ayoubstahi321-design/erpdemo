import { logger } from '../utils/logger';
/**
 * ============================================
 * HOOK PARA SINCRONIZACIÓN EN TIEMPO REAL
 * ============================================
 *
 * Este hook proporciona sincronización en tiempo real usando Supabase Realtime
 * Permite que múltiples usuarios vean cambios instantáneamente
 *
 * Uso:
 * ```ts
 * const { subscribeToProducts, subscribeToSales } = useRealtime();
 *
 * useEffect(() => {
 *   const unsub = subscribeToProducts((payload) => {
 *     logger.debug('Producto actualizado:', payload);
 *     // Actualizar estado local
 *   });
 *
 *   return unsub; // Cleanup
 * }, []);
 * ```
 */

import { useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { FEATURE_FLAGS } from '../config/features';
import { transformKeys } from '../utils/snakeToCamel';

// Tipos de eventos de Realtime
export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimePayload<T = any> {
  eventType: RealtimeEvent;
  new: T | null;  // Nuevo registro (para INSERT y UPDATE)
  old: T | null;  // Registro anterior (para UPDATE y DELETE)
  table: string;
}

export type RealtimeCallback<T = any> = (payload: RealtimePayload<T>) => void;

/**
 * Hook principal para Realtime
 */
export const useRealtime = () => {
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());

  // Limpieza al desmontar el componente
  useEffect(() => {
    return () => {
      // Desuscribir todos los canales al desmontar
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current.clear();
    };
  }, []);

  /**
   * Suscribe a cambios en la tabla de productos
   */
  const subscribeToProducts = (callback: RealtimeCallback): (() => void) => {
    if (!FEATURE_FLAGS.ENABLE_REALTIME) {
      logger.warn('Realtime está deshabilitado en feature flags');
      return () => {};
    }

    const channelName = 'products-changes';

    // Si ya existe un canal, removerlo primero
    if (channelsRef.current.has(channelName)) {
      const existingChannel = channelsRef.current.get(channelName)!;
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelName);
    }

    // Crear nuevo canal
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Escuchar todos los eventos (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'products'
        },
        (payload: any) => {
          callback({
            eventType: payload.eventType as RealtimeEvent,
            new: payload.new ? transformKeys(payload.new) : null,
            old: payload.old ? transformKeys(payload.old) : null,
            table: 'products'
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[Realtime] Suscrito a cambios de productos');
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('[Realtime] Error al suscribirse a productos');
        }
      });

    channelsRef.current.set(channelName, channel);

    // Retornar función de limpieza
    return () => {
      supabase.removeChannel(channel);
      channelsRef.current.delete(channelName);
    };
  };

  /**
   * Suscribe a cambios en niveles de stock
   */
  const subscribeToStockLevels = (callback: RealtimeCallback): (() => void) => {
    if (!FEATURE_FLAGS.ENABLE_REALTIME) {
      return () => {};
    }

    const channelName = 'stock-levels-changes';

    if (channelsRef.current.has(channelName)) {
      const existingChannel = channelsRef.current.get(channelName)!;
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_levels'
        },
        (payload: any) => {
          callback({
            eventType: payload.eventType as RealtimeEvent,
            new: payload.new ? transformKeys(payload.new) : null,
            old: payload.old ? transformKeys(payload.old) : null,
            table: 'stock_levels'
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[Realtime] Suscrito a cambios de stock');
        }
      });

    channelsRef.current.set(channelName, channel);

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current.delete(channelName);
    };
  };

  /**
   * Suscribe a cambios en ventas
   */
  const subscribeToSales = (callback: RealtimeCallback): (() => void) => {
    if (!FEATURE_FLAGS.ENABLE_REALTIME) {
      return () => {};
    }

    const channelName = 'sales-changes';

    if (channelsRef.current.has(channelName)) {
      const existingChannel = channelsRef.current.get(channelName)!;
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales'
        },
        (payload: any) => {
          callback({
            eventType: payload.eventType as RealtimeEvent,
            new: payload.new ? transformKeys(payload.new) : null,
            old: payload.old ? transformKeys(payload.old) : null,
            table: 'sales'
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[Realtime] Suscrito a cambios de ventas');
        }
      });

    channelsRef.current.set(channelName, channel);

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current.delete(channelName);
    };
  };

  /**
   * Suscribe a cambios en clientes
   */
  const subscribeToCustomers = (callback: RealtimeCallback): (() => void) => {
    if (!FEATURE_FLAGS.ENABLE_REALTIME) {
      return () => {};
    }

    const channelName = 'customers-changes';

    if (channelsRef.current.has(channelName)) {
      const existingChannel = channelsRef.current.get(channelName)!;
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers'
        },
        (payload: any) => {
          callback({
            eventType: payload.eventType as RealtimeEvent,
            new: payload.new ? transformKeys(payload.new) : null,
            old: payload.old ? transformKeys(payload.old) : null,
            table: 'customers'
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[Realtime] Suscrito a cambios de clientes');
        }
      });

    channelsRef.current.set(channelName, channel);

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current.delete(channelName);
    };
  };

  /**
   * Suscribe a cambios en almacenes
   */
  const subscribeToWarehouses = (callback: RealtimeCallback): (() => void) => {
    if (!FEATURE_FLAGS.ENABLE_REALTIME) {
      return () => {};
    }

    const channelName = 'warehouses-changes';

    if (channelsRef.current.has(channelName)) {
      const existingChannel = channelsRef.current.get(channelName)!;
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'warehouses'
        },
        (payload: any) => {
          callback({
            eventType: payload.eventType as RealtimeEvent,
            new: payload.new ? transformKeys(payload.new) : null,
            old: payload.old ? transformKeys(payload.old) : null,
            table: 'warehouses'
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[Realtime] Suscrito a cambios de almacenes');
        }
      });

    channelsRef.current.set(channelName, channel);

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current.delete(channelName);
    };
  };

  /**
   * Suscribe a cambios en historial de precios
   */
  const subscribeToPriceHistory = (callback: RealtimeCallback): (() => void) => {
    if (!FEATURE_FLAGS.ENABLE_REALTIME) {
      return () => {};
    }

    const channelName = 'price-history-changes';

    if (channelsRef.current.has(channelName)) {
      const existingChannel = channelsRef.current.get(channelName)!;
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // Solo escuchar inserciones (no se actualizan ni eliminan registros de historial)
          schema: 'public',
          table: 'price_history'
        },
        (payload: any) => {
          callback({
            eventType: payload.eventType as RealtimeEvent,
            new: payload.new ? transformKeys(payload.new) : null,
            old: payload.old ? transformKeys(payload.old) : null,
            table: 'price_history'
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[Realtime] Suscrito a cambios de historial de precios');
        }
      });

    channelsRef.current.set(channelName, channel);

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current.delete(channelName);
    };
  };

  /**
   * Suscribe a una tabla personalizada
   */
  const subscribeToTable = (
    tableName: string,
    callback: RealtimeCallback,
    events: RealtimeEvent[] = ['INSERT', 'UPDATE', 'DELETE']
  ): (() => void) => {
    if (!FEATURE_FLAGS.ENABLE_REALTIME) {
      return () => {};
    }

    const channelName = `${tableName}-changes`;

    if (channelsRef.current.has(channelName)) {
      const existingChannel = channelsRef.current.get(channelName)!;
      supabase.removeChannel(existingChannel);
      channelsRef.current.delete(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event: events.length === 3 ? '*' : events[0], // Si escucha todos, usar '*'
          schema: 'public',
          table: tableName
        } as any,
        (payload: any) => {
          callback({
            eventType: payload.eventType as RealtimeEvent,
            new: payload.new ? transformKeys(payload.new) : null,
            old: payload.old ? transformKeys(payload.old) : null,
            table: tableName
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug(`[Realtime] Suscrito a cambios de ${tableName}`);
        }
      });

    channelsRef.current.set(channelName, channel);

    return () => {
      supabase.removeChannel(channel);
      channelsRef.current.delete(channelName);
    };
  };

  return {
    subscribeToProducts,
    subscribeToStockLevels,
    subscribeToSales,
    subscribeToCustomers,
    subscribeToWarehouses,
    subscribeToPriceHistory,
    subscribeToTable
  };
};

/**
 * Hook simplificado para escuchar cambios en una tabla específica
 * Se auto-suscribe y limpia automáticamente
 *
 * @example
 * useRealtimeTable('products', (payload) => {
 *   logger.debug('Cambio en productos:', payload);
 *   refetchProducts();
 * });
 */
export const useRealtimeTable = (
  tableName: string,
  callback: RealtimeCallback,
  enabled: boolean = true
) => {
  const { subscribeToTable } = useRealtime();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const stableCallback = useCallback<RealtimeCallback>((payload) => {
    callbackRef.current(payload);
  }, []);

  useEffect(() => {
    if (!enabled || !FEATURE_FLAGS.ENABLE_REALTIME) {
      return;
    }

    const unsubscribe = subscribeToTable(tableName, stableCallback);

    return unsubscribe;
  }, [tableName, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
};
