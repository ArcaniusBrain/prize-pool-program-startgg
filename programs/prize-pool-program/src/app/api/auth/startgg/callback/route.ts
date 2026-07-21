/**
 * GET /api/auth/startgg/callback
 *
 * Pasos 4-5 del flujo OAuth: start.gg redirige aquí con ?code=...&state=...
 * 1. Validamos que `state` coincida con la cookie (anti-CSRF).
 * 2. Intercambiamos el `code` por tokens (server-side, con client_secret).
 * 3. Consultamos currentUser para guardar id/gamerTag en la sesión
 *    (el id se usa luego como ownerId para listar los torneos que organiza).
 * 4. Escribimos la cookie de sesión y redirigimos a la app.
 *
 * Esta URL debe coincidir EXACTAMENTE con la Redirect URL registrada en la
 * aplicación OAuth de start.gg y con STARTGG_REDIRECT_URI en .env.local.
 */

import { NextRequest, NextResponse } from 'next/server';
import { STATE_COOKIE, getPostLoginPath } from '@/lib/startgg/config';
import { exchangeCodeForTokens } from '@/lib/startgg/oauth';
import { startggGql } from '@/lib/startgg/client';
import { CURRENT_USER, type CurrentUserData } from '@/lib/startgg/queries';
import { buildSessionCookie } from '@/lib/startgg/session';
import { toNum } from '@/lib/startgg/helpers';
import type { StartggSession, StartggUser } from '@/lib/startgg/types';

export async function GET(request: NextRequest) {
  const postLoginPath = getPostLoginPath();

  const redirectTo = (params: Record<string, string>) => {
    const url = new URL(postLoginPath, request.url);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    const res = NextResponse.redirect(url);
    res.cookies.delete(STATE_COOKIE); // el state es de un solo uso
    return res;
  };

  const fail = (reason: string) => redirectTo({ login: 'error', reason });

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  if (!code) {
    return fail('start.gg no envió el código de autorización (¿cancelaste el login?)');
  }
  if (!state || !expectedState || state !== expectedState) {
    return fail('state inválido: reinicia el login desde /api/auth/startgg/login');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Enriquecer la sesión con la identidad del usuario. Si esta query falla
    // (p. ej. scope insuficiente), la sesión sigue siendo válida para queries
    // públicas; solo quedará user = null.
    let user: StartggUser | null = null;
    try {
      const data = await startggGql<CurrentUserData>(tokens.accessToken, CURRENT_USER);
      const u = data.currentUser;
      const id = toNum(u?.id);
      if (u && id !== null) {
        user = {
          id,
          slug: u.slug ?? null,
          gamerTag: u.player?.gamerTag ?? null,
          name: u.name ?? null,
        };
      }
    } catch {
      // no bloquea el login
    }

    const session: StartggSession = { ...tokens, user };
    const res = redirectTo({ login: 'ok' });
    res.cookies.set(buildSessionCookie(session));
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error intercambiando el código';
    return fail(message.slice(0, 200));
  }
}
