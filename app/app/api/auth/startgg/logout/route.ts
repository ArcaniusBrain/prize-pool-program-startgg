/**
 * POST /api/auth/startgg/logout
 *
 * Borra la cookie de sesión. (No existe endpoint público de revocación de
 * tokens en la doc de start.gg; el access token expirará solo a los 7 días.)
 */

import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/startgg/session';

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
