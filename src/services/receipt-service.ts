import * as FileSystem from 'expo-file-system/legacy';
const BASE64 = 'base64' as const;
import { supabase } from '../lib/supabase';
import { Config } from '../constants/config';
import type { ReceiptData } from '../types';

/**
 * Analyzes receipt images by calling the Supabase Edge Function.
 * The Edge Function handles Google Vision API + GPT-4o Mini parsing.
 * API keys stay server-side, never in the client bundle.
 */
export async function analyzeReceipt(imageUris: string[]): Promise<ReceiptData> {
  // Convert local image URIs to base64
  const base64Images = await Promise.all(
    imageUris.map(async (uri) => {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: BASE64,
      });
      return base64;
    })
  );

  // Use direct fetch instead of supabase.functions.invoke for better error handling
  const anonKey = Config.supabase.anonKey;
  const functionUrl = `${Config.supabase.url}/functions/v1/analyze-receipt`;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify({ images: base64Images }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error ?? `Edge Function returned ${response.status}`);
  }

  return data as ReceiptData;
}

/**
 * Uploads a receipt image to Supabase Storage.
 */
export async function uploadReceiptImage(
  uri: string,
  userId: string,
  fileName: string
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: BASE64,
  });

  const path = `receipts/${userId}/${fileName}`;
  const { error } = await supabase.storage
    .from('dine-images')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('dine-images').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Uploads a food photo to Supabase Storage and returns the public URL.
 */
export async function uploadFoodPhoto(
  uri: string,
  userId: string,
  fileName: string
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: BASE64,
  });

  const path = `posts/${userId}/${fileName}`;
  const { error } = await supabase.storage
    .from('dine-images')
    .upload(path, decode(base64), { contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('dine-images').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Uploads a profile avatar to Supabase Storage.
 */
export async function uploadAvatar(uri: string, userId: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: BASE64,
  });

  const path = `profiles/${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from('dine-images')
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('dine-images').getPublicUrl(path);
  return data.publicUrl;
}

// Utility: decode base64 string to Uint8Array
function decode(base64: string): Uint8Array {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}
