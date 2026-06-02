const SESSION_KEY = 'ft_session';

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string };
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function storeSession(data: {
  access_token: string; refresh_token: string;
  expires_in: number; user: { id: string; email: string };
}): Session {
  const session: Session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    user: data.user,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function refreshSession(refresh_token: string): Promise<Session | null> {
  try {
    const res = await fetch('/.netlify/functions/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh', refresh_token }),
    });
    const data = await res.json();
    return res.ok ? storeSession(data) : null;
  } catch { return null; }
}

export async function getValidToken(): Promise<string | null> {
  let session = getSession();
  if (!session) return null;
  if (session.expires_at - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshSession(session.refresh_token);
    if (!refreshed) { clearSession(); return null; }
    session = refreshed;
  }
  return session.access_token;
}

export async function signUp(email: string, password: string): Promise<{ session: Session | null; error: string | null }> {
  try {
    const res = await fetch('/.netlify/functions/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signup', email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { session: null, error: data.error || 'Signup failed' };
    return { session: storeSession(data), error: null };
  } catch { return { session: null, error: 'Network error. Try again.' }; }
}

export async function signIn(email: string, password: string): Promise<{ session: Session | null; error: string | null }> {
  try {
    const res = await fetch('/.netlify/functions/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'signin', email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { session: null, error: data.error || 'Invalid email or password' };
    return { session: storeSession(data), error: null };
  } catch { return { session: null, error: 'Network error. Try again.' }; }
}

export function signOut(): void {
  clearSession();
}
