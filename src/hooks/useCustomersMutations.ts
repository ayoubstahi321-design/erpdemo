/**
 * Customer mutation functions extracted from useCustomers().
 * No data fetching — only Supabase writes.
 * Used by Customers.tsx alongside usePaginatedCustomers() to avoid loading ALL customers.
 */

import { supabase } from '../services/supabaseClient';
import { Customer } from '../types';
import { getCurrentUserCompanyId } from './useSupabaseData';

export function useCustomersMutations() {

  const addCustomer = async (customer: Omit<Customer, 'id'>) => {
    const dbCustomer: any = {
      type: customer.type,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city
    };

    if (customer.contactPerson) dbCustomer.contact_person = customer.contactPerson;
    if (customer.ice) dbCustomer.ice = customer.ice;
    if (customer.taxId) dbCustomer.tax_id = customer.taxId;
    if (customer.creditLimit !== undefined) dbCustomer.credit_limit = customer.creditLimit;
    if (customer.notes) dbCustomer.notes = customer.notes;
    if (customer.companyId !== undefined) dbCustomer.company_id = customer.companyId;
    if (customer.latitude != null) dbCustomer.latitude = customer.latitude;
    if (customer.longitude != null) dbCustomer.longitude = customer.longitude;
    if (customer.assignedTo !== undefined) dbCustomer.assigned_to = customer.assignedTo;

    const { data, error: insertError } = await supabase.from('customers').insert([dbCustomer]).select().single();
    if (insertError) throw insertError;

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
      companyId: data.company_id,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      assignedTo: data.assigned_to ?? null,
    };

    return customerData;
  };

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
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
    if (updates.companyId !== undefined) dbUpdates.company_id = updates.companyId;
    if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude;
    if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude;
    if (updates.assignedTo !== undefined) dbUpdates.assigned_to = updates.assignedTo;

    const { data, error: updateError } = await supabase.from('customers').update(dbUpdates).eq('id', id).select().single();
    if (updateError) throw updateError;

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
      companyId: data.company_id,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      assignedTo: data.assigned_to ?? null,
    };

    return customerData;
  };

  const deleteCustomer = async (id: string) => {
    const { count } = await supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', id);

    if (count && count > 0) {
      throw new Error(`Ce client a ${count} vente(s) associée(s). Impossible de le supprimer.`);
    }

    const { error: deleteError } = await supabase.from('customers').delete().eq('id', id);
    if (deleteError) throw deleteError;
  };

  return { addCustomer, updateCustomer, deleteCustomer };
}
