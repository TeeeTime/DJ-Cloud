# DJ Cloud Backend API

Endpoints implemented so far: user auth (login/registration/persistent sessions/logout/password
change), track upload/listing/editing, and artist search and management. Base URL for local dev:
`http://localhost:8080`.

**CORS**: only one origin is allowed to call this API from a browser, `http://localhost:3000` by
default (Next.js's default `next dev` port) — configurable via the `FRONTEND_ORIGIN` env var if the
frontend runs somewhere else. A request from any other origin is rejected before it reaches a
controller. If the frontend instead proxies API calls through its own server (e.g. Next.js API routes/
rewrites) rather than calling this API directly from the browser, CORS doesn't come into play at all.

## Auth

Protected endpoints require a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are issued by `/api/auth/login` and are valid for **7 days**. Store the token (e.g.
`localStorage`) and attach it to every request to a non-public endpoint.

Three roles exist:

| role     | can do                                                                 |
|----------|--------------------------------------------------------------------------|
| `USER`   | everything public, plus the account-management endpoints (`/me`, `/logout`, `/change-password`) |
| `EDITOR` | everything `USER` can, plus create/edit/delete tracks and artists         |
| `ADMIN`  | everything `EDITOR` can, plus generate registration codes                 |

Accounts are invite-only: there is no open signup, only `POST /api/auth/register` with a valid,
admin-issued, one-time registration code. The role an account gets is fixed on the code at the moment
an admin generates it (a `USER` code always creates a `USER`, an `EDITOR` code always creates an
`EDITOR`, etc.) — the registrant has no say in their own role.

**Logging out or changing password invalidates every token previously issued to that account, on every
device**, not just the current one (there's no per-device session concept). After either action, the
frontend must discard the stored token and send the user back to login.

### Error responses

Errors use Spring Boot's default shape:

```json
{
  "timestamp": "2026-08-26T08:16:50.780Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid or already used registration code",
  "path": "/api/auth/register"
}
```

`message` is sometimes generic (e.g. `403` returns `"Forbidden"`, an invalid/expired/logged-out token
on a protected route returns `401` with `"No message available"`) — don't rely on exact wording, use
`status` to branch behavior.

---

## `POST /api/auth/login`

**Public.** Exchange username/password for a JWT.

Request:
```json
{ "username": "tom", "password": "password123" }
```

Response `200`:
```json
{ "token": "eyJhbGciOi...", "username": "tom", "role": "USER" }
```

`401` with `"Invalid username or password"` on bad credentials (username and password failures are not
distinguished, by design).

---

## `POST /api/auth/refresh`

**Requires a valid JWT.** Exchanges the current token for a new one with a renewed 7-day expiry. This is
the "stay logged in" endpoint — call it periodically (e.g. on app load, or shortly before the stored
token's expiry) so the user never has to re-enter credentials while actively using the app.

Request: no body, just the `Authorization: Bearer <token>` header.

Response `200`: same shape as login —
```json
{ "token": "eyJhbGciOi...", "username": "tom", "role": "USER" }
```

`401` if the token is missing, malformed, expired, belongs to a since-deleted user, or was invalidated
by a logout/password change.

---

## `GET /api/auth/me`

**Requires a valid JWT.** Returns who the caller is, e.g. to restore UI state on page load without
decoding the JWT client-side.

Response `200`:
```json
{ "id": 1, "username": "tom", "role": "USER" }
```

---

## `POST /api/auth/logout`

**Requires a valid JWT.** Invalidates every token previously issued to the caller's account — including
the one used to call this endpoint, and any others (all devices). There is nothing to send in the
request body.

Response: `204 No Content`.

---

## `POST /api/auth/change-password`

**Requires a valid JWT.** Changes the caller's own password. Also logs the account out everywhere (see
above) — the frontend should redirect to login after a successful call, on this device too.

Request:
```json
{ "currentPassword": "password123", "newPassword": "newpassword456" }
```

`newPassword` must be 8–100 chars.

Response: `204 No Content`.

Errors:
- `401` `"Current password is incorrect"`.

---

## `POST /api/auth/register`

**Public**, but requires a valid, unused, admin-issued registration code — self-serve signup does not
exist by design (invite-only).

Request:
```json
{ "username": "tom", "password": "password123", "registrationCode": "HT3U9OFecFju2I7lcdmOJBSkUTpvqj6K" }
```

Validation: `username` 3–50 chars, `password` 8–100 chars, all fields required.

Response `201`: empty body. The account is created with whatever role the code was generated for (see
below) — call `/api/auth/login` next to get a token.

Errors:
- `400` `"Invalid or already used registration code"` — code doesn't exist or was already consumed.
- `409` `"Username is already taken"`.

---

## `POST /api/auth/registration-codes`

**Requires a JWT with role `ADMIN`.** Generates a one-time-use registration code for a specific role —
this is how new accounts get invited, likely only relevant for an admin-facing screen if one gets built.

Request:
```json
{ "role": "EDITOR" }
```
`role` is one of `USER`, `EDITOR`, `ADMIN` — whatever role is requested is the role the resulting account
will have once the code is redeemed.

Response `200`:
```json
{ "code": "HT3U9OFecFju2I7lcdmOJBSkUTpvqj6K", "role": "EDITOR" }
```

`403` if the caller is authenticated but not an admin, `401` if not authenticated at all.

---

## `GET /api/tracks`

**Public.** Paginated track listing.

Query params (all optional):

| param    | default | notes                                   |
|----------|---------|------------------------------------------|
| `page`   | `0`     | zero-indexed                              |
| `size`   | `30`    | page size                                 |
| `sortBy` | `title` | any `Track` field name, ascending         |

Response `200` — a Spring Data `Page`:
```json
{
  "content": [
    {
      "id": 1,
      "title": "Song Name",
      "durationSeconds": 214,
      "key": "8A",
      "bpm": 128,
      "fileFormat": "mp3",
      "status": "READY",
      "artists": ["Artist One", "Artist Two"]
    }
  ],
  "totalElements": 1,
  "totalPages": 1,
  "size": 30,
  "number": 0,
  "first": true,
  "last": true,
  "numberOfElements": 1
}
```

`status` is one of: `QUEUED`, `PROCESSING`, `READY`, `FAILED`. A track is only ever visible via this API
once it's fully registered — there is no "uploading" state exposed; see `POST /api/tracks` below.

`artists` is just a flat list of artist names (not ids), for display. To edit a track's artist
associations use the ids returned by the artist endpoints below, not names — see `PUT /api/tracks/{id}`.

---

## `GET /api/tracks/{id}`

**Public.** Fetch a single track.

Response `200`: same shape as one `content` entry above. `404` if no track has that id.

---

## `POST /api/tracks`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Uploads a track's audio file. This is the only way a
`Track` row gets created — there's no JSON create endpoint. Nothing is registered until the file has been
fully saved to disk *and* its metadata has been read; a failed/rejected upload never leaves a row behind
or an orphaned file on disk.

Request: `multipart/form-data` with a single part named `file` — an `.mp3` or `.wav` file (checked by
extension; max 200MB).

Behavior:
- `title` comes from the file's ID3/tag data if present; otherwise falls back to the uploaded filename
  minus its extension.
- `artists` comes from the file's artist tag if present (an artist with that name is found or created);
  otherwise the track is created with zero artists — there's no fake "Unknown Artist" placeholder.
- `durationSeconds` is always read from the actual audio data, not a placeholder — this works even for a
  file with no tags at all.
- `bpm` (`0`) and `key` (`null`) are placeholders — nothing analyzes actual audio content yet. A future
  pipeline (not built) will fill these in and move `status` through `PROCESSING` to `READY`/`FAILED`.
- `status` starts at `QUEUED`.
- `fileFormat` is the file's extension (`mp3`/`wav`).

Response `201`: the created track, same shape as `GET /api/tracks/{id}`.

Errors — on every one of these, no `Track` row is created and no file is left on disk:
- `400` `"Uploaded file is empty"`.
- `400` `"Unsupported file type — only .mp3 and .wav are accepted"`.
- `400` `"Uploaded file could not be read as audio"` — right extension, but the content isn't valid/
  parsable audio.
- `413` if the file exceeds the 200MB request-size limit.
- `500` `"Track could not be saved"` — an error after the file was already written (e.g. a DB error); the
  file is cleaned up before this is returned.

---

## `PUT /api/tracks/{id}`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Edits a track's metadata and artist tagging. This is
metadata-only — it never creates a track or changes its file; see `POST /api/tracks` for that.

Request — replaces the full set of editable fields (not a partial patch):
```json
{
  "title": "Song Name",
  "durationSeconds": 214,
  "key": "8A",
  "bpm": 128,
  "fileFormat": "mp3",
  "status": "READY",
  "artistIds": [1, 2]
}
```
`artistIds` replaces the track's artist associations wholesale — resolve/create artists via the artist
endpoints first, then reference them by id here. An empty array clears all artist tags.

Response `200`: the updated track, same shape as `GET /api/tracks/{id}`.

Errors:
- `404` if the track doesn't exist.
- `400` `"Unknown artist id: <id>"` if any id in `artistIds` doesn't exist.

---

## `DELETE /api/tracks/{id}`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Response: `204 No Content`, or `404` if the track
doesn't exist.

---

## `GET /api/artists/autocomplete`

**Public.** Case-insensitive substring search over artist names, for a search-as-you-type field.

Query params:

| param   | default | notes                                    |
|---------|---------|--------------------------------------------|
| `query` | —       | **required.** Blank/missing returns `[]` rather than erroring. |
| `limit` | `10`    | max results, sorted alphabetically by name |

Response `200`:
```json
[
  { "id": 1, "name": "Artist One" },
  { "id": 2, "name": "Artist Two" }
]
```

---

## `POST /api/artists`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Creates an artist.

Request:
```json
{ "name": "Artist One" }
```

Response `200`: `{ "id": 1, "name": "Artist One" }`. `409` `"Artist already exists"` if the name
already exists (case-insensitive).

---

## `PUT /api/artists/{id}`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Renames an artist.

Request: `{ "name": "New Name" }`

Response `200`: the updated artist. `404` if the artist doesn't exist.

---

## `DELETE /api/artists/{id}`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Deletes an artist and untags it from every track that
referenced it (tracks themselves are not deleted). Response: `204 No Content`, or `404` if the artist
doesn't exist.

---

## Not yet implemented

Flagging gaps a frontend might expect but that don't exist yet: no "forgot password" email flow (only
`POST /api/auth/change-password` for a logged-in user — there's no mail service in this app), no way to
list/revoke outstanding registration codes, and no async analysis/preview-generation pipeline yet — a
track uploaded via `POST /api/tracks` sits in `QUEUED` indefinitely for now; nothing currently moves it
to `PROCESSING`/`READY`/`FAILED` or fills in real `bpm`/`key` values.
