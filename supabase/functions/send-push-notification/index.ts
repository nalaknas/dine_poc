import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map notification types to the preference key they correspond to
const TYPE_TO_PREFERENCE: Record<string, string> = {
  like: 'likes',
  comment: 'comments',
  comment_like: 'comments',
  tag: 'tags',
  follow: 'follows',
  recommendation: 'recommendations',
};

interface PushRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  notificationType?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, title, body, data, notificationType } =
      (await req.json()) as PushRequest;

    if (!userId || !title || !body) {
      throw new Error('Missing required fields: userId, title, body');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch user's push token and notification preferences
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('expo_push_token, notification_preferences')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ sent: false, reason: 'user_not_found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // No push token registered
    if (!user.expo_push_token) {
      return new Response(
        JSON.stringify({ sent: false, reason: 'no_push_token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check notification preferences
    if (notificationType) {
      const prefKey = TYPE_TO_PREFERENCE[notificationType];
      if (prefKey) {
        const prefs = user.notification_preferences ?? {};
        if (prefs[prefKey] === false) {
          return new Response(
            JSON.stringify({ sent: false, reason: 'preference_disabled' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }
    }

    // Send via Expo Push API
    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        to: user.expo_push_token,
        title,
        body,
        data: data ?? {},
        sound: 'default',
        badge: 1,
      }),
    });

    if (!pushResponse.ok) {
      const errText = await pushResponse.text();
      throw new Error(`Expo Push API error: ${pushResponse.status} — ${errText}`);
    }

    const pushResult = await pushResponse.json();

    // Check for Expo-level errors (invalid token, etc.)
    const ticket = pushResult.data;
    if (ticket?.status === 'error') {
      // If the token is invalid, clear it from the user record
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await supabase
          .from('users')
          .update({ expo_push_token: null })
          .eq('id', userId);
      }
      return new Response(
        JSON.stringify({
          sent: false,
          reason: 'expo_error',
          error: ticket.message,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ sent: true, ticketId: ticket?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('send-push-notification error:', error);
    return new Response(
      JSON.stringify({ error: error.message ?? 'Push notification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
