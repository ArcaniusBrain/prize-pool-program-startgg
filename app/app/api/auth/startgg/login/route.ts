/**
 * GET /api/auth/startgg/login
 *
 * Paso 1 del flujo OAuth: genera un `state` aleatorio (anti-CSRF), lo guarda en
 * una cookie httpOnly de corta vida y redirige al usuario a start.gg para que
 * autorice la aplicación. start.gg lo devolverá a STARTGG_REDIRECT_URI.
 */

import { NextResponse } from 'next/server';
import { STATE_COOKIE } from '@/lib/startgg/config';
import { buildAuthorizeUrl } from '@/lib/startgg/oauth';

export async function GET() {
  const state = crypto.randomUUID();

  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(state);
  } catch (e) {
    // Típicamente: faltan variables en .env.local
    const message = e instanceof Error ? e.message : 'Configuración inválida';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600, // 10 minutos: suficiente para completar el login
  });
  return res;
}
