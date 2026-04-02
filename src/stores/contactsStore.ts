import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Contact, Friend } from '../types';
import {
  getContacts,
  createContact,
  updateContact as updateContactApi,
  deleteContact as deleteContactApi,
  contactToFriend,
  pickAndCreateContact,
  normalizePhoneNumber,
} from '../services/contact-service';
import type { SplitHistoryEntry } from './splitHistoryStore';

const LEGACY_STORAGE_KEY = '@dine:split_history';

interface ContactsState {
  contacts: Contact[];
  isLoaded: boolean;
  isLoading: boolean;

  /** Fetch all contacts from Supabase and cache in memory */
  loadContacts: (userId: string) => Promise<void>;

  /** Create a new contact server-side and add to local cache */
  addContact: (params: {
    owner_id: string;
    display_name: string;
    phone_number?: string;
    venmo_username?: string;
  }) => Promise<Contact>;

  /** Update a contact's fields (venmo, name, phone) */
  updateContact: (contactId: string, updates: { display_name?: string; phone_number?: string; venmo_username?: string }) => Promise<void>;

  /** Delete a contact */
  deleteContact: (contactId: string) => Promise<void>;

  /** Get top contacts sorted by split_count */
  getTopContacts: (limit?: number) => Contact[];

  /** Local search on cached contacts by display_name */
  searchLocalContacts: (query: string) => Contact[];

  /** Find a contact by phone number */
  findByPhone: (phone: string) => Contact | undefined;

  /** Pick a single contact from the native iOS contact picker */
  pickContact: (userId: string) => Promise<Contact | null>;

  /** One-time migration from local splitHistoryStore to server-side contacts */
  migrateFromLocalHistory: (userId: string) => Promise<void>;
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  isLoaded: false,
  isLoading: false,

  loadContacts: async (userId: string) => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      // One-time migration from legacy local split history
      await get().migrateFromLocalHistory(userId);
      const contacts = await getContacts(userId);
      set({ contacts, isLoaded: true, isLoading: false });
    } catch {
      set({ isLoaded: true, isLoading: false });
    }
  },

  addContact: async (params) => {
    const contact = await createContact(params);
    set((state) => ({ contacts: [contact, ...state.contacts] }));
    return contact;
  },

  updateContact: async (contactId, updates) => {
    const updated = await updateContactApi(contactId, updates);
    set((state) => ({
      contacts: state.contacts.map((c) => (c.id === contactId ? updated : c)),
    }));
  },

  deleteContact: async (contactId) => {
    await deleteContactApi(contactId);
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== contactId),
    }));
  },

  getTopContacts: (limit = 10) => {
    return [...get().contacts]
      .sort((a, b) => b.split_count - a.split_count)
      .slice(0, limit);
  },

  searchLocalContacts: (query: string) => {
    const lower = query.toLowerCase();
    return get().contacts.filter((c) =>
      c.display_name.toLowerCase().includes(lower) ||
      (c.linked_user?.username?.toLowerCase().includes(lower) ?? false),
    );
  },

  findByPhone: (phone: string) => {
    const normalized = normalizePhoneNumber(phone);
    return get().contacts.find((c) => c.phone_number === normalized);
  },

  pickContact: async (userId: string) => {
    const contact = await pickAndCreateContact(userId);
    if (!contact) return null;

    // Add to local cache if not already present
    const exists = get().contacts.some((c) => c.id === contact.id);
    if (!exists) {
      set((state) => ({ contacts: [contact, ...state.contacts] }));
    }
    return contact;
  },

  migrateFromLocalHistory: async (userId: string) => {
    try {
      const raw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return;

      const entries: SplitHistoryEntry[] = JSON.parse(raw);
      if (entries.length === 0) return;

      // Create contacts for each legacy entry (skip self)
      for (const entry of entries) {
        // Skip entries that are the current user
        if (entry.user_id === userId) continue;

        try {
          await createContact({
            owner_id: userId,
            display_name: entry.display_name,
            venmo_username: entry.venmo_username,
            // Legacy entries don't have phone numbers
          });
        } catch {
          // Ignore duplicates or other errors
        }
      }

      // Clear legacy storage
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);

      // Reload contacts from server to get the full picture
      const contacts = await getContacts(userId);
      set({ contacts });
    } catch {
      // Don't break the app if migration fails
    }
  },
}));

/** Helper: convert a Contact to a Friend for use in bill splitting */
export { contactToFriend } from '../services/contact-service';
