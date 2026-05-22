// User management functions using Supabase
import { supabase } from '../services/supabaseClient';

export async function addUserApi(token: string, payload: { name: string; email: string; role: string }) {
  // Note: Creating users requires admin privileges, this should be handled server-side
  // For now, we'll use a database table approach assuming users table exists
  const { data, error } = await supabase
    .from('users')
    .insert({
      name: payload.name,
      email: payload.email,
      role: payload.role
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateUserApi(token: string, userId: string, payload: { name?: string; email?: string; role?: string }) {
  // Update user in database
  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteUserApi(token: string, userId: string) {
  // Delete user from database
  const response = await supabase
    .from('users')
    .delete()
    .eq('id', userId) as any;

  if (response.error) throw response.error;
  return { success: true };
}
  