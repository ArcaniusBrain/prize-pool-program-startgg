/**
 * GET /api/startgg/entrants?eventId=123456&page=1&perPage=25
 *
 * Inscritos (entrants) de un evento/bracket de Start.gg.
 * El `id` de cada entrant es el startgg_entrant_id que register_player
 * recibe y que se usa en los seeds de la PDA PlayerRecord.
 *
 * Funciona con sesión OAuth o con STARTGG_API_TOKEN (datos públicos).
 */

import { NextRequest, NextResponse } from 'next/server';
import { startggGql } from '@/lib/startgg/client';
import { EVENT_ENTRANTS, type EventEntrantsData } from '@/lib/startgg/queries';
import { resolveAccessToken } from '@/lib/startgg/session';
import { clampInt, errorResponse, toNum, unauthorizedResponse } from '@/lib/startgg/helpers';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const eventId = toNum(params.get('eventId'));
  if (eventId === null || eventId <= 0) {
    return NextResponse.json(
      { error: 'Falta eventId (numérico). Obtenlo de /api/startgg/events?slug=...' },
      { status: 400 }
    );
  }

  const page = clampInt(params.get('page'), 1, 1, 1000);
  const perPage = clampInt(params.get('perPage'), 25, 1, 100);

  const token = await resolveAccessToken();
  if (!token) {
    return unauthorizedResponse('Consultar entrants requiere un token de Start.gg.');
  }

  try {
    const data = await startggGql<EventEntrantsData>(token, EVENT_ENTRANTS, {
      eventId,
      page,
      perPage,
    });

    if (!data.event) {
      return NextResponse.json(
        { error: `No se encontró un evento con id ${eventId}.` },
        { status: 404 }
      );
    }

    const connection = data.event.entrants;
    const entrants = (connection?.nodes ?? []).map((entrant) => ({
      /** startgg_entrant_id para register_player / PDA player_record. */
      id: toNum(entrant.id),
      name: entrant.name ?? null,
      gamerTags: (entrant.participants ?? [])
        .map((p) => p.gamerTag)
        .filter((tag): tag is string => tag !== null && tag !== undefined),
    }));

    return NextResponse.json({
      event: { id: toNum(data.event.id), name: data.event.name ?? null },
      page,
      perPage,
      total: connection?.pageInfo?.total ?? null,
      totalPages: connection?.pageInfo?.totalPages ?? null,
      entrants,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
