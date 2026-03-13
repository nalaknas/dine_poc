import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
const BASE64 = 'base64' as const;
import { Config } from '../constants/config';
import type { ReceiptData } from '../types';

/**
 * Compress and resize an image to keep Edge Function payload under limits.
 * Receipt text is readable at 1500px wide; quality 0.6 keeps detail while
 * reducing a typical iPhone photo from ~6MB to ~300KB.
 */
async function compressForOCR(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1500 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
  );
  return FileSystem.readAsStringAsync(result.uri, { encoding: BASE64 });
}

/**
 * Analyzes receipt images by calling the Supabase Edge Function.
 * The Edge Function handles Google Vision API + GPT-4o Mini parsing.
 * API keys stay server-side, never in the client bundle.
 */
export async function analyzeReceipt(imageUris: string[]): Promise<ReceiptData> {
  const supabaseUrl = Config.supabase.url;
  const anonKey = Config.supabase.anonKey;

  // Compress images before sending to keep payload small
  const base64Images = await Promise.all(imageUris.map(compressForOCR));

  // Use anon key as Bearer token. Supabase Edge Function gateway validates
  // the Authorization header with HS256, but Supabase Auth now issues ES256
  // user JWTs — causing "Invalid JWT". The anon key is HS256 and works.
  // This is safe: the Edge Function doesn't need user identity (it just does
  // OCR), and the apikey header already authenticates the request.
  const response = await fetch(`${supabaseUrl}/functions/v1/analyze-receipt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify({ images: base64Images }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Receipt analysis failed (${response.status}): ${text}`);
  }

  return (await response.json()) as ReceiptData;
}

/**
 * Upload a file to Supabase Storage via the upload-photo Edge Function.
 *
 * The Edge Function uses the service role key to bypass Storage RLS,
 * avoiding the ES256 JWT issue that blocks direct client uploads.
 */
async function storageUpload(bucket: string, path: string, base64: string): Promise<string> {
  const supabaseUrl = Config.supabase.url;
  const anonKey = Config.supabase.anonKey;

  const res = await fetch(`${supabaseUrl}/functions/v1/upload-photo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${anonKey}`,
      'apikey': anonKey,
    },
    body: JSON.stringify({ base64, bucket, path }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage upload failed (${res.status}): ${text}`);
  }

  const { url } = await res.json();
  return url;
}

/**
 * Uploads a receipt image to Supabase Storage.
 */
export async function uploadReceiptImage(
  uri: string,
  userId: string,
  fileName: string
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: BASE64 });
  return storageUpload('dine-images', `receipts/${userId}/${fileName}`, base64);
}

/**
 * Uploads a food photo to Supabase Storage and returns the public URL.
 */
export async function uploadFoodPhoto(
  uri: string,
  userId: string,
  fileName: string
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: BASE64 });
  return storageUpload('dine-images', `posts/${userId}/${fileName}`, base64);
}

/**
 * Uploads a profile avatar to Supabase Storage.
 */
export async function uploadAvatar(uri: string, userId: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: BASE64 });
  return storageUpload('dine-images', `profiles/${userId}/avatar.jpg`, base64);
}
