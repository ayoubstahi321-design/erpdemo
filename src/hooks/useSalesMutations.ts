/**
 * Sales mutation functions extracted from useSales().
 * No data fetching — only Supabase writes.
 * Used by Sales.tsx alongside usePaginatedSales() to avoid loading ALL sales.
 */

import { supabase } from '../services/supabaseClient';
import { Sale, SaleItem, Payment } from '../types';
import { logger } from '../utils/logger';

export function useSalesMutations() {

  const createSale = async (sale: Omit<Sale, 'id'>, userId: string) => {
    if (!sale.items || sale.items.length === 0) {
      throw new Error('Cannot create sale without items');
    }

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

    const stockUpdates = sale.items.map(item => {
      const packSize = item.unitsPerBox || 1;
      const delta = item.stockDelta
        ?? (item.sellMode === 'box' ? -(item.quantity * packSize) : -item.quantity);
      return { product_id: item.productId, warehouse_id: sale.warehouseId, delta };
    });

    const { error, data } = await supabase.rpc('create_sale_atomic', {
      p_sale: saleJson,
      p_items: itemsJson,
      p_stock_updates: stockUpdates
    });

    if (error) {
      logger.error('create_sale_atomic ERROR:', { error, saleJson });
      throw error;
    }

    return { ...sale, id: saleId } as any;
  };

  const registerPayment = async (saleId: string, payment: Omit<Payment, 'id'>) => {
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .select('company_id, amount_paid, total_amount, credited_amount')
      .eq('id', saleId)
      .single();

    if (saleError) throw saleError;

    if (!payment.amount || payment.amount <= 0) {
      throw new Error('Le montant du paiement doit être supérieur à 0');
    }

    const creditedAmount = saleData.credited_amount || 0;
    const remainingBalance = Math.round((saleData.total_amount - saleData.amount_paid - creditedAmount) * 100) / 100;
    if (payment.amount > remainingBalance + 0.01) {
      throw new Error(`Le paiement (${payment.amount.toFixed(2)}) dépasse le solde restant (${remainingBalance.toFixed(2)})`);
    }

    const effectiveAmount = Math.round(Math.min(payment.amount, remainingBalance) * 100) / 100;

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
        company_id: saleData.company_id
      }]);

    if (paymentError) throw paymentError;

    const newAmountPaid = Math.round((saleData.amount_paid + effectiveAmount) * 100) / 100;
    const effectiveTotal = newAmountPaid + creditedAmount;
    const newPaymentStatus =
      effectiveTotal >= saleData.total_amount
        ? 'Paid'
        : effectiveTotal > 0
        ? 'Partial'
        : 'Unpaid';

    const { error: updateError } = await supabase
      .from('sales')
      .update({
        amount_paid: newAmountPaid,
        payment_status: newPaymentStatus
      })
      .eq('id', saleId);

    if (updateError) throw updateError;
  };

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
    userId: string,
    newDate?: string,
    newInvoiceNumber?: string
  ) => {
    if (!newItems || newItems.length === 0) {
      throw new Error('Cannot update sale without items');
    }

    // Fetch sale from DB instead of local state
    const { data: saleRow, error: fetchErr } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items (
          id, product_id, product_name, quantity, unit_price,
          discount, discount_type, total, sell_mode, units_per_box
        )
      `)
      .eq('id', saleId)
      .single();

    if (fetchErr || !saleRow) throw new Error('Sale not found');

    const oldItems = (saleRow.sale_items || []).map((item: any) => ({
      productId: item.product_id,
      quantity: item.quantity,
      sellMode: item.sell_mode || 'unit',
      unitsPerBox: item.units_per_box || 1
    }));

    // Stock is stored in individual units (post-migration).
    // Box-mode items must be multiplied by unitsPerBox — same logic as createSale.
    const oldStockReversals = oldItems.map((item: any) => {
      const units = item.sellMode === 'box'
        ? item.quantity * (item.unitsPerBox || 1)
        : item.quantity;
      return { product_id: item.productId, warehouse_id: saleRow.warehouse_id, delta: units };
    });

    const newStockDeductions = newItems.map(item => {
      const units = item.sellMode === 'box'
        ? item.quantity * (item.unitsPerBox || 1)
        : item.quantity;
      return { product_id: item.productId, warehouse_id: saleRow.warehouse_id, delta: -units };
    });

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

    const creditedAmount = saleRow.credited_amount || 0;
    const effectivePaid = saleRow.amount_paid + creditedAmount;
    const remaining = Math.round((totals.totalAmount - effectivePaid) * 100) / 100;

    const saleUpdates: Record<string, any> = {
      itemsSubtotal: totals.itemsSubtotal,
      globalDiscountAmount: totals.globalDiscountAmount,
      subtotalAmount: totals.subtotalAmount,
      taxAmount: totals.taxAmount,
      totalAmount: totals.totalAmount,
      amountPaid: saleRow.amount_paid,
      paymentStatus: remaining <= 0 ? 'Paid'
        : effectivePaid > 0 ? 'Partial' : 'Unpaid'
    };
    const expectedUpdatedAt = saleRow.updated_at || saleRow.date;

    const { error } = await supabase.rpc('update_sale_optimistic', {
      p_sale_id: saleId,
      p_expected_updated_at: expectedUpdatedAt,
      p_new_items: newItemsJson,
      p_old_stock_reversals: oldStockReversals,
      p_new_stock_deductions: newStockDeductions,
      p_sale_updates: saleUpdates
    });

    if (error) {
      if (error.message?.includes('CONFLICT')) {
        throw new Error('Cette vente a été modifiée par un autre utilisateur. Veuillez rafraîchir la page et réessayer.');
      }
      throw error;
    }

    // Update date and invoice number if provided (separate from RPC to keep it simple)
    if (newDate || newInvoiceNumber) {
      const metaUpdates: Record<string, string> = {};
      if (newDate) metaUpdates.date = newDate;
      if (newInvoiceNumber) metaUpdates.invoice_number = newInvoiceNumber;
      const { error: metaError } = await supabase
        .from('sales')
        .update(metaUpdates)
        .eq('id', saleId);
      if (metaError) throw metaError;
    }
  };

  const deletePayment = async (saleId: string, paymentId: string) => {
    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('amount')
      .eq('id', paymentId)
      .single();
    if (fetchErr) throw fetchErr;

    const { error: deleteErr } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId);
    if (deleteErr) throw deleteErr;

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
  };

  const createQuote = async (quote: Omit<Sale, 'id'>, userId: string) => {
    if (!quote.items || quote.items.length === 0) {
      throw new Error('Cannot create quote without items');
    }
    const quoteId = crypto.randomUUID();

    const { error: saleError } = await supabase.from('sales').insert([{
      id: quoteId,
      date: quote.date,
      warehouse_id: quote.warehouseId,
      customer_id: quote.customerId,
      customer_name: quote.customerName,
      customer_type: quote.customerType,
      source: quote.source || 'B2B',
      document_type: 'QUOTE',
      is_fast_sale: false,
      company_id: quote.companyId || null,
      invoice_number: quote.invoiceNumber || null,
      global_discount_type: quote.globalDiscountType || null,
      global_discount_value: quote.globalDiscountValue || null,
      global_discount_amount: quote.globalDiscountAmount || null,
      items_subtotal: quote.itemsSubtotal,
      subtotal_amount: quote.subtotalAmount,
      tax_rate: quote.taxRate,
      tax_amount: quote.taxAmount,
      total_amount: quote.totalAmount,
      amount_paid: 0,
      payment_status: 'Unpaid',
      credited_amount: 0,
      status: 'Pending',
    }]);
    if (saleError) throw saleError;

    const items = quote.items.map(item => ({
      id: crypto.randomUUID(),
      sale_id: quoteId,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount: item.discount || 0,
      discount_type: item.discountType || 'percentage',
      total: item.total,
      is_gift: item.isGift || false,
      sell_mode: item.sellMode || 'unit',
      units_per_box: item.unitsPerBox || 1,
    }));
    const { error: itemsError } = await supabase.from('sale_items').insert(items);
    if (itemsError) throw itemsError;

    return { ...quote, id: quoteId } as any;
  };

  const deleteQuote = async (quoteId: string) => {
    const { error: itemsErr } = await supabase
      .from('sale_items')
      .delete()
      .eq('sale_id', quoteId);
    if (itemsErr) throw itemsErr;

    const { error: saleErr } = await supabase
      .from('sales')
      .delete()
      .eq('id', quoteId)
      .eq('document_type', 'QUOTE');
    if (saleErr) throw saleErr;
  };

  const updateQuote = async (
    quoteId: string,
    quote: Omit<Sale, 'id'>,
    items: SaleItem[]
  ) => {
    const { error: updateErr } = await supabase
      .from('sales')
      .update({
        date: quote.date,
        customer_id: quote.customerId,
        customer_name: quote.customerName,
        customer_type: quote.customerType,
        warehouse_id: quote.warehouseId,
        global_discount_type: quote.globalDiscountType || null,
        global_discount_value: quote.globalDiscountValue || null,
        global_discount_amount: quote.globalDiscountAmount || null,
        items_subtotal: quote.itemsSubtotal,
        subtotal_amount: quote.subtotalAmount,
        tax_rate: quote.taxRate,
        tax_amount: quote.taxAmount,
        total_amount: quote.totalAmount,
      })
      .eq('id', quoteId)
      .eq('document_type', 'QUOTE');
    if (updateErr) throw updateErr;

    const { error: delErr } = await supabase
      .from('sale_items')
      .delete()
      .eq('sale_id', quoteId);
    if (delErr) throw delErr;

    const newItems = items.map(item => ({
      id: crypto.randomUUID(),
      sale_id: quoteId,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount: item.discount || 0,
      discount_type: item.discountType || 'percentage',
      total: item.total,
      is_gift: item.isGift || false,
      sell_mode: item.sellMode || 'unit',
      units_per_box: item.unitsPerBox || 1,
    }));
    const { error: insErr } = await supabase.from('sale_items').insert(newItems);
    if (insErr) throw insErr;
  };

  const confirmQuote = async (quote: Sale, invoiceNumber: string, userId: string) => {
    const { id: _id, ...rest } = quote as any;
    const confirmedSale: Omit<Sale, 'id'> = {
      ...rest,
      invoiceNumber: undefined,
      deliveryNoteNumber: invoiceNumber,
      documentType: 'DELIVERY_NOTE',
      status: 'Completed',
      paymentStatus: 'Unpaid',
      amountPaid: 0,
      payments: [],
      creditedAmount: 0,
      returnStatus: undefined,
    };
    await createSale(confirmedSale, userId);
    await deleteQuote(quote.id);
  };

  return { createSale, registerPayment, updateSaleItems, deletePayment, createQuote, updateQuote, confirmQuote, deleteQuote };
}
