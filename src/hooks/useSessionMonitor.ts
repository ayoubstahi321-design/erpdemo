/**
 * Hook para monitorear la sesión de Supabase y manejar expiración de JWT
 */

import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { logger } from '../utils/logger';

export const useSessionMonitor = (onSessionExpired: () => void) => {
  useEffect(() => {
    if (!isSupabaseConfigured) {
      logger.debug('Supabase not configured, session monitor disabled');
      return;
    }

    let hasInitialSession = false;

    // Verificar sesión cada 5 minutos
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (session) {
          hasInitialSession = true;
          logger.auth('Sesión válida', undefined, { expira: new Date(session.expires_at! * 1000).toLocaleString() });
        } else if (hasInitialSession) {
          // Solo cerrar sesión si teníamos una sesión antes y ahora no
          logger.warn('Sesión expirada o inválida, cerrando sesión...', error?.message || 'No session');
          onSessionExpired();
        }
      } catch (error) {
        logger.error('Error verificando sesión', error);
      }
    };

    // Verificar inicialmente para establecer hasInitialSession
    checkSession();

    // Verificar cada 5 minutos
    const interval = setInterval(checkSession, 5 * 60 * 1000);

    // Listener para cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.auth(`Auth state changed: ${event}`);

      if (event === 'TOKEN_REFRESHED') {
        logger.auth('Token refrescado exitosamente');
        hasInitialSession = true;
      } else if (event === 'SIGNED_IN') {
        logger.auth('Usuario inició sesión');
        hasInitialSession = true;
      } else if (event === 'SIGNED_OUT') {
        logger.auth('Usuario cerró sesión');
        hasInitialSession = false;
      } else if (event === 'USER_UPDATED') {
        logger.auth('Usuario actualizado');
      }

      // Solo ejecutar logout si teníamos sesión y ahora no (excepto SIGNED_OUT que ya se maneja)
      if (!session && hasInitialSession && event !== 'SIGNED_OUT' && event !== 'INITIAL_SESSION') {
        logger.warn('Sesión perdida inesperadamente, cerrando sesión...');
        onSessionExpired();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [onSessionExpired]);
};
