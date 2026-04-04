import { supabase } from '../lib/supabase';
import type {
  DiningPlan,
  DiningPlanMember,
  DiningPlanRestaurant,
  DiningPlanDateOption,
  RestaurantVote,
  DateVote,
  RestaurantSource,
} from '../types';

// ─── Create Plan ─────────────────────────────────────────────────────────────

/**
 * Creates a new dining plan and adds the host + invited members.
 * Host is inserted as role='host', status='accepted'; others as 'member'/'pending'.
 */
export async function createDiningPlan(
  hostId: string,
  title: string,
  memberIds: string[],
  notes?: string,
): Promise<DiningPlan> {
  // 1. Create the plan
  const { data: plan, error: planError } = await supabase
    .from('dining_plans')
    .insert({ host_id: hostId, title, notes })
    .select()
    .single();

  if (planError || !plan) throw planError ?? new Error('Failed to create dining plan');

  // 2. Insert members (host + invitees)
  const memberRows = [
    { plan_id: plan.id, user_id: hostId, role: 'host', status: 'accepted' },
    ...memberIds.map((id) => ({
      plan_id: plan.id,
      user_id: id,
      role: 'member' as const,
      status: 'pending' as const,
    })),
  ];

  const { error: membersError } = await supabase
    .from('dining_plan_members')
    .insert(memberRows);

  if (membersError) throw membersError;

  return plan as DiningPlan;
}

// ─── Fetch Plans ─────────────────────────────────────────────────────────────

/** Fetches all plans for a user via the get_my_dining_plans RPC. */
export async function fetchMyPlans(userId: string): Promise<DiningPlan[]> {
  const { data, error } = await supabase.rpc('get_my_dining_plans', {
    p_user_id: userId,
  });

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    host_id: row.host_id as string,
    title: row.title as string,
    status: row.status as DiningPlan['status'],
    chosen_restaurant_name: row.chosen_restaurant_name as string | undefined,
    chosen_restaurant_city: row.chosen_restaurant_city as string | undefined,
    chosen_date: row.chosen_date as string | undefined,
    notes: row.notes as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    member_count: Number(row.member_count ?? 0),
    accepted_count: Number(row.accepted_count ?? 0),
    my_role: row.user_role as DiningPlan['my_role'],
    my_status: row.user_status as DiningPlan['my_status'],
  }));
}

// ─── Plan Detail ─────────────────────────────────────────────────────────────

/** Fetches a plan with members (joined to users for avatar/name), restaurants, and votes. */
export async function fetchPlanDetail(planId: string): Promise<{
  plan: DiningPlan;
  members: DiningPlanMember[];
  restaurants: DiningPlanRestaurant[];
  dateOptions: DiningPlanDateOption[];
}> {
  const [planRes, membersRes, restaurantsRes, dateOptionsRes] = await Promise.all([
    supabase.from('dining_plans').select('*').eq('id', planId).single(),
    supabase
      .from('dining_plan_members')
      .select('*, user:users!dining_plan_members_user_id_fkey(id, display_name, username, avatar_url)')
      .eq('plan_id', planId),
    supabase
      .from('dining_plan_restaurants')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: true }),
    supabase
      .from('dining_plan_date_options')
      .select('*')
      .eq('plan_id', planId)
      .order('proposed_date', { ascending: true }),
  ]);

  if (planRes.error) throw planRes.error;

  return {
    plan: planRes.data as DiningPlan,
    members: (membersRes.data ?? []) as DiningPlanMember[],
    restaurants: (restaurantsRes.data ?? []) as DiningPlanRestaurant[],
    dateOptions: (dateOptionsRes.data ?? []) as DiningPlanDateOption[],
  };
}

// ─── Invite Response ─────────────────────────────────────────────────────────

/** Accept or decline a dining plan invite. */
export async function respondToInvite(
  planId: string,
  userId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('dining_plan_members')
    .update({
      status: accept ? 'accepted' : 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('plan_id', planId)
    .eq('user_id', userId);

  if (error) throw error;
}

// ─── Restaurant Candidates ───────────────────────────────────────────────────

/** Adds a restaurant candidate for voting. */
export async function addRestaurant(
  planId: string,
  restaurantName: string,
  city: string,
  state: string,
  cuisineType: string,
  suggestedBy: string,
  source: RestaurantSource,
): Promise<DiningPlanRestaurant> {
  const { data, error } = await supabase
    .from('dining_plan_restaurants')
    .insert({
      plan_id: planId,
      restaurant_name: restaurantName,
      city,
      state,
      cuisine_type: cuisineType,
      source,
      suggested_by: suggestedBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data as DiningPlanRestaurant;
}

// ─── Restaurant Voting ──────────────────────────────────────────────────────

/** Cast or update a vote on a restaurant candidate. */
export async function castVote(
  planRestaurantId: string,
  userId: string,
  vote: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('restaurant_votes')
    .upsert(
      { plan_restaurant_id: planRestaurantId, user_id: userId, vote },
      { onConflict: 'plan_restaurant_id,user_id' },
    );

  if (error) throw error;
}

/** Fetch the user's current votes for restaurants in a plan. */
export async function fetchMyRestaurantVotes(
  planId: string,
  userId: string,
): Promise<RestaurantVote[]> {
  const { data, error } = await supabase
    .from('restaurant_votes')
    .select('*, dining_plan_restaurants!inner(plan_id)')
    .eq('dining_plan_restaurants.plan_id', planId)
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []) as RestaurantVote[];
}

/** Fetch vote results via the get_vote_results RPC. */
export async function fetchVoteResults(planId: string): Promise<DiningPlanRestaurant[]> {
  const { data, error } = await supabase.rpc('get_vote_results', {
    p_plan_id: planId,
  });

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.restaurant_id as string,
    plan_id: planId,
    restaurant_name: row.restaurant_name as string,
    city: row.city as string | undefined,
    state: row.state as string | undefined,
    cuisine_type: row.cuisine_type as string | undefined,
    source: row.source as RestaurantSource,
    suggested_by: row.suggested_by as string | undefined,
    upvotes: Number(row.upvotes ?? 0),
    downvotes: Number(row.downvotes ?? 0),
    net_score: Number(row.net_score ?? 0),
  }));
}

