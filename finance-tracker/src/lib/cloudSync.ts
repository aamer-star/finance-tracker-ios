import { getValidToken } from './auth';
import type { AppData } from '../types';

export async function loadFromCloud(): Promise<AppData | null> {
  const token = await getValidToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/user-data', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function saveToCloud(appData: AppData): Promise<void> {
  const token = await getValidToken();
  if (!token) return;
  try {
    await fetch('/api/user-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ appData }),
    });
  } catch {
    // silent — local data still saved
  }
}
