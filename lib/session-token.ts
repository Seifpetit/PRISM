const storageKey = "prism-session-token";

export function getSessionToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(storageKey);
}

export function setSessionToken(token: string) {
  window.localStorage.setItem(storageKey, token);
}

export function clearSessionToken() {
  window.localStorage.removeItem(storageKey);
}
