/**
 * GET /api/startgg/tournaments?role=organizer|player&page=1&perPage=10
 *
 * - role=organizer (default): torneos CREADOS por el usuario autenticado
 *   (query raíz `tournaments` con filter.ownerId = id del usuario).
 *   Es la vista del TO para elegir qué bracket habilitar como prize pool.
 * - role=player: torneos donde el usuario PARTICIPA (currentUser.tournaments).
 *
 * Requiere sesión OAuth (es información ligada a currentUser); el token
 * personal de desarrollo NO aplica aquí.
 */

import { NextRequest, NextResponse } from 'next/server';
import { startggGql } from '@/lib/startgg/client';
import {
  MY_TOURNAMENTS,
  TOURNAMENTS_BY_OWNER,
  type MyTournamentsData,
  type TournamentsByOwnerData,
} from '@/lib/startgg/queries';
import { getValidSession } from '@/lib/startgg/session';
import {
  clampInt,
  errorResponse,
  normalizeTournament,
  unauthorizedResponse,
} from '@/lib/startgg/helpers';

export async function GET(request: NextRequest) {
  const session = await getValidSession();
  if (!session) {
    return unauthorizedResponse(
      'Listar tus torneos requiere iniciar sesión con tu cuenta de Start.gg (OAuth).'
    );
  }

  const params = request.nextUrl.searchParams;
  const role = params.get('role') === 'player' ? 'player' : 'organizer';
  const page = clampInt(params.get('page'), 1, 1, 500);
  const perPage = clampInt(params.get('perPage'), 10, 1, 50);

  try {
    if (role === 'organizer') {
      const ownerId = session.user?.id;
      if (ownerId === undefined || ownerId === null) {
        return NextResponse.json(
          {
            error:
              'La sesión no tiene el id de usuario de Start.gg. Cierra sesión y vuelve a iniciar (verifica el scope user.identity).',
          },
          { status: 400 }
        );
      }

      const data = await startggGql<TournamentsByOwnerData>(
        session.accessToken,
        TOURNAMENTS_BY_OWNER,
        { ownerId, page, perPage }
      );

      const connection = data.tournaments;
      return NextResponse.json({
        role,
        page,
        perPage,
        total: connection?.pageInfo?.total ?? null,
        totalPages: connection?.pageInfo?.totalPages ?? null,
        tournaments: (connection?.nodes ?? []).map(normalizeTournament),
      });
    }

    const data = await startggGql<MyTournamentsData>(session.accessToken, MY_TOURNAMENTS, {
      page,
      perPage,
    });

    const connection = data.currentUser?.tournaments ?? null;
    return NextResponse.json({
      role,
      page,
      perPage,
      total: connection?.pageInfo?.total ?? null,
      totalPages: connection?.pageInfo?.totalPages ?? null,
      tournaments: (connection?.nodes ?? []).map(normalizeTournament),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
