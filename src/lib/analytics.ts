import { Mixpanel } from 'mixpanel-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../constants/config';

// ── Singleton ──────────────────────────────────────────────
let mp: Mixpanel | null = null;
let initPromise: Promise<void> | null = null;

export function initAnalytics(): void {
  const token = Config.mixpanel.token;
  if (!token) {
    console.warn('[analytics] Mixpanel token not configured — skipping init');
    return;
  }
  // useNative=false for Expo Go compatibility; AsyncStorage for persistence
  const instance = new Mixpanel(token, true, false, AsyncStorage);
  instance.setLoggingEnabled(true); // debug mode per wizard config
  initPromise = instance.init().then(() => {
    mp = instance;
    console.log('[analytics] Mixpanel initialized');
  });
}

/** Wait for Mixpanel to be ready (use in critical paths like identify) */
async function ready(): Promise<Mixpanel | null> {
  if (initPromise) await initPromise;
  return mp;
}

// ── Identity ───────────────────────────────────────────────
export async function identifyUser(
  userId: string,
  properties?: { email?: string; name?: string; avatar_url?: string },
) {
  const instance = await ready();
  if (!instance) return;
  await instance.identify(userId);
  if (properties) {
    const peopleProps: Record<string, string> = {};
    if (properties.email) peopleProps['$email'] = properties.email;
    if (properties.name) peopleProps['$name'] = properties.name;
    if (properties.avatar_url) peopleProps['$avatar'] = properties.avatar_url;
    instance.getPeople().set(peopleProps);
  }
}

export function resetAnalytics() {
  mp?.reset();
}

// ── Generic track ──────────────────────────────────────────
export function track(event: string, properties?: Record<string, unknown>) {
  mp?.track(event, properties);
}

// ── Screen views (Page View equivalent) ────────────────────
export function trackScreen(screenName: string) {
  mp?.track('Page View', { page_title: screenName });
}

// ── Auth events ────────────────────────────────────────────
export function trackSignUp(properties: {
  userId: string;
  email?: string;
  signupMethod?: string;
}) {
  mp?.track('Sign Up', {
    user_id: properties.userId,
    email: properties.email,
    signup_method: properties.signupMethod ?? 'email',
  });
}

export function trackSignIn(properties: {
  userId: string;
  loginMethod?: string;
  success: boolean;
}) {
  mp?.track('Sign In', {
    user_id: properties.userId,
    login_method: properties.loginMethod ?? 'email',
    success: properties.success,
  });
}

// ── Post creation funnel ───────────────────────────────────
//
// Funnel events fired by both flows. Build a Mixpanel funnel breaking down
// by `flow` to compare full vs quick:
//
//   1. post_creation_step (step_index = 0)         — flow opened
//   2. post_publish_attempted                      — user tapped Post
//   3. post_created                                — server returned a row
//
// Drop-off between (1)→(2) = abandonment before submit.
// Drop-off between (2)→(3) = silent failure (RLS, network, etc).
// post_creation_abandoned fires when the user exits without reaching (3).
//
// Every event below carries `flow: 'full' | 'quick'`. Don't drop it.

export type PostFlow = 'full' | 'quick';

let postCreationStartedAt: number | null = null;
let postWasCreated = false;

export function trackPostCreationStep(step: string, stepIndex: number, flow: PostFlow) {
  if (stepIndex === 0) {
    postCreationStartedAt = Date.now();
    postWasCreated = false;
  }
  mp?.track('post_creation_step', {
    step,
    step_index: stepIndex,
    flow,
    elapsed_ms: postCreationStartedAt ? Date.now() - postCreationStartedAt : 0,
  });
}

export function trackPostPublishAttempted(properties: {
  flow: PostFlow;
  restaurantName?: string;
  friendCount?: number;
  photoCount?: number;
}) {
  const elapsed = postCreationStartedAt ? Date.now() - postCreationStartedAt : undefined;
  mp?.track('post_publish_attempted', { ...properties, elapsed_ms: elapsed });
}

export function trackPostCreated(properties: {
  postId: string;
  isPublic: boolean;
  friendCount: number;
  photoCount: number;
  dishRatingCount: number;
  restaurantName?: string;
  flow: PostFlow;
}) {
  const timeToPost = postCreationStartedAt ? Date.now() - postCreationStartedAt : undefined;

  // Core post_created event
  mp?.track('post_created', { ...properties, time_to_post_ms: timeToPost });

  // Conversion event (post creation is Dine's value moment)
  mp?.track('Conversion', {
    'Conversion Type': 'post_creation',
    'Conversion Value': properties.friendCount,
    flow: properties.flow,
  });

  postCreationStartedAt = null;
  postWasCreated = true;

  // Track time-to-first-post via people property (Mixpanel sets once)
  mp?.getPeople().setOnce('first_post_at', new Date().toISOString());
}

export function trackPostAbandoned(lastStep: string, lastStepIndex: number, flow: PostFlow) {
  const elapsed = postCreationStartedAt ? Date.now() - postCreationStartedAt : undefined;
  mp?.track('post_creation_abandoned', {
    last_step: lastStep,
    last_step_index: lastStepIndex,
    flow,
    elapsed_ms: elapsed,
  });
  postCreationStartedAt = null;
}

/**
 * Use in screen unmount / `beforeRemove` to fire abandonment only when the
 * user is leaving without having published. No-op if a post was just created.
 */
export function trackPostAbandonedIfNotCreated(lastStep: string, lastStepIndex: number, flow: PostFlow) {
  if (postWasCreated || postCreationStartedAt === null) return;
  trackPostAbandoned(lastStep, lastStepIndex, flow);
}

// ── Engagement events ──────────────────────────────────────
export function trackPostLiked(postId: string, authorId: string) {
  mp?.track('post_liked', { post_id: postId, author_id: authorId });
}

export function trackPostShared(postId: string, destination: string) {
  mp?.track('post_shared', { post_id: postId, destination });
}

// ── Search ─────────────────────────────────────────────────
export function trackSearch(properties: {
  searchQuery: string;
  resultsCount: number;
}) {
  mp?.track('Search', {
    search_query: properties.searchQuery,
    results_count: properties.resultsCount,
  });
}

// ── Error tracking ─────────────────────────────────────────
export function trackError(properties: {
  errorType: string;
  errorMessage: string;
  errorCode?: string;
  screenName?: string;
}) {
  mp?.track('Error', {
    error_type: properties.errorType,
    error_message: properties.errorMessage,
    error_code: properties.errorCode,
    screen_name: properties.screenName,
  });
}

// ── Bill splitting ─────────────────────────────────────────
export function trackBillSplitCompleted(properties: {
  friendCount: number;
  totalAmount: number;
  restaurantName?: string;
  venmoRequestsSent: number;
}) {
  mp?.track('bill_split_completed', properties);

  // Purchase equivalent — bill split is Dine's "transaction"
  mp?.track('Purchase', {
    transaction_id: `split_${Date.now()}`,
    revenue: properties.totalAmount,
    currency: 'USD',
  });
}

// ── Social ─────────────────────────────────────────────────
export function trackFriendInvited(friendType: 'app_user' | 'contact' | 'manual') {
  mp?.track('friend_invited', { friend_type: friendType });
}
