/**
 * Configuración central de la integración con Start.gg.
 *
 * ⚠️ SOLO importar desde código de servidor (API Routes / Server Components).
 * Nunca desde componentes 'use client': expondría el client_secret.
 *
 * URLs según la documentación oficial:
 * https://developer.start.gg/docs/oauth/oauth-overview
 */

export const STARTGG_AUTHORIZE_URL = 'https://start.gg/oauth/authorize';
export const STARTGG_TOKEN_URL = 'https://api.start.gg/oauth/access_token';
export const STARTGG_REFRESH_URL = 'https://api.start.gg/oauth/refresh';
export const STARTGG_GQL_URL = 'https://api.start.gg/gql/alpha';

/** Cookie httpOnly donde se guarda la sesión (tokens + datos del usuario). */
export const SESSION_COOKIE = 'startgg_session';
/** Cookie temporal para el parámetro `state` (protección CSRF del flujo OAuth). */
export const STATE_COOKIE = 'startgg_oauth_state';

export interface StartggEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Scopes separados por espacio, ej. "user.identity user.email" */
  scopes: string;
}

/**
 * Lee y valida las variables de entorno de la app OAuth.
 * Lanza un error claro si falta alguna (mejor fallar temprano que un 500 críptico).
 */
export function getStartggEnv(): StartggEnv {
  const clientId = process.env.STARTGG_CLIENT_ID;
  const clientSecret = process.env.STARTGG_CLIENT_SECRET;
  const redirectUri = process.env.STARTGG_REDIRECT_URI;
  const scopes = process.env.STARTGG_SCOPES ?? 'user.identity user.email';

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Faltan variables de entorno de Start.gg: define STARTGG_CLIENT_ID, ' +
        'STARTGG_CLIENT_SECRET y STARTGG_REDIRECT_URI en .env.local ' +
        '(ver .env.local.example).'
    );
  }

  return { clientId, clientSecret, redirectUri, scopes };
}

/**
 * Token personal OPCIONAL para desarrollo (Developer Settings → Personal Access Tokens).
 * Permite probar las queries de eventos/entrants/standings sin montar OAuth.
 * Las rutas que dependen de "mis torneos" (currentUser) sí requieren OAuth.
 */
export function getDevApiToken(): string | null {
  return process.env.STARTGG_API_TOKEN ?? null;
}

/** Ruta interna adonde redirigir al usuario después del login/error de OAuth. */
export function getPostLoginPath(): string {
  return process.env.STARTGG_POST_LOGIN_PATH ?? '/startgg-test';
}
