import { supabase } from '../lib/supabase';
import type { CreditEvent } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreditSummary {
  thisWeek: number;
  thisMonth: number;
  allTime: number;
}

// ─── Fetch credit events ─────────────────────────────────────────────────────

export async function fetchCreditEvents(
  userId: string,
  limit = 20,
): Promise<CreditEvent[]> {
  const { data, error } = await supabase
    .from('credit_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as CreditEvent[];
}

// ─── Fetch credit summary ────────────────────────────────────────────────────

export async function fetchCreditSummary(
  userId: string,
): Promise<CreditSummary> {
  const now = new Date();

  // Start of current week (Monday)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  // Start of current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [weekResult, monthResult, allTimeResult] = await Promise.all([
    supabase
      .from('credit_events')
      .select('credits')
      .eq('user_id', userId)
      .gte('created_at', weekStart.toISOString()),
    supabase
      .from('credit_events')
      .select('credits')
      .eq('user_id', userId)
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('credit_events')
      .select('credits')
      .eq('user_id', userId),
  ]);

  if (weekResult.error) throw weekResult.error;
  if (monthResult.error) throw monthResult.error;
  if (allTimeResult.error) throw allTimeResult.error;

  const sum = (rows: { credits: number }[]) =>
    rows.reduce((acc, r) => acc + r.credits, 0);

  return {
    thisWeek: sum((weekResult.data ?? []) as { credits: number }[]),
    thisMonth: sum((monthResult.data ?? []) as { credits: number }[]),
    allTime: sum((allTimeResult.data ?? []) as { credits: number }[]),
  };
}
