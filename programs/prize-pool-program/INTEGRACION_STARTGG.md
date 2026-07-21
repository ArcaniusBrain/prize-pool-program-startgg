# Integración con Start.gg — OAuth2 + GraphQL

Frente de trabajo "Integración Start.gg" del proyecto de prize pools en Solana.
Cubre el login OAuth 2.0 (sin exponer el `client_secret`) y las tres consultas que
alimentan al contrato: torneos del usuario, entrants de una bracket y standings finales.

Fuente oficial: https://developer.start.gg/docs/oauth/oauth-overview

---

## 1 · Qué se instala y dónde

Copiar la carpeta `src/` de este paquete sobre la carpeta `src/` de la app Next.js.
No pisa ningún archivo existente: todas las rutas son nuevas.

```
src/
├── lib/startgg/
│   ├── config.ts      # URLs de start.gg, nombres de cookies, lectura de .env
│   ├── types.ts       # Tipos de sesión y tokens
│   ├── oauth.ts       # buildAuthorizeUrl, exchangeCodeForTokens, refreshAccessToken
│   ├── client.ts      # startggGql(): POST a https://api.start.gg/gql/alpha
│   ├── queries.ts     # Documentos GraphQL + tipos de respuesta
│   ├── session.ts     # Cookie httpOnly de sesión + renovación automática del token
│   └── helpers.ts     # Validación de params, normalizadores, errores JSON
└── app/
    ├── api/auth/startgg/
    │   ├── login/route.ts     # GET  → redirige a start.gg (genera state anti-CSRF)
    │   ├── callback/route.ts  # GET  → valida state, canjea code, guarda sesión
    │   ├── logout/route.ts    # POST → borra la sesión
    │   └── status/route.ts    # GET  → { authenticated, user, devTokenActive }
    ├── api/startgg/
    │   ├── tournaments/route.ts  # GET → mis torneos (organizador o jugador)
    │   ├── events/route.ts       # GET → eventos de un torneo por slug/URL
    │   ├── entrants/route.ts     # GET → inscritos de un evento
    │   └── standings/route.ts    # GET → posiciones finales de un evento
    └── startgg-test/page.tsx     # Página de prueba (solo desarrollo)
```

**Regla de seguridad:** nada de `src/lib/startgg/` se importa desde componentes
`'use client'`. El navegador solo habla con las API Routes; los tokens y el
`client_secret` viven exclusivamente en el servidor.

---

## 2 · Mapeo con el contrato Anchor

| Instrucción on-chain | Argumento | De dónde sale | Endpoint |
|---|---|---|---|
| `initialize_tournament` | `startgg_bracket_id: u32` | `id` del **evento** elegido | `/api/startgg/tournaments` (organizador) o `/api/startgg/events?slug=...` |
| `register_player` | `startgg_entrant_id: u32` | `entrants[].id` del jugador | `/api/startgg/entrants?eventId=...` |
| `distribute_prizes` | `winner_entrant_ids: Vec<u32>` | `entrantIdsByPlacement.slice(0, prize_percentages.length)` | `/api/startgg/standings?eventId=...` |
| `refund_player` | — (usa la PDA existente) | mismo `entrant_id` con el que se registró | — |

Notas:

- En Start.gg un **torneo** contiene **eventos** (p. ej. "Tekken 8 Singles"), y cada
  evento tiene su bracket, entrants y standings. Lo que el contrato llama
  `startgg_bracket_id` es el **id del evento**.
- Los IDs de Start.gg son numéricos y hoy caben con holgura en `u32`
  (eventos ~10⁶, entrants ~10⁷; el límite de u32 es ~4.29×10⁹).
- `distribute_prizes` exige la lista **ordenada y del mismo largo** que
  `prize_percentages`. El endpoint de standings ya la entrega ordenada en
  `entrantIdsByPlacement`; el frontend solo recorta a N posiciones.
- **Empates:** desde el 5.º puesto los brackets de doble eliminación empatan
  posiciones (5.º/5.º, 7.º/7.º…). Si el reparto cubre posiciones empatadas, la UI
  debe pedirle al TO que desempate manualmente antes de firmar.
- **Estado del evento:** `standings` incluye `event.state`. Solo repartir premios
  cuando sea `COMPLETED`; antes de eso las posiciones pueden cambiar.

---

## 3 · Cómo funciona el flujo OAuth (resumen)

1. El navegador visita `GET /api/auth/startgg/login`. El servidor genera un `state`
   aleatorio, lo guarda en una cookie httpOnly de 10 min y redirige a
   `https://start.gg/oauth/authorize?...&state=...`.
2. El usuario inicia sesión en start.gg y aprueba los scopes.
3. start.gg redirige a `STARTGG_REDIRECT_URI` (nuestro callback) con `?code=...&state=...`.
4. El callback verifica que `state` coincida con la cookie (anti-CSRF) y hace un
   POST **servidor→servidor** a `api.start.gg/oauth/access_token` con el
   `client_secret`. El secreto nunca pasa por el navegador.
5. Con el access token recién emitido consulta `currentUser` (id, gamerTag) y guarda
   todo en la cookie httpOnly `startgg_session`. Redirige a `STARTGG_POST_LOGIN_PATH`.

El access token dura **7 días** (`expires_in: 604800`). `session.ts` lo renueva
automáticamente con el refresh token (endpoint `api.start.gg/oauth/refresh`) cuando
falta menos de un minuto para expirar, de forma transparente para el frontend.

---

## 4 · Puesta en marcha

### 4.1 · Prueba rápida en 5 minutos (sin OAuth, con token personal)

