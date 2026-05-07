import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';

export interface SenderSplitLine {
  id: string;
  recipient_user_id: string | null;
  recipient_name: string;
  recipient_phone: string | null;
  amount: number;
  status: 'pending' | 'viewed' | 'paid' | 'cancelled';
  viewed_at: string | null;
  paid_at: string | null;
  updated_at: string;
}

export interface SenderSplit {
  id: string;
  restaurant_name: string;
  note: string | null;
  public_token: string;
  expires_at: string;
  created_at: string;
  lines: SenderSplitLine[];
}

const LANDING_BASE_URL = 'https://joindine.app';

export async function fetchSenderSplits(userId: string, limit = 50): Promise<SenderSplit[]> {
  const { data, error } = await supabase
    .from('split_requests')
    .select(
      `id, restaurant_name, note, public_token, expires_at, created_at,
       lines:split_request_lines(id, recipient_user_id, recipient_name, recipient_phone, amount, status, viewed_at, paid_at, updated_at)`,
    )
    .eq('sender_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  // Embedded lines aren't ordered by Supabase; sort newest first by amount desc as a stable secondary.
  return (data ?? []).map((row: any) => ({
    ...row,
    lines: ((row.lines ?? []) as SenderSplitLine[]).sort((a, b) => b.amount - a.amount),
  }));
}

export async function fetchSenderSplitById(splitId: string): Promise<SenderSplit | null> {
  const { data, error } = await supabase
    .from('split_requests')
    .select(
      `id, restaurant_name, note, public_token, expires_at, created_at,
       lines:split_request_lines(id, recipient_user_id, recipient_name, recipient_phone, amount, status, viewed_at, paid_at, updated_at)`,
    )
    .eq('id', splitId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...(data as any),
    lines: ((data as any).lines ?? []).sort((a: SenderSplitLine, b: SenderSplitLine) => b.amount - a.amount),
  };
}

/**
 * Sender override: mark a single line as paid. RLS allows the sender to
 * update their own lines, so we can call this directly without going
 * through the public RPC (which expects a token).
 */
export async function senderMarkLinePaid(lineId: string): Promise<void> {
  const { error } = await supabase
    .from('split_request_lines')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', lineId);
  if (error) throw error;
}

/**
 * Sets every line in a split to `cancelled`. RLS allows the sender to do
 * this in one statement. The recipient's landing page reads the line
 * status when fetching by token; PR #3 (dine-landing) will render a
 * "this request was cancelled" empty state when ALL lines are cancelled.
 */
export async function cancelSenderSplit(splitId: string): Promise<void> {
  const { error } = await supabase
    .from('split_request_lines')
    .update({ status: 'cancelled' })
    .eq('split_request_id', splitId);
  if (error) throw error;
}

/**
 * Re-fires the iOS Messages share sheet for an existing split, with the
 * same recipients and body it had originally. We rebuild the body
 * client-side rather than calling the Edge Function again — that would
 * create a duplicate split_request and confuse the recipient.
 */
export async function resendSmsForSplit(split: SenderSplit): Promise<boolean> {
  const phones = Array.from(
    new Set(split.lines.map((l) => l.recipient_phone).filter((p): p is string => !!p)),
  );
  if (phones.length === 0) return false;
  const landingUrl = `${LANDING_BASE_URL}/r/${split.public_token}`;
  const body = `${split.restaurant_name} bill — your share: ${landingUrl}`;
  const url = `sms:${phones.join(',')}&body=${encodeURIComponent(body)}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) return false;
  await Linking.openURL(url);
  return true;
}

export function summarizeSplit(split: SenderSplit) {
  const total = split.lines.reduce((sum, l) => sum + l.amount, 0);
  const paid = split.lines.filter((l) => l.status === 'paid').length;
  const viewed = split.lines.filter((l) => l.status === 'viewed').length;
  const cancelled = split.lines.filter((l) => l.status === 'cancelled').length;
  const pending = split.lines.length - paid - viewed - cancelled;
  return { total, paid, viewed, pending, cancelled, count: split.lines.length };
}
