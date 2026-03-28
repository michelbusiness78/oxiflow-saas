// Rate limiter en mémoire — sliding window 1 heure
// Note : se remet à zéro au redémarrage du serveur.
// Pour un rate limiting persistant multi-instance, utiliser Redis (Upstash).

const WINDOW_MS  = 60 * 60 * 1000; // 1 heure
const MAX_REQUESTS = 50;

// userId → tableau de timestamps (ms) des requêtes dans la fenêtre
const store = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // timestamp ms
}

export function checkRateLimit(userId: string): RateLimitResult {
  const now      = Date.now();
  const windowStart = now - WINDOW_MS;

  // Récupère et nettoie les timestamps hors fenêtre
  const timestamps = (store.get(userId) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS) {
    // La fenêtre se libère à partir du plus ancien timestamp + 1h
    const resetAt = timestamps[0] + WINDOW_MS;
    return { allowed: false, remaining: 0, resetAt };
  }

  timestamps.push(now);
  store.set(userId, timestamps);

  return {
    allowed:   true,
    remaining: MAX_REQUESTS - timestamps.length,
    resetAt:   now + WINDOW_MS,
  };
}
