// Module-level cache for the short-lived media token used to authenticate <audio>/<img> requests to
// GET /api/tracks/{id}/audio and /cover (they can't set an Authorization header). Written by
// AuthProvider's refresh cycle, read synchronously by the URL builders in lib/data.ts.
let currentToken: string | null = null;

export function setMediaToken(token: string | null) {
  currentToken = token;
}

export function getMediaToken(): string | null {
  return currentToken;
}

export function appendMediaToken(url: string): string {
  if (!currentToken) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(currentToken)}`;
}
