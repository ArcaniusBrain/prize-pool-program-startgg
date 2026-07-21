/**
 * GET /api/startgg/events?slug=<slug o URL del torneo>
 *
 * Devuelve los eventos (brackets) de un torneo. Acepta cualquiera de:
 *   - https://www.start.gg/tournament/mi-torneo/event/singles
 *   - tournament/mi-torneo
 *   - mi-torneo
 *
 * El `id` de cada evento es el valor que initialize_tournament recibe
 * como startgg_bracket_id.
 *
 * Funciona con sesión OAuth o con STARTGG_API_TOKEN (datos públicos).
 */

import { NextRequest, NextResponse } from 'next/server';
import { startggGql } from '@/lib/startgg/client';
import { TOURNAMENT_EVENTS, type TournamentEventsData } from '@/lib/startgg/queries';
import { resolveAccessToken } from '@/lib/startgg/session';
import {
  errorResponse,
  normalizeEvent,
  normalizeTournamentSlug,
  toNum,
  unauthorizedResponse,
} from '@/lib/startgg/helpers';

export async function GET(request: NextRequest) {
  const rawSlug = request.nextUrl.searchParams.get('slug');
  if (!rawSlug || rawSlug.trim() === '') {
    return NextResponse.json(
      { error: 'Falta el parámetro slug. Ejemplo: /api/startgg/events?slug=mi-torneo' },
      { status: 400 }
    );
  }

  const token = await resolveAccessToken();
  if (!token) {
    return unauthorizedResponse('Consultar eventos requiere un token de Start.gg.');
  }

  const slug = normalizeTournamentSlug(rawSlug);

  try {
    const data = await startggGql<TournamentEventsData>(token, TOURNAMENT_EVENTS, { slug });

    if (!data.tournament) {
      return NextResponse.json(
        { error: `No se encontró un torneo con slug "${slug}".` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      tournament: {
        id: toNum(data.tournament.id),
        name: data.tournament.name ?? null,
        slug: data.tournament.slug ?? null,
      },
      events: (data.tournament.events ?? []).map(normalizeEvent),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
