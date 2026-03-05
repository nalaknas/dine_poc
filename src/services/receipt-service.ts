import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
const BASE64 = 'base64' as const;
import { supabase } from '../lib/supabase';
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
  // Compress images before sending to keep payload small
  const base64Images = await Promise.all(imageUris.map(compressForOCR));

  // supabase.functions.invoke automatically sends the user's session JWT
  const { data, error } = await supabase.functions.invoke('analyze-receipt', {
    body: { images: base64Images },
  });

  if (error) {
    // FunctionsHttpError hardcodes its message; the real error is in the Response context
    let msg = 'Receipt analysis failed';
    try {
      const res = (error as any).context;
      if (res && typeof res.json === 'function') {
        const body = await res.json();
        msg = body.error || `Edge Function error (${res.status})`;
      }
    } catch {
      msg = error.message;
    }
    throw new Error(msg);
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
