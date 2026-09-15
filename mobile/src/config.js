import Constants from 'expo-constants';

// The backend (../server.js) must be reachable from the phone. By default we
// reuse whatever host Metro itself reports — the common case where the same
// machine runs both `expo start` and the backend. Overrides (see
// .env.example), in order of precedence:
//   EXPO_PUBLIC_API_URL  — a full base URL, for a backend that isn't plain
//                          http://host:port (e.g. https://…onrender.com).
//   EXPO_PUBLIC_API_HOST — just the host, when the backend is on a different
//                          machine than Metro (e.g. over Tailscale).
function detectHost() {
  if (process.env.EXPO_PUBLIC_API_HOST) return process.env.EXPO_PUBLIC_API_HOST;
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')?.[0];
  return host || 'localhost';
}

// React Native has no btoa/Buffer, and this is the only thing here that
// needs base64 — so encode the (ASCII) credentials by hand rather than
// pulling in a polyfill.
function base64Encode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  while (i < str.length) {
    const a = str.charCodeAt(i++);
    const b = i < str.length ? str.charCodeAt(i++) : NaN;
    const c = i < str.length ? str.charCodeAt(i++) : NaN;
    const triplet = (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c);
    result += chars[(triplet >> 18) & 63];
    result += chars[(triplet >> 12) & 63];
    result += Number.isNaN(b) ? '=' : chars[(triplet >> 6) & 63];
    result += Number.isNaN(c) ? '=' : chars[triplet & 63];
  }
  return result;
}

const authUser = process.env.EXPO_PUBLIC_BASIC_AUTH_USER;
const authPass = process.env.EXPO_PUBLIC_BASIC_AUTH_PASS;

export const API_PORT = Number(process.env.EXPO_PUBLIC_API_PORT) || 4173;
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || `http://${detectHost()}:${API_PORT}`;
export const EMBED_BASE = 'https://vidsrcme.ru';

// Sent on every backend request when the server has BASIC_AUTH_USER/PASS set
// (a public deployment — see ../../render/). Unlike a browser, React Native's
// fetch won't prompt for credentials on a 401, so they have to be attached
// explicitly. Empty object when unset, so private/LAN setups are unaffected.
export const AUTH_HEADERS = authUser
  ? { Authorization: `Basic ${base64Encode(`${authUser}:${authPass || ''}`)}` }
  : {};