Sirve para validar las queries GraphQL de inmediato:

1. En start.gg: avatar → **Developer Settings** → **Personal Access Tokens** → crear token.
2. En la raíz de la app, crear/editar `.env.local`:
   ```
   STARTGG_API_TOKEN=tu_token_personal
   ```
3. `npm run dev` y abrir `http://localhost:3000/startgg-test`.
4. En la sección 3 de la página, pegar la URL de cualquier torneo público de
   start.gg → **Buscar eventos** → copiar un `id` de evento → probar **Entrants**
   y **Standings**.

O por curl:

```bash
curl "http://localhost:3000/api/startgg/events?slug=URL_O_SLUG_DEL_TORNEO"
curl "http://localhost:3000/api/startgg/entrants?eventId=EL_ID"
curl "http://localhost:3000/api/startgg/standings?eventId=EL_ID"
```

### 4.2 · Flujo completo con OAuth

1. Crear la aplicación en https://start.gg/admin/profile/developer/applications
2. Registrar como **Redirect URL**: `http://localhost:3000/api/auth/startgg/callback`
   (más adelante se agrega la URL de producción).
3. Copiar `.env.local.example` → completar en `.env.local`:
   `STARTGG_CLIENT_ID`, `STARTGG_CLIENT_SECRET`, `STARTGG_REDIRECT_URI`.
   La redirect URI del `.env.local` y la registrada en start.gg deben ser
   **idénticas carácter por carácter** (incluye puerto y esquema).
4. Reiniciar `npm run dev` (Next solo lee `.env.local` al arrancar).
5. Abrir `http://localhost:3000/startgg-test` → **Conectar con Start.gg** →
   autorizar → al volver debe decir "✅ Conectado como …".
6. Probar **Listar torneos** como organizador (usa tus torneos creados en start.gg;
   si no tienes, crear uno de prueba es gratis y toma 2 minutos).

Si el login falla, la página de prueba muestra `?login=error&reason=...` en la URL
con el motivo exacto.

---

## 5 · Referencia de endpoints

Todos devuelven JSON. Errores: `{ error, detail?, hint? }` con status 400/401/404/502.

### `GET /api/auth/startgg/status`
`{ authenticated, user: { id, slug, gamerTag, name } | null, devTokenActive }`

### `GET /api/auth/startgg/login` · `POST /api/auth/startgg/logout`
Redirección a start.gg / borrado de sesión.

### `GET /api/startgg/tournaments?role=organizer|player&page=1&perPage=10`
Requiere sesión OAuth (401 si no hay).
- `organizer` (default): torneos **creados** por el usuario (filtro `ownerId`).
- `player`: torneos donde **participa** (`currentUser.tournaments`).

```json
{
  "role": "organizer", "page": 1, "perPage": 10, "total": 3, "totalPages": 1,
  "tournaments": [
    { "id": 812345, "name": "UCAB Clash #4", "slug": "tournament/ucab-clash-4",
      "startAt": 1767225600, "numAttendees": 32,
      "events": [ { "id": 1140299, "name": "Tekken 8 Singles",
                    "numEntrants": 32, "state": "ACTIVE", "slug": null,
                    "startAt": null, "videogame": null } ] }
  ]
}
```

### `GET /api/startgg/events?slug=<slug o URL>`
Acepta `mi-torneo`, `tournament/mi-torneo` o la URL completa de start.gg.
Devuelve `{ tournament: {id,name,slug}, events: [...] }`. Funciona con token personal.

### `GET /api/startgg/entrants?eventId=&page=&perPage=`
`{ event, page, perPage, total, totalPages, entrants: [{ id, name, gamerTags: [] }] }`

### `GET /api/startgg/standings?eventId=&page=&perPage=`
```json
{
  "event": { "id": 1140299, "name": "Tekken 8 Singles", "state": "COMPLETED" },
  "standings": [
    { "placement": 1, "entrantId": 17334455, "entrantName": "Wolf | Arcanius" },
    { "placement": 2, "entrantId": 17334460, "entrantName": "Nia" }
  ],
  "entrantIdsByPlacement": [17334455, 17334460]
}
```

`startAt` y demás timestamps vienen en **segundos** Unix (formato de Start.gg).

---

## 6 · Detalles que conviene saber

- **Rate limit de Start.gg:** 80 requests por 60 segundos por token, y máximo
  ~1000 objetos por request. Con las paginaciones por defecto no se roza.
- **Sesión:** cookie httpOnly `startgg_session` (base64 de JSON), `sameSite=lax`,
  `secure` en producción. httpOnly ⇒ el JS del navegador no puede leer los tokens.
  Sin base de datos de sesiones: decisión deliberada para el alcance del curso.
- **Scopes usados:** `user.identity` (habilita `currentUser`) y `user.email`
  (opcional). No pedimos `tournament.manager` ni `tournament.reporter` porque solo
  **leemos** datos; menos permisos = pantalla de consentimiento más amigable.
- **`.env.local` jamás se commitea.** El `.gitignore` de create-next-app ya lo
  excluye; verificar antes del primer push del frontend.
- **Página `/startgg-test`:** herramienta interna. Borrarla antes de la entrega
  o dejarla documentada como demo técnica, a criterio del equipo.

## 7 · Git

Siguiendo la convención del repo: crear `feature/startgg-integration` desde `dev`,
commitear estos archivos, PR hacia `dev` con revisión de otra persona y merge
`--no-ff`. (Requiere que la app ya esté en el monorepo y exista la rama `dev`.)
