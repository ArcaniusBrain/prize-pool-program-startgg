/** Tipos compartidos de la integración con Start.gg. */

/** Tokens devueltos por los endpoints OAuth de start.gg (ya normalizados). */
export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Momento (epoch en ms) en que expira el access token. */
  expiresAt: number;
}

/** Datos básicos del usuario autenticado (query currentUser, scope user.identity). */
export interface StartggUser {
  /** ID numérico del usuario en Start.gg (se usa como ownerId para listar sus torneos). */
  id: number;
  slug: string | null;
  gamerTag: string | null;
  name: string | null;
}

/** Contenido de la cookie de sesión. */
export interface StartggSession extends OAuthTokens {
  user: StartggUser | null;
}
