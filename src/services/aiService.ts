import { supabase, isSupabaseConfigured } from './supabaseClient';
import { Product, Sale, Warehouse, Customer, Transfer, UserRole } from '../types';

export interface AIContext {
  products?: Product[];
  sales?: Sale[];
  warehouses?: Warehouse[];
  customers?: Customer[];
  transfers?: Transfer[];
  userRole?: UserRole;
}

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIChatResponse {
  response: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  timestamp: string;
  error?: string;
}

/**
 * AI Service for Azmol Stock ERP
 * Handles communication with Groq AI via Supabase Edge Function
 *
 * @example
 * const response = await aiService.chat(
 *   "¿Qué productos tienen stock bajo?",
 *   { products, sales, warehouses, userRole: 'Admin' }
 * );
 */
export const aiService = {
  /**
   * Send a message to the AI assistant
   * @param message - User's question or command
   * @param context - Business context (products, sales, etc.)
   * @param conversationHistory - Previous messages for context
   * @returns AI response
   */
  async chat(
    message: string,
    context: AIContext = {},
    conversationHistory: AIChatMessage[] = []
  ): Promise<AIChatResponse> {
    try {
      // Check if Supabase is configured
      if (!isSupabaseConfigured) {
        return {
          response: 'El Asistente AI requiere conexión online. Por favor, configura Supabase o usa el modo online.',
          timestamp: new Date().toISOString(),
          error: 'OFFLINE_MODE'
        };
      }

      // Get current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return {
          response: 'Por favor, inicia sesión para usar el Asistente AI.',
          timestamp: new Date().toISOString(),
          error: 'NOT_AUTHENTICATED'
        };
      }

      // Optimize context to reduce token usage
      const optimizedContext = this.optimizeContext(context);

      // Call edge function
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message,
          context: optimizedContext,
          conversationHistory: conversationHistory.slice(-6) // Last 3 exchanges
        }
      });

      if (error) {
        console.error('AI Service Error:', error);
        return {
          response: this.getErrorMessage(error),
          timestamp: new Date().toISOString(),
          error: error.message
        };
      }

      return {
        response: data.response,
        usage: data.usage,
        timestamp: data.timestamp
      };

    } catch (error: any) {
      console.error('AI Chat Exception:', error);
      return {
        response: 'Ocurrió un error al comunicarse con el asistente. Por favor, intenta de nuevo.',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  },

  /**
   * Optimize context to reduce API costs
   * - Limit array sizes
   * - Remove unnecessary fields
   * - Summarize large datasets
   */
  optimizeContext(context: AIContext): AIContext {
    const optimized: AIContext = {};

    // Products: Keep only essential fields, limit to 50
    if (context.products && context.products.length > 0) {
      optimized.products = context.products
        .slice(0, 50)
        .map(p => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category,
          price: p.price,
          cost: p.cost,
          stockLevels: p.stockLevels,
          minStock: p.minStock
        } as any));
    }

    // Sales: Last 30 sales only
    if (context.sales && context.sales.length > 0) {
      optimized.sales = context.sales
        .slice(0, 30)
        .map(s => ({
          id: s.id,
          date: s.date,
          customerName: s.customerName,
          totalAmount: s.totalAmount,
          paymentStatus: s.paymentStatus,
          warehouseId: s.warehouseId,
          itemCount: s.items.length
        } as any));
    }

    // Warehouses: All (usually small)
    if (context.warehouses) {
      optimized.warehouses = context.warehouses;
    }

    // Customers: Summary only
    if (context.customers && context.customers.length > 0) {
      optimized.customers = context.customers
        .slice(0, 20)
        .map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          city: c.city
        } as any));
    }

    // Transfers: Last 20
    if (context.transfers && context.transfers.length > 0) {
      optimized.transfers = context.transfers
        .slice(0, 20)
        .map(t => ({
          id: t.id,
          date: t.date,
          type: t.type,
          fromWarehouseId: t.fromWarehouseId,
          toWarehouseId: t.toWarehouseId,
          itemCount: t.items.length,
          status: t.status
        } as any));
    }

    optimized.userRole = context.userRole;

    return optimized;
  },

  /**
   * Generate quick action prompts based on user role
   */
  getQuickActions(role: UserRole, language: string = 'es'): string[] {
    const actions: Record<string, Record<string, string[]>> = {
      Admin: {
        es: [
          '¿Cuál es el margen de beneficio este mes?',
          '¿Qué productos tienen stock bajo?',
          'Análisis de rentabilidad por categoría',
          '¿Cuáles son los clientes top?'
        ],
        fr: [
          'Quelle est la marge bénéficiaire ce mois?',
          'Quels produits ont un stock faible?',
          'Analyse de rentabilité par catégorie',
          'Quels sont les meilleurs clients?'
        ],
        en: [
          'What is the profit margin this month?',
          'Which products have low stock?',
          'Profitability analysis by category',
          'Who are the top customers?'
        ],
        ar: [
          'ما هو هامش الربح هذا الشهر؟',
          'ما هي المنتجات ذات المخزون المنخفض؟',
          'تحليل الربحية حسب الفئة',
          'من هم أفضل العملاء؟'
        ]
      },
      Manager: {
        es: [
          'Resumen de ventas de hoy',
          'Productos para reabastecer',
          'Estado de pagos pendientes',
          'Transferencias recientes'
        ],
        fr: [
          'Résumé des ventes d\'aujourd\'hui',
          'Produits à réapprovisionner',
          'État des paiements en attente',
          'Transferts récents'
        ],
        en: [
          'Today\'s sales summary',
          'Products to restock',
          'Pending payments status',
          'Recent transfers'
        ],
        ar: [
          'ملخص مبيعات اليوم',
          'المنتجات لإعادة التخزين',
          'حالة المدفوعات المعلقة',
          'التحويلات الأخيرة'
        ]
      },
      Sales: {
        es: [
          'Ventas de esta semana',
          'Productos más vendidos',
          'Clientes con pagos pendientes',
          'Stock disponible por almacén'
        ],
        fr: [
          'Ventes de cette semaine',
          'Produits les plus vendus',
          'Clients avec paiements en attente',
          'Stock disponible par entrepôt'
        ],
        en: [
          'This week\'s sales',
          'Best-selling products',
          'Customers with pending payments',
          'Available stock by warehouse'
        ],
        ar: [
          'مبيعات هذا الأسبوع',
          'المنتجات الأكثر مبيعًا',
          'العملاء مع المدفوعات المعلقة',
          'المخزون المتاح حسب المستودع'
        ]
      },
      Delivery: {
        es: [
          'Transferencias pendientes',
          'Stock por almacén',
          'Productos para mover',
          'Historial de transferencias'
        ],
        fr: [
          'Transferts en attente',
          'Stock par entrepôt',
          'Produits à déplacer',
          'Historique des transferts'
        ],
        en: [
          'Pending transfers',
          'Stock by warehouse',
          'Products to move',
          'Transfer history'
        ],
        ar: [
          'التحويلات المعلقة',
          'المخزون حسب المستودع',
          'المنتجات للنقل',
          'تاريخ التحويلات'
        ]
      },
      Cashier: {
        es: [
          'Ventas de hoy',
          'Productos disponibles',
          'Clientes frecuentes',
          'Métodos de pago más usados'
        ],
        fr: [
          'Ventes d\'aujourd\'hui',
          'Produits disponibles',
          'Clients fréquents',
          'Méthodes de paiement les plus utilisées'
        ],
        en: [
          'Today\'s sales',
          'Available products',
          'Frequent customers',
          'Most used payment methods'
        ],
        ar: [
          'مبيعات اليوم',
          'المنتجات المتاحة',
          'العملاء المتكررين',
          'طرق الدفع الأكثر استخدامًا'
        ]
      }
    };

    return actions[role]?.[language] || actions[role]?.['es'] || [];
  },

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error: any): string {
    const message = error.message || error.toString();

    if (message.includes('rate limit') || message.includes('Rate limit')) {
      return 'Has alcanzado el límite de consultas. Por favor, espera un minuto.';
    }
    if (message.includes('Unauthorized') || message.includes('unauthorized')) {
      return 'Sesión expirada. Por favor, inicia sesión nuevamente.';
    }
    if (message.includes('GROQ_API_KEY')) {
      return 'Error de configuración del servidor. Contacta al administrador.';
    }
    return 'Error al comunicarse con el asistente. Intenta de nuevo.';
  }
};