// ─── Date Options ────────────────────────────────────────────────────────────

/** Add a date/time proposal to a plan. */
export async function addDateOption(
  planId: string,
  proposedDate: string,
  proposedBy: string,
): Promise<DiningPlanDateOption> {
  const { data, error } = await supabase
    .from('dining_plan_date_options')
    .insert({ plan_id: planId, proposed_date: proposedDate, proposed_by: proposedBy })
    .select()
    .single();

  if (error) throw error;
  return data as DiningPlanDateOption;
}

/** Cast or update a vote on a date option. */
export async function castDateVote(
  dateOptionId: string,
  userId: string,
  vote: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('date_votes')
    .upsert(
      { date_option_id: dateOptionId, user_id: userId, vote },
      { onConflict: 'date_option_id,user_id' },
    );

  if (error) throw error;
}

/** Fetch the user's current votes for date options in a plan. */
export async function fetchMyDateVotes(
  planId: string,
  userId: string,
): Promise<DateVote[]> {
  const { data, error } = await supabase
    .from('date_votes')
    .select('*, dining_plan_date_options!inner(plan_id)')
    .eq('dining_plan_date_options.plan_id', planId)
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []) as DateVote[];
}

/** Fetch date options with aggregated vote counts. */
export async function fetchDateResults(planId: string): Promise<DiningPlanDateOption[]> {
  const { data: options, error: optError } = await supabase
    .from('dining_plan_date_options')
    .select('*')
    .eq('plan_id', planId)
    .order('proposed_date', { ascending: true });

  if (optError) throw optError;

  // Aggregate votes for each option
  const optionIds = (options ?? []).map((o: { id: string }) => o.id);
  if (optionIds.length === 0) return [];

  const { data: votes } = await supabase
    .from('date_votes')
    .select('date_option_id, vote')
    .in('date_option_id', optionIds);

  const voteTallies: Record<string, { upvotes: number; downvotes: number }> = {};
  for (const v of (votes ?? []) as Array<{ date_option_id: string; vote: boolean }>) {
    if (!voteTallies[v.date_option_id]) {
      voteTallies[v.date_option_id] = { upvotes: 0, downvotes: 0 };
    }
    if (v.vote) {
      voteTallies[v.date_option_id].upvotes++;
    } else {
      voteTallies[v.date_option_id].downvotes++;
    }
  }

  return (options ?? []).map((opt: Record<string, unknown>) => ({
    id: opt.id as string,
    plan_id: opt.plan_id as string,
    proposed_date: opt.proposed_date as string,
    proposed_by: opt.proposed_by as string,
    upvotes: voteTallies[opt.id as string]?.upvotes ?? 0,
    downvotes: voteTallies[opt.id as string]?.downvotes ?? 0,
  }));
}

// ─── Plan Status Management ─────────────────────────────────────────────────

/** Host-only status update with optional chosen restaurant/date. */
export async function updatePlanStatus(
  planId: string,
  status: string,
  chosenRestaurant?: { name: string; city: string },
  chosenDate?: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (chosenRestaurant) {
    updates.chosen_restaurant_name = chosenRestaurant.name;
    updates.chosen_restaurant_city = chosenRestaurant.city;
  }

  if (chosenDate) {
    updates.chosen_date = chosenDate;
  }

  const { error } = await supabase
    .from('dining_plans')
    .update(updates)
    .eq('id', planId);

  if (error) throw error;
}

// ─── Realtime Subscription ──────────────────────────────────────────────────

/**
 * Subscribes to realtime changes on a dining plan and its members.
 * Returns an unsubscribe function.
 */
export function subscribeToPlan(planId: string, callback: () => void): () => void {
  const channel = supabase
    .channel(`dining-plan-${planId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'dining_plans', filter: `id=eq.${planId}` },
      () => callback(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'dining_plan_members', filter: `plan_id=eq.${planId}` },
      () => callback(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'dining_plan_restaurants', filter: `plan_id=eq.${planId}` },
      () => callback(),
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'dining_plan_date_options', filter: `plan_id=eq.${planId}` },
      () => callback(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
