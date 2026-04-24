import * as Contacts from 'expo-contacts';
import { supabase } from '../lib/supabase';
import type { Contact, Friend, User } from '../types';

// ─── Phone Normalization (client-side mirror of DB function) ─────────────────

export function normalizePhoneNumber(raw: string): string {
  const digits = raw.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// ─── Convert Contact → Friend ────────────────────────────────────────────────

export function contactToFriend(contact: Contact): Friend {
  const linked = contact.linked_user;
  return {
    id: contact.linked_user_id ?? contact.id,
    display_name: linked?.display_name ?? contact.display_name,
    username: linked?.username,
    avatar_url: linked?.avatar_url,
    venmo_username: contact.venmo_username ?? linked?.venmo_username,
    phone_number: contact.phone_number,
    user_id: contact.linked_user_id ?? undefined,
    contact_id: contact.id,
    is_app_user: !!contact.linked_user_id,
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getContacts(userId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, linked_user:users!contacts_linked_user_id_fkey(*)')
    .eq('owner_id', userId)
    .order('split_count', { ascending: false })
    .order('display_name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function searchContacts(userId: string, query: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, linked_user:users!contacts_linked_user_id_fkey(*)')
    .eq('owner_id', userId)
    .ilike('display_name', `%${query}%`)
    .order('split_count', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function createContact(params: {
  owner_id: string;
  display_name: string;
  phone_number?: string;
  venmo_username?: string;
}): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      owner_id: params.owner_id,
      display_name: params.display_name,
      phone_number: params.phone_number || null,
      venmo_username: params.venmo_username || null,
    })
    .select('*, linked_user:users!contacts_linked_user_id_fkey(*)')
    .single();

  if (error) throw error;
  return data as Contact;
}

export async function updateContact(
  contactId: string,
  updates: { display_name?: string; phone_number?: string; venmo_username?: string },
): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', contactId)
    .select('*, linked_user:users!contacts_linked_user_id_fkey(*)')
    .single();

  if (error) throw error;
  return data as Contact;
}

export async function deleteContact(contactId: string): Promise<void> {
  const { error } = await supabase.from('contacts').delete().eq('id', contactId);
  if (error) throw error;
}

// ─── Split count tracking ────────────────────────────────────────────────────

export async function incrementSplitCount(contactId: string): Promise<void> {
  const { data } = await supabase
    .from('contacts')
    .select('split_count')
    .eq('id', contactId)
    .single();
  const current = (data?.split_count as number) ?? 0;
  await supabase
    .from('contacts')
    .update({ split_count: current + 1, last_split_at: new Date().toISOString() })
    .eq('id', contactId);
}

export async function bulkIncrementSplitCounts(contactIds: string[]): Promise<void> {
  if (contactIds.length === 0) return;
  // Increment each contact's split count and update last_split_at
  const now = new Date().toISOString();
  await Promise.all(
    contactIds.map(async (id) => {
      // Fetch current count, increment
      const { data } = await supabase
        .from('contacts')
        .select('split_count')
        .eq('id', id)
        .single();
      const current = (data?.split_count as number) ?? 0;
      await supabase
        .from('contacts')
        .update({ split_count: current + 1, last_split_at: now })
        .eq('id', id);
    }),
  );
}

// ─── iOS Contact Picker (single contact at a time) ──────────────────────────

/**
 * Opens the native iOS contact picker. Returns the selected contact's name
 * and (optional) phone number. Returns null if the user cancelled.
 *
 * Note: `presentContactPickerAsync` wraps CNContactPickerViewController, a
 * system sheet that does NOT require Contacts permission — Apple designed it
 * so users can share a single contact without granting full-book access.
 * Requesting permission here would prompt unnecessarily and confuse the
 * limited-access flow (iOS 14+).
 */
export async function pickContactFromPhone(): Promise<{
  name: string;
  phone?: string;
} | null> {
  const contact = await Contacts.presentContactPickerAsync();
  if (!contact) return null; // user cancelled

  const fallbackName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
  const name = contact.name?.trim() || fallbackName;
  if (!name) {
    throw new Error('That contact has no name. Pick a different one or add manually.');
  }

  const phone = contact.phoneNumbers?.[0]?.number;
  return { name, phone: phone ? normalizePhoneNumber(phone) : undefined };
}

/**
 * Picks a contact from the native picker and creates/returns a server-side
 * contact record. If the contact already exists (by phone), returns the existing one.
 * Contacts without a phone number are accepted — they land as name-only records.
 */
export async function pickAndCreateContact(ownerId: string): Promise<Contact | null> {
  const picked = await pickContactFromPhone();
  if (!picked) return null;

  // Dedup by phone when we have one
  if (picked.phone) {
    const { data: existing } = await supabase
      .from('contacts')
      .select('*, linked_user:users!contacts_linked_user_id_fkey(*)')
      .eq('owner_id', ownerId)
      .eq('phone_number', picked.phone)
      .maybeSingle();

    if (existing) return existing as Contact;
  }

  return createContact({
    owner_id: ownerId,
    display_name: picked.name,
    phone_number: picked.phone,
  });
}
