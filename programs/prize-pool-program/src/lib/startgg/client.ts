/**
 * Cliente GraphQL mínimo para la API de Start.gg.
 * Endpoint único: https://api.start.gg/gql/alpha (POST recomendado por la doc oficial).
 *
 * Solo servidor: el token de acceso nunca debe llegar al navegador.
 */

import { STARTGG_GQL_URL } from './config';

export class StartggApiError extends Error {
  /** Código HTTP devuelto por start.gg, si aplica (los errores GraphQL vienen con 200). */
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'StartggApiError';
    this.status = status;
  }
}

interface GqlEnvelope<T> {
  data?: T | null;
  errors?: Array<{ message?: string }>;
}

/**
 * Ejecuta una query GraphQL contra Start.gg.
 *
 * @param token     Access token (OAuth) o token personal de desarrollo.
 * @param query     Documento GraphQL (ver queries.ts).
 * @param variables Variables de la query.
 */
export async function startggGql<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(STARTGG_GQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new StartggApiError(
      `Start.gg respondió ${res.status}: ${text.slice(0, 300)}`,
      res.status
    );
  }

  const json = (await res.json()) as GqlEnvelope<T>;

  if (json.errors && json.errors.length > 0) {
    const messages = json.errors
      .map((e) => e.message ?? 'error sin mensaje')
      .join(' | ');
    throw new StartggApiError(`GraphQL: ${messages}`);
  }

  if (json.data === undefined || json.data === null) {
    throw new StartggApiError('Respuesta GraphQL sin campo data.');
  }

  return json.data;
}
