/**
 * Utilidades compartidas por las API Routes de la integración.
 */

import { NextResponse } from 'next/server';
import { StartggApiError } from './client';
import type { GqlEventSummary, GqlId, GqlTournament } from './queries';

/** Parsea un entero de query string con default y rango [min, max]. */
export function clampInt(
  raw: string | null,
  defaultValue: number,
  min: number,
  max: number
): number {
  const n = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.min(max, Math.max(min, n));
}

/** Convierte un ID de GraphQL (número o string) a number, o null si no es válido. */
export function toNum(id: GqlId | null | undefined): number | null {
  if (id === null || id === undefined) return null;
  const n = typeof id === 'number' ? id : Number.parseInt(id, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Acepta lo que sea que pegue el usuario y lo lleva al slug que espera la API:
 *   "https://www.start.gg/tournament/mi-torneo/event/singles" → "tournament/mi-torneo"
 *   "tournament/mi-torneo"                                    → "tournament/mi-torneo"
 *   "mi-torneo"                                               → "tournament/mi-torneo"
 */
export function normalizeTournamentSlug(input: string): string {
  const match = input.match(/tournament\/([^/?#\s]+)/i);
  const short = (match ? match[1] : input).trim().replace(/^\/+|\/+$/g, '');
  return `tournament/${short}`;
}

/** Respuesta JSON de error consistente para todas las rutas. */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof StartggApiError) {
    // 4xx de start.gg (p. ej. 401 token inválido) se propaga tal cual;
    // errores GraphQL o 5xx upstream se reportan como 502 (falla del upstream).
    const status =
      e.status !== undefined && e.status >= 400 && e.status < 500 ? e.status : 502;
    return NextResponse.json({ error: e.message }, { status });
  }
  const message = e instanceof Error ? e.message : 'Error inesperado';
  return NextResponse.json({ error: message }, { status: 500 });
}

/** 401 estándar cuando no hay ni sesión OAuth ni token de desarrollo. */
export function unauthorizedResponse(detail: string): NextResponse {
  return NextResponse.json(
    {
      error: 'No autenticado con Start.gg.',
      detail,
      hint: 'Inicia sesión visitando /api/auth/startgg/login, o define STARTGG_API_TOKEN en .env.local para desarrollo.',
    },
    { status: 401 }
  );
}

// --- Normalizadores (forma cruda de Start.gg → JSON limpio para el frontend) ---

export interface EventSummaryDto {
  /** ID del evento: es el valor a usar como startgg_bracket_id en initialize_tournament. */
  id: number | null;
  name: string | null;
  slug: string | null;
  numEntrants: number | null;
  state: string | null;
  startAt: number | null;
  videogame: string | null;
}

export interface TournamentDto {
  id: number | null;
  name: string | null;
  slug: string | null;
  startAt: number | null;
  numAttendees: number | null;
  events: EventSummaryDto[];
}

export function normalizeEvent(e: GqlEventSummary): EventSummaryDto {
  return {
    id: toNum(e.id),
    name: e.name ?? null,
    slug: e.slug ?? null,
    numEntrants: e.numEntrants ?? null,
    state: e.state ?? null,
    startAt: e.startAt ?? null,
    videogame: e.videogame?.name ?? null,
  };
}

export function normalizeTournament(t: GqlTournament): TournamentDto {
  return {
    id: toNum(t.id),
    name: t.name ?? null,
    slug: t.slug ?? null,
    startAt: t.startAt ?? null,
    numAttendees: t.numAttendees ?? null,
    events: (t.events ?? []).map(normalizeEvent),
  };
}
