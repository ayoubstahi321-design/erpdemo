/**
 * Document Numbering Service
 * Generates sequential document numbers for invoices, tickets, and delivery notes
 * Format: PREFIX-YYYY-MM-NNNNN  (e.g. F-2026-03-00001)
 * Sequence resets each month.
 */

import { supabase } from './supabaseClient';
import { DocumentType } from '../types';
import { logger } from '../utils/logger';

// Sentinel value for system-wide numbering (avoids PostgreSQL NULL != NULL issue)
const SYSTEM_COMPANY_ID = '__SYSTEM__';

function getPrefix(documentType: DocumentType): string {
  switch (documentType) {
    case 'TICKET': return 'T';
    case 'INVOICE': return 'F';
    case 'DELIVERY_NOTE': return 'BL';
    case 'QUOTE': return 'DEV';
  }
}

function normalizeCompanyId(companyId?: string | null): string {
  return companyId || SYSTEM_COMPANY_ID;
}

/**
 * Generate next document number from Supabase
 * Uses RPC function for thread-safe sequential numbering
 * Falls back to counting existing sales if RPC fails
 */
export async function generateDocumentNumber(
  documentType: DocumentType,
  companyId?: string | null,
  year?: number,
  month?: number
): Promise<string> {
  const targetYear  = year  || new Date().getFullYear();
  const targetMonth = month || (new Date().getMonth() + 1); // 1–12
  const safeCompanyId = normalizeCompanyId(companyId);

  // QUOTE: RPC only knows TICKET/INVOICE/DELIVERY_NOTE — skip it, use fallback directly
  if (documentType === 'QUOTE') {
    return generateFromSalesCount(documentType, targetYear, targetMonth);
  }

  // Try RPC first (atomic counter)
  try {
    const { data, error } = await supabase.rpc('generate_document_number', {
      p_document_type: documentType,
      p_company_id:    safeCompanyId,
      p_year:          targetYear,
      p_month:         targetMonth,
    });

    if (error) {
      logger.error('RPC generate_document_number failed', { error, documentType, year, month });
      throw error;
    }

    if (data) {
      logger.info('Document number generated via RPC', { documentType, number: data });
      return data as string;
    }
  } catch (rpcError) {
    logger.warn('RPC failed, falling back to sales count', { rpcError });
  }

  // Fallback: count existing documents in the sales table
  return generateFromSalesCount(documentType, targetYear, targetMonth);
}

/**
 * Fallback: query existing sales to determine next number
 * Counts documents of this type in the current month
 */
async function generateFromSalesCount(
  documentType: DocumentType,
  year: number,
  month: number
): Promise<string> {
  const prefix = getPrefix(documentType);
  const mm = String(month).padStart(2, '0');
  const searchPrefix = `${prefix}-${year}-${mm}-`;

  try {
    const field = documentType === 'DELIVERY_NOTE' ? 'delivery_note_number' : 'invoice_number';

    const { data, error } = await supabase
      .from('sales')
      .select(field)
      .like(field, `${searchPrefix}%`)
      .order(field, { ascending: false })
      .limit(1);

    if (error) {
      logger.error('Fallback query failed', { error });
      return `${prefix}-${year}-${mm}-${Date.now().toString().slice(-5)}`;
    }

    let nextNumber = 1;
    if (data && data.length > 0) {
      const lastValue = (data[0] as Record<string, string>)[field];
      const match = lastValue.match(/-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    const result = `${prefix}-${year}-${mm}-${String(nextNumber).padStart(5, '0')}`;
    logger.info('Document number generated via fallback', { documentType, number: result });
    return result;
  } catch (error) {
    logger.error('Exception in fallback numbering', { error });
    const mm2 = String(month).padStart(2, '0');
    return `${prefix}-${year}-${mm2}-${Date.now().toString().slice(-5)}`;
  }
}

/**
 * Get current counter value for a document type (for display purposes)
 */
export async function getCurrentCounter(
  documentType: DocumentType,
  companyId?: string | null,
  year?: number,
  month?: number
): Promise<number> {
  try {
    const targetYear  = year  || new Date().getFullYear();
    const targetMonth = month || (new Date().getMonth() + 1);
    const safeCompanyId = normalizeCompanyId(companyId);

    const { data, error } = await supabase
      .from('document_counters')
      .select('last_number')
      .eq('document_type', documentType)
      .eq('year', targetYear)
      .eq('month', targetMonth)
      .eq('company_id', safeCompanyId)
      .single();

    if (error) {
      return getCounterFromSales(documentType, targetYear, targetMonth);
    }

    return data?.last_number || 0;
  } catch (error) {
    logger.error('Exception in getCurrentCounter', { error, documentType, year });
    return 0;
  }
}

/**
 * Fallback counter: count from sales table
 */
async function getCounterFromSales(documentType: DocumentType, year: number, month: number): Promise<number> {
  try {
    const prefix = getPrefix(documentType);
    const mm = String(month).padStart(2, '0');
    const field = documentType === 'DELIVERY_NOTE' ? 'delivery_note_number' : 'invoice_number';

    const { data, error } = await supabase
      .from('sales')
      .select(field)
      .like(field, `${prefix}-${year}-${mm}-%`)
      .order(field, { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return 0;

    const lastValue = (data[0] as Record<string, string>)[field];
    const match = lastValue.match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Preview next document number (without incrementing)
 */
export async function previewNextNumber(
  documentType: DocumentType,
  companyId?: string | null,
  year?: number,
  month?: number
): Promise<string> {
  try {
    const currentCounter = await getCurrentCounter(documentType, companyId, year, month);
    const nextNumber  = currentCounter + 1;
    const targetYear  = year  || new Date().getFullYear();
    const targetMonth = month || (new Date().getMonth() + 1);
    const prefix = getPrefix(documentType);
    const mm = String(targetMonth).padStart(2, '0');

    return `${prefix}-${targetYear}-${mm}-${String(nextNumber).padStart(5, '0')}`;
  } catch (error) {
    logger.error('Error previewing next number', { error, documentType, year });
    return 'Error';
  }
}
