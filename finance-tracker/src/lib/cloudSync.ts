import { supabase } from './supabase';
import type { AppData } from '../types';

export async function loadFromCloud(userId: string): Promise<AppData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_data')
    .select('data')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data.data as AppData;
}

export async function saveToCloud(userId: string, appData: AppData): Promise<void> {
  if (!supabase) return;
  await supabase.from('user_data').upsert(
    { user_id: userId, data: appData, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}
