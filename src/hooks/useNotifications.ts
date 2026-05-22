import { useMemo, useState, useCallback, useEffect } from 'react';
import { Product, Sale, Transfer } from '../types';

export type NotificationType = 'low_stock' | 'overdue_payment' | 'bounced_check' | 'pending_transfer';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  severity: 'warning' | 'error' | 'info';
  tab: string;
  // Optional: navigate with pre-selected context
  productId?: string;
  actionSubTab?: string; // e.g. 'ADJUSTMENT' for Transfers
  customerId?: string;
  saleId?: string;
}

interface UseNotificationsProps {
  products: Product[];
  sales: Sale[];
  transfers: Transfer[];
}

const DISMISSED_KEY = 'azmol_dismissed_notifications';

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch { return []; }
}

function setDismissed(ids: string[]) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
}

export function useNotifications({ products, sales, transfers }: UseNotificationsProps) {
  const [dismissed, setDismissedState] = useState<string[]>(getDismissed);

  const notifications = useMemo(() => {
    const items: AppNotification[] = [];
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    // 1. Low stock alerts
    (products || []).forEach(p => {
      if (!p || !p.stockLevels) return;
      const totalStock = Object.values(p.stockLevels).reduce((a: number, b: number) => a + b, 0);
      if (totalStock <= (p.minStock || 0)) {
        items.push({
          id: `low_stock_${p.id}`,
          type: 'low_stock',
          title: p.name,
          description: `Stock: ${totalStock} / Min: ${p.minStock}`,
          severity: totalStock === 0 ? 'error' : 'warning',
          tab: 'transfers',
          actionSubTab: 'ADJUSTMENT',
          productId: p.id,
        });
      }
    });

    // 2. Overdue payments (unpaid/partial > 30 days)
    (sales || []).forEach(s => {
      if (s.paymentStatus === 'Paid' || s.status === 'Cancelled') return;
      const saleDate = new Date(s.date).getTime();
      if (now - saleDate > thirtyDays) {
        const pending = s.totalAmount - s.amountPaid - (s.creditedAmount || 0);
        if (pending > 0) {
          items.push({
            id: `overdue_${s.id}`,
            type: 'overdue_payment',
            title: s.customerName,
            description: `${s.invoiceNumber || '#' + s.id.slice(0, 8)} · ${pending.toFixed(2)} MAD`,
            severity: 'error',
            tab: 'sales',
            saleId: s.id,
            customerId: s.customerId,
          });
        }
      }
    });

    // 3. Bounced checks
    (sales || []).forEach(s => {
      (s.payments || []).forEach(p => {
        if (p.paymentStatus === 'Bounced') {
          items.push({
            id: `bounced_${p.id}`,
            type: 'bounced_check',
            title: s.customerName,
            description: `${p.method} · ${p.amount.toFixed(2)} MAD`,
            severity: 'error',
            tab: 'treasury',
          });
        }
      });
    });

    // 4. Checks due within 7 days (Pending status)
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    (sales || []).forEach(s => {
      (s.payments || []).forEach(p => {
        if ((p.method === 'Check' || p.method === 'Traite') && p.paymentStatus === 'Pending' && p.dueDate) {
          const dueMs = new Date(p.dueDate).getTime();
          const msLeft = dueMs - now;
          if (msLeft >= 0 && msLeft <= sevenDays) {
            const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
            items.push({
              id: `check_due_${p.id}`,
              type: 'bounced_check',
              title: s.customerName,
              description: `${p.method} ${p.checkNumber ? '#' + p.checkNumber : ''} · ${p.amount.toFixed(2)} MAD · vence en ${daysLeft}d`,
              severity: daysLeft <= 2 ? 'error' : 'warning',
              tab: 'treasury',
              saleId: s.id,
            });
          }
        }
      });
    });

    // 5. Pending transfers
    (transfers || []).forEach(t => {
      if (t.status === 'Pending') {
        items.push({
          id: `pending_transfer_${t.id}`,
          type: 'pending_transfer',
          title: t.reference || t.id.slice(0, 8),
          description: `${t.items.length} items · ${t.type}`,
          severity: 'info',
          tab: 'transfers',
        });
      }
    });

    return items;
  }, [products, sales, transfers]);

  // When the set of active notifications changes, prune dismissed IDs that
  // no longer have a matching active notification. This ensures that if a
  // condition resolves (stock restocked) and then recurs (stock depleted again),
  // the notification reappears as unread instead of staying silently dismissed.
  useEffect(() => {
    const activeIds = new Set(notifications.map(n => n.id));
    setDismissedState(prev => {
      const pruned = prev.filter(id => activeIds.has(id));
      if (pruned.length === prev.length) return prev; // no change
      setDismissed(pruned);
      return pruned;
    });
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !dismissed.includes(n.id)).length;
  }, [notifications, dismissed]);

  const markAsRead = useCallback((id: string) => {
    setDismissedState(prev => {
      const next = [...prev, id];
      setDismissed(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const allIds = notifications.map(n => n.id);
    setDismissedState(allIds);
    setDismissed(allIds);
  }, [notifications]);

  return { notifications, unreadCount, dismissed, markAsRead, markAllAsRead };
}
