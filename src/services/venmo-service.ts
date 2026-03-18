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
 */
export function buildMealNote(restaurantName: string): string {
  return `Dine: Dinner at ${restaurantName}`;
}

/**
 * Returns breakdowns that have Venmo usernames set.
 */
export function getVenmoableBreakdowns(breakdowns: PersonBreakdown[]): PersonBreakdown[] {
  return breakdowns.filter((b) => b.friend.venmo_username && b.total > 0);
}
