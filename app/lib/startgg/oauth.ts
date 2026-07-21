/**
 * Flujo OAuth 2.0 (authorization code + refresh token) contra start.gg.
 *
 * Referencia: https://developer.start.gg/docs/oauth/oauth-overview
 * - Authorize:  GET  https://start.gg/oauth/authorize
 * - Token:      POST https://api.start.gg/oauth/access_token (JSON)
 * - Refresh:    POST https://api.start.gg/oauth/refresh (JSON)
 *
 * El client_secret SOLO se usa aquí, del lado del servidor.
 */

import {
  STARTGG_AUTHORIZE_URL,
  STARTGG_TOKEN_URL,
  STARTGG_REFRESH_URL,
  getStartggEnv,
} from './config';
import type { OAuthTokens } from './types';

/** Forma cruda de la respuesta de token de start.gg. */
interface RawTokenResponse {
  access_token?: string;
  token_type?: string;
  /** Segundos de vida del access token (start.gg: 604800 = 7 días). */
  expires_in?: number;
  refresh_token?: string;
}

/**
 * Construye la URL de autorización a la que se redirige al usuario (paso 1).
 * Incluye `state` para validar en el callback que la respuesta corresponde
 * a una solicitud iniciada por nosotros (protección CSRF).
 */
export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri, scopes } = getStartggEnv();
  const url = new URL(STARTGG_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', scopes); // URLSearchParams codifica los espacios
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

async function requestTokens(
  url: string,
  body: Record<string, string>
): Promise<OAuthTokens> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Start.gg OAuth respondió ${res.status}: ${text.slice(0, 300)}`);
  }

  let data: RawTokenResponse;
  try {
    data = JSON.parse(text) as RawTokenResponse;
  } catch {
    throw new Error(`Respuesta OAuth no es JSON válido: ${text.slice(0, 300)}`);
  }

  if (!data.access_token || typeof data.expires_in !== 'number') {
    throw new Error(`Respuesta OAuth sin access_token/expires_in: ${text.slice(0, 300)}`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/** Paso 5 del flujo: intercambia el `code` del callback por tokens. */
export async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const { clientId, clientSecret, redirectUri, scopes } = getStartggEnv();
  return requestTokens(STARTGG_TOKEN_URL, {
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    scope: scopes,
  });
}

/** Renueva el access token (expira a los 7 días) usando el refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const { clientId, clientSecret, redirectUri, scopes } = getStartggEnv();
  return requestTokens(STARTGG_REFRESH_URL, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    scope: scopes,
  });
}
