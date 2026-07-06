/**
 * Sesión de Start.gg guardada en una cookie httpOnly.
 *
 * Decisiones de diseño (proyecto de curso, sin base de datos de sesiones):
 * - httpOnly  → el JavaScript del navegador NO puede leer los tokens (mitiga XSS).
 * - sameSite  → 'lax': la cookie viaja en la redirección del callback OAuth,
 *               pero no en peticiones cross-site arbitrarias.
 * - secure    → solo en producción (en localhost no hay HTTPS).
 *
 * ⚠️ Estas funciones usan cookies() de next/headers: llamarlas únicamente desde
 * Route Handlers (app/api/...). saveSession/clearSession escriben cookies, algo
 * que Next solo permite en Route Handlers y Server Actions.
 */

import { cookies } from 'next/headers';
import { SESSION_COOKIE, getDevApiToken } from './config';
import { refreshAccessToken } from './oauth';
import type { StartggSession } from './types';

// --- (de)serialización -------------------------------------------------------

function encodeSession(session: StartggSession): string {
  return Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
}

function decodeSession(raw: string): StartggSession | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8')
    ) as StartggSession;
    if (typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Opciones estándar de la cookie de sesión (exportadas para usarlas en el callback). */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // La cookie vive 30 días; el access token interno se renueva solo (refresh).
    maxAge: 60 * 60 * 24 * 30,
  };
}

/** Serializa la sesión al formato { name, value } listo para response.cookies.set(). */
export function buildSessionCookie(session: StartggSession) {
  return {
    name: SESSION_COOKIE,
    value: encodeSession(session),
    ...sessionCookieOptions(),
  };
}

// --- API de sesión ------------------------------------------------------------

export async function saveSession(session: StartggSession): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(session), sessionCookieOptions());
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Lee la sesión tal cual está en la cookie (sin renovar tokens). */
export async function readSession(): Promise<StartggSession | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  return raw ? decodeSession(raw) : null;
}

/**
 * Devuelve una sesión con access token VIGENTE.
 * Si el token expira en menos de 60s y hay refresh token, lo renueva contra
 * start.gg y actualiza la cookie. Si la renovación falla, limpia la sesión
 * (el usuario tendrá que volver a iniciar sesión).
 */
export async function getValidSession(): Promise<StartggSession | null> {
  const session = await readSession();
  if (!session) return null;

  const safetyMarginMs = 60_000;
  if (Date.now() + safetyMarginMs < session.expiresAt) {
    return session;
  }

  if (!session.refreshToken) {
    await clearSession();
    return null;
  }

  try {
    const tokens = await refreshAccessToken(session.refreshToken);
    const renewed: StartggSession = { ...session, ...tokens };
    await saveSession(renewed);
    return renewed;
  } catch {
    await clearSession();
    return null;
  }
}

/**
 * Resuelve el token a usar en llamadas GraphQL:
 * 1. la sesión OAuth del usuario (renovada si hacía falta), o
 * 2. el token personal de desarrollo (STARTGG_API_TOKEN), si está definido.
 *
 * Devuelve null si no hay ninguno (la ruta debe responder 401).
 */
export async function resolveAccessToken(): Promise<string | null> {
  const session = await getValidSession();
  if (session) return session.accessToken;
  return getDevApiToken();
}
