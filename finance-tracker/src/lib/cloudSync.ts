import { supabase } from './supabase';
import type { AppData } from '../types';

async function getToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function loadFromCloud(): Promise<AppData | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await fetch('/.netlify/functions/user-data', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function saveToCloud(appData: AppData): Promise<void> {
  const token = await getToken();
  if (!token) return;
  try {
    await fetch('/.netlify/functions/user-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ appData }),
    });
  } catch {
    // silent fail — local data is still saved
  }
}
