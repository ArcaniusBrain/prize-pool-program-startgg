/**
 * Queries GraphQL contra Start.gg y tipos de sus respuestas.
 *
 * Basadas en los ejemplos oficiales del developer portal:
 * - Event Entrants / Event Standings / Events in Tournament / Tournaments by Owner
 *
 * Nota sobre IDs: el scalar ID de GraphQL puede llegar como número o string;
 * por eso los tipos crudos usan `number | string` y las rutas normalizan con toNum().
 * En el contrato on-chain estos IDs viajan como u32.
 */

// ---------------------------------------------------------------------------
// Documentos GraphQL
// ---------------------------------------------------------------------------

/** Identidad del usuario autenticado (requiere scope user.identity). */
export const CURRENT_USER = /* GraphQL */ `
  query CurrentUser {
    currentUser {
      id
      slug
      name
      player {
        gamerTag
      }
    }
  }
`;

/** Torneos ORGANIZADOS por un usuario (filtro ownerId del query raíz tournaments). */
export const TOURNAMENTS_BY_OWNER = /* GraphQL */ `
  query TournamentsByOwner($ownerId: ID!, $page: Int!, $perPage: Int!) {
    tournaments(query: { page: $page, perPage: $perPage, filter: { ownerId: $ownerId } }) {
      pageInfo {
        total
        totalPages
      }
      nodes {
        id
        name
        slug
        startAt
        numAttendees
        events {
          id
          name
          numEntrants
          state
        }
      }
    }
  }
`;

/** Torneos donde PARTICIPA el usuario autenticado (vista jugador). */
export const MY_TOURNAMENTS = /* GraphQL */ `
  query MyTournaments($page: Int!, $perPage: Int!) {
    currentUser {
      tournaments(query: { page: $page, perPage: $perPage }) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          name
          slug
          startAt
          numAttendees
          events {
            id
            name
            numEntrants
            state
          }
        }
      }
    }
  }
`;

/** Eventos (brackets) de un torneo, buscado por slug ("tournament/mi-torneo"). */
export const TOURNAMENT_EVENTS = /* GraphQL */ `
  query TournamentEvents($slug: String!) {
    tournament(slug: $slug) {
      id
      name
      slug
      events {
        id
        name
        slug
        numEntrants
        state
        startAt
        videogame {
          name
        }
      }
    }
  }
`;

/** Inscritos (entrants) de un evento. El entrant.id es el startgg_entrant_id del contrato. */
export const EVENT_ENTRANTS = /* GraphQL */ `
  query EventEntrants($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      id
      name
      entrants(query: { page: $page, perPage: $perPage }) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          id
          name
          participants {
            gamerTag
          }
        }
      }
    }
  }
`;

/** Posiciones finales de un evento, ordenables por placement (insumo de distribute_prizes). */
export const EVENT_STANDINGS = /* GraphQL */ `
  query EventStandings($eventId: ID!, $page: Int!, $perPage: Int!) {
    event(id: $eventId) {
      id
      name
      state
      standings(query: { page: $page, perPage: $perPage }) {
        pageInfo {
          total
          totalPages
        }
        nodes {
          placement
          entrant {
            id
            name
          }
        }
      }
    }
  }
`;

// ---------------------------------------------------------------------------
// Tipos de las respuestas (forma cruda que devuelve Start.gg)
// ---------------------------------------------------------------------------

export type GqlId = number | string;

export interface GqlPageInfo {
  total: number | null;
  totalPages: number | null;
}

export interface GqlCurrentUser {
  id: GqlId;
  slug: string | null;
  name: string | null;
  player: { gamerTag: string | null } | null;
}

export interface CurrentUserData {
  currentUser: GqlCurrentUser | null;
}

export interface GqlEventSummary {
  id: GqlId;
  name: string | null;
  slug?: string | null;
  numEntrants: number | null;
  state: string | null;
  startAt?: number | null;
  videogame?: { name: string | null } | null;
}

export interface GqlTournament {
  id: GqlId;
  name: string | null;
  slug: string | null;
  startAt: number | null;
  numAttendees: number | null;
  events: GqlEventSummary[] | null;
}

export interface GqlTournamentConnection {
  pageInfo: GqlPageInfo | null;
  nodes: GqlTournament[] | null;
}

export interface TournamentsByOwnerData {
  tournaments: GqlTournamentConnection | null;
}

export interface MyTournamentsData {
  currentUser: { tournaments: GqlTournamentConnection | null } | null;
}

export interface TournamentEventsData {
  tournament:
    | {
        id: GqlId;
        name: string | null;
        slug: string | null;
        events: GqlEventSummary[] | null;
      }
    | null;
}

export interface GqlEntrant {
  id: GqlId;
  name: string | null;
  participants: Array<{ gamerTag: string | null }> | null;
}

export interface EventEntrantsData {
  event:
    | {
        id: GqlId;
        name: string | null;
        entrants: { pageInfo: GqlPageInfo | null; nodes: GqlEntrant[] | null } | null;
      }
    | null;
}

export interface GqlStanding {
  placement: number | null;
  entrant: { id: GqlId; name: string | null } | null;
}

export interface EventStandingsData {
  event:
    | {
        id: GqlId;
        name: string | null;
        state: string | null;
        standings: { pageInfo: GqlPageInfo | null; nodes: GqlStanding[] | null } | null;
      }
    | null;
}
