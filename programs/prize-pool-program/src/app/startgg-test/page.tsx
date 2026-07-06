'use client';

/**
 * Página de PRUEBA de la integración con Start.gg — solo para desarrollo.
 *
 * Ejercita el login OAuth y todos los endpoints desde el navegador, sin curl.
 * Las pantallas reales del equipo de UI deben consumir estos mismos endpoints;
 * esta página se puede borrar antes de la entrega (o dejar como demo técnica).
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react';

type Json = unknown;

interface StatusResponse {
  authenticated: boolean;
  user: { id: number; slug: string | null; gamerTag: string | null; name: string | null } | null;
  devTokenActive: boolean;
}

const box: CSSProperties = {
  border: '1px solid #d0d0d0',
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
};
const h2: CSSProperties = { margin: '0 0 8px', fontSize: 18 };
const btn: CSSProperties = {
  padding: '6px 12px',
  marginRight: 8,
  marginBottom: 8,
  borderRadius: 6,
  border: '1px solid #888',
  background: '#f5f5f5',
  cursor: 'pointer',
};
const input: CSSProperties = {
  padding: 6,
  marginRight: 8,
  marginBottom: 8,
  borderRadius: 6,
  border: '1px solid #aaa',
  minWidth: 280,
};
const pre: CSSProperties = {
  background: '#111',
  color: '#9fef9f',
  padding: 12,
  borderRadius: 6,
  fontSize: 12,
  maxHeight: 320,
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
};

function Output({ data }: { data: Json }) {
  if (data === undefined || data === null) return null;
  return <pre style={pre}>{JSON.stringify(data, null, 2)}</pre>;
}

export default function StartggTestPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [out, setOut] = useState<Record<string, Json>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const [role, setRole] = useState<'organizer' | 'player'>('organizer');
  const [slug, setSlug] = useState('');
  const [eventId, setEventId] = useState('');

  const call = useCallback(async (key: string, path: string) => {
    setBusy(key);
    try {
      const res = await fetch(path);
      const data: Json = await res.json();
      setOut((prev) => ({ ...prev, [key]: { httpStatus: res.status, respuesta: data } }));
    } catch (e) {
      setOut((prev) => ({ ...prev, [key]: { error: String(e) } }));
    } finally {
      setBusy(null);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/startgg/status');
      setStatus((await res.json()) as StatusResponse);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const logout = async () => {
    await fetch('/api/auth/startgg/logout', { method: 'POST' });
    setOut({});
    await loadStatus();
  };

  return (
    <main style={{ maxWidth: 860, margin: '24px auto', padding: 16, fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: 24 }}>Prueba de integración Start.gg</h1>
      <p style={{ color: '#666' }}>
        Página de desarrollo. Si la URL trae <code>?login=error&amp;reason=...</code>, ahí está
        el motivo del fallo de OAuth.
      </p>

      <section style={box}>
        <h2 style={h2}>1 · Sesión</h2>
        {status === null ? (
          <p>Cargando estado…</p>
        ) : status.authenticated ? (
          <p>
            ✅ Conectado como <strong>{status.user?.gamerTag ?? status.user?.name ?? 'usuario'}</strong>{' '}
            (id {status.user?.id ?? '?'})
          </p>
        ) : status.devTokenActive ? (
          <p>
            🟡 Sin sesión OAuth, pero <code>STARTGG_API_TOKEN</code> está activo: eventos,
            entrants y standings funcionarán; “mis torneos” no.
          </p>
        ) : (
          <p>🔴 Sin sesión y sin token de desarrollo.</p>
        )}
        <a href="/api/auth/startgg/login" style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>
          Conectar con Start.gg
        </a>
        <button style={btn} onClick={() => void logout()}>
          Cerrar sesión
        </button>
        <button style={btn} onClick={() => void loadStatus()}>
          Refrescar estado
        </button>
      </section>

      <section style={box}>
        <h2 style={h2}>2 · Mis torneos (requiere OAuth)</h2>
        <label>
          Rol:{' '}
          <select value={role} onChange={(e) => setRole(e.target.value as 'organizer' | 'player')}>
            <option value="organizer">organizador (mis torneos creados)</option>
            <option value="player">jugador (torneos donde participo)</option>
          </select>
        </label>{' '}
        <button
          style={btn}
          disabled={busy === 'tournaments'}
          onClick={() => void call('tournaments', `/api/startgg/tournaments?role=${role}&perPage=10`)}
        >
          {busy === 'tournaments' ? 'Consultando…' : 'Listar torneos'}
        </button>
        <Output data={out.tournaments} />
      </section>

      <section style={box}>
        <h2 style={h2}>3 · Eventos de un torneo (por slug o URL)</h2>
        <input
          style={input}
          placeholder="ej: https://www.start.gg/tournament/mi-torneo"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <button
          style={btn}
          disabled={busy === 'events' || slug.trim() === ''}
          onClick={() => void call('events', `/api/startgg/events?slug=${encodeURIComponent(slug)}`)}
        >
          {busy === 'events' ? 'Consultando…' : 'Buscar eventos'}
        </button>
        <p style={{ color: '#666', fontSize: 13 }}>
          El <code>id</code> de cada evento es el <code>startgg_bracket_id</code> del contrato.
        </p>
        <Output data={out.events} />
      </section>

      <section style={box}>
        <h2 style={h2}>4 · Entrants y standings de un evento</h2>
        <input
          style={{ ...input, minWidth: 160 }}
          placeholder="eventId numérico"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        />
        <button
          style={btn}
          disabled={busy === 'entrants' || eventId.trim() === ''}
          onClick={() => void call('entrants', `/api/startgg/entrants?eventId=${encodeURIComponent(eventId)}`)}
        >
          {busy === 'entrants' ? 'Consultando…' : 'Entrants'}
        </button>
        <button
          style={btn}
          disabled={busy === 'standings' || eventId.trim() === ''}
          onClick={() => void call('standings', `/api/startgg/standings?eventId=${encodeURIComponent(eventId)}`)}
        >
          {busy === 'standings' ? 'Consultando…' : 'Standings'}
        </button>
        <p style={{ color: '#666', fontSize: 13 }}>
          <code>entrants[].id</code> → <code>startgg_entrant_id</code> (register_player) ·{' '}
          <code>entrantIdsByPlacement</code> → <code>winner_entrant_ids</code> (distribute_prizes).
        </p>
        <Output data={out.entrants} />
        <Output data={out.standings} />
      </section>
    </main>
  );
}
