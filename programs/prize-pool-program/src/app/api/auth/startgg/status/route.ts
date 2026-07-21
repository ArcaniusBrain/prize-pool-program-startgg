/**
 * GET /api/auth/startgg/status
 *
 * Estado de autenticación para el frontend:
 *   { authenticated, user, devTokenActive }
 *
 * - authenticated: hay sesión OAuth vigente (renueva el token si hacía falta).
 * - user: { id, slug, gamerTag, name } o null.
 * - devTokenActive: no hay sesión pero sí STARTGG_API_TOKEN (modo desarrollo);
 *   las rutas de datos públicos funcionarán, /api/startgg/tournaments no.
 */

import { NextResponse } from 'next/server';
import { getDevApiToken } from '@/lib/startgg/config';
import { getValidSession } from '@/lib/startgg/session';

export async function GET() {
  const session = await getValidSession();

  return NextResponse.json({
    authenticated: session !== null,
    user: session?.user ?? null,
    devTokenActive: session === null && getDevApiToken() !== null,
  });
}
