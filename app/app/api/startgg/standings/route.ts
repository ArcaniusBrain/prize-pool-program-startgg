/**
 * GET /api/startgg/standings?eventId=123456&page=1&perPage=8
 *
 * Posiciones finales de un evento, ordenadas por placement ascendente.
 * Este es el insumo directo de distribute_prizes:
 *
 *   winner_entrant_ids = entrantIdsByPlacement.slice(0, prize_percentages.length)
 *
 * Incluye event.state: si no es "COMPLETED", las posiciones aún pueden cambiar
 * y el frontend debería advertirlo antes de permitir el reparto.
 *
 * ⚠️ Empates: a partir del 5.º lugar los brackets de doble eliminación reparten
 * posiciones empatadas (5.º/5.º, 7.º/7.º...). El contrato exige una lista
 * ordenada estricta, así que si prize_percentages cubre posiciones empatadas,
 * el TO tendrá que desempatar manualmente en la UI.
 *
 * Funciona con sesión OAuth o con STARTGG_API_TOKEN (datos públicos).
 */

import { NextRequest, NextResponse } from 'next/server';
import { startggGql } from '@/lib/startgg/client';
import { EVENT_STANDINGS, type EventStandingsData } from '@/lib/startgg/queries';
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
  // El contrato admite máximo 10 posiciones premiadas; 8 por defecto es cómodo.
  const perPage = clampInt(params.get('perPage'), 8, 1, 100);

  const token = await resolveAccessToken();
  if (!token) {
    return unauthorizedResponse('Consultar standings requiere un token de Start.gg.');
  }

  try {
    const data = await startggGql<EventStandingsData>(token, EVENT_STANDINGS, {
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

    const connection = data.event.standings;
    const standings = (connection?.nodes ?? [])
      .map((s) => ({
        placement: s.placement ?? null,
        entrantId: toNum(s.entrant?.id),
        entrantName: s.entrant?.name ?? null,
      }))
      .sort((a, b) => (a.placement ?? Infinity) - (b.placement ?? Infinity));

    return NextResponse.json({
      event: {
        id: toNum(data.event.id),
        name: data.event.name ?? null,
        /** "COMPLETED" cuando el bracket terminó; antes, los standings no son finales. */
        state: data.event.state ?? null,
      },
      page,
      perPage,
      total: connection?.pageInfo?.total ?? null,
      totalPages: connection?.pageInfo?.totalPages ?? null,
      standings,
      /** Lista ordenada 1.º, 2.º, 3.º... lista para recortar y pasar a distribute_prizes. */
      entrantIdsByPlacement: standings
        .map((s) => s.entrantId)
        .filter((id): id is number => id !== null),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
