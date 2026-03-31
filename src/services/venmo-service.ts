import { Linking } from 'react-native';
import type { PersonBreakdown } from '../types';

/**
 * Builds a Venmo deep link to request money from a specific person.
 * venmo://paycharge?txn=charge&recipients={username}&amount={amount}&note={note}
 */
export function buildVenmoDeepLink(params: {
  venmoUsername: string;
  amount: number;
  note: string;
}): string {
  const { venmoUsername, amount, note } = params;
  const cleanUsername = venmoUsername.replace(/^@+/, '');
  return `venmo://paycharge?txn=charge&recipients=${encodeURIComponent(cleanUsername)}&amount=${amount.toFixed(2)}&note=${encodeURIComponent(note)}`;
}

/**
 * Fallback web URL if Venmo app is not installed.
 */
export function buildVenmoWebUrl(venmoUsername: string): string {
  const cleanUsername = venmoUsername.replace(/^@+/, '');
  return `https://venmo.com/${cleanUsername}`;
}

/**
 * Opens the Venmo app for a payment request, with web fallback.
 */
export async function openVenmoRequest(params: {
  venmoUsername: string;
  amount: number;
  note: string;
}): Promise<void> {
  const deepLink = buildVenmoDeepLink(params);
  const canOpen = await Linking.canOpenURL(deepLink);

  if (canOpen) {
    await Linking.openURL(deepLink);
  } else {
    // Fall back to Venmo web profile
    await Linking.openURL(buildVenmoWebUrl(params.venmoUsername));
  }
}

/**
 * Builds the payment note for a meal split request.
 * Includes a deep link back to Dine for viral growth.
 */
export function buildMealNote(restaurantName: string, splitId?: string): string {
  const base = `Split from ${restaurantName} on Dine`;
  if (splitId) {
    return `${base} — dine.app/split/${splitId}`;
  }
  return base;
}

/**
 * Returns breakdowns that have Venmo usernames set.
 */
export function getVenmoableBreakdowns(breakdowns: PersonBreakdown[]): PersonBreakdown[] {
  return breakdowns.filter((b) => b.friend.venmo_username && b.total > 0);
}

/**
 * Opens the Venmo app so the user can view/copy their username.
 * Returns false if Venmo is not installed.
 */
export async function openVenmoApp(): Promise<boolean> {
  const canOpen = await Linking.canOpenURL('venmo://');
  if (canOpen) {
    await Linking.openURL('venmo://');
    return true;
  }
  return false;
}

/**
 * Checks if a string is a valid Venmo username.
 */
export function isValidVenmoUsername(username: string): boolean {
  const clean = username.replace(/^@+/, '').trim();
  return /^[a-zA-Z0-9_-]{1,30}$/.test(clean);
}

/**
 * Cleans a Venmo username: trims whitespace and strips leading @ symbols.
 */
export function cleanVenmoUsername(username: string): string {
  return username.trim().replace(/^@+/, '');
}
