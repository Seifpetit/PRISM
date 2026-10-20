import { api } from "@/api/api";
import { clearSessionToken, getSessionToken, setSessionToken } from "@/lib/session-token";
import type { AuthSession } from "@/types/auth";

const RESTORE_ATTEMPTS = 8;

/** Only the backend saying the session is gone signs the person out. A backend that can't be reached yet (it is
 * restarting) is waited for, and the saved session is kept either way, so a reload during a restart doesn't sign
 * anyone out. */
export async function restoreSession(): Promise<AuthSession | null> {
  if (!getSessionToken()) return null;
  for (let attempt = 1; ; attempt += 1) {
    try {
      const session = await api.session();
      if (!session) clearSessionToken();
      return session;
    } catch (error) {
      // fetch rejects with a TypeError only when the request never got an answer: wait for the backend. Any other
      // failure (a 5xx, a proxy page) says nothing about the session either, so it is kept.
      if (!(error instanceof TypeError) || attempt >= RESTORE_ATTEMPTS) return null;
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
}

export async function signInWithoutPassword(input: {
  displayName: string;
  email: string;
}): Promise<AuthSession> {
  const session = await api.signInWithoutPassword(input);
  setSessionToken(session.token);
  return session;
}

export async function signOut(): Promise<void> {
  try {
    await api.signOut();
  } finally {
    clearSessionToken();
  }
}
