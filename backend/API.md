# DJ Cloud Backend API

Endpoints implemented so far: user auth (login/registration/persistent sessions/logout/password
change), track upload/listing/editing, artist and genre search and management, and playlists
(creation, editing, deletion, track membership, and subscriptions). Base URL for local dev:
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
| `USER`   | everything public, plus the account-management endpoints (`/me`, `/logout`, `/change-password`), plus viewing public playlists (and any private playlist they own) and subscribing/unsubscribing to any playlist they can see |
| `EDITOR` | everything `USER` can, plus create/edit/delete tracks and artists, plus creating playlists and adding/removing tracks on any playlist they're allowed to edit (see `GET /api/playlists/{id}` below) |
| `ADMIN`  | everything `EDITOR` can, plus generate registration codes                 |

Playlist visibility, track-edit rights, and playlist-edit rights are **not** purely role-based — they
also depend on ownership and the playlist's public/private flag. There's no admin override: an `ADMIN`
who doesn't own a private playlist can't see or edit it, same as anyone else. Renaming, changing
visibility, or deleting a playlist is restricted to its owner alone — even an `ADMIN` can't do it for
someone else's playlist. Subscribing is the one playlist action open to every role, including plain
`USER`, since it's just a personal bookmark and doesn't grant any edit rights. See the playlist
endpoints below.

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

## `POST /api/auth/me/recently-added-seen`

**Requires a valid JWT.** Marks the caller's "recently added" list as seen as of now — every track
currently `isNew` in `GET /api/tracks/recent` stops being `isNew` after this call (until newer tracks are
added).

Response: `204 No Content`.

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

**Public.** Backend-driven, searchable, sortable, paginated track listing — search, sort, and paging
all apply together against the whole library, not just whatever page happens to be loaded.

Query params (all optional):

| param                | default | notes                                                                                          |
|-----------------------|---------|--------------------------------------------------------------------------------------------------|
| `page`                | `0`     | zero-indexed                                                                                      |
| `size`                | `30`    | page size                                                                                          |
| `sortBy`              | `title` | one of `title`, `artist`, `bpm`, `addedAt`, `dateAdded`, `durationSeconds`, `key`, `fileFormat`. `400` on an unknown value. |
| `direction`           | `asc`   | `asc` or `desc` (case-insensitive). `400` on an unknown value.                                    |
| `query`               | —       | case-insensitive substring match against title, artist name, **or** genre name. Blank/missing means no filter. |
| `excludePlaylistId`   | —       | when set, tracks already in that playlist are omitted — used by the playlist "add tracks" search bar. |

`sortBy=artist` sorts by each track's alphabetically-first artist name (a track can have several);
tracks with no artists sort last regardless of `direction`.

Response `200`:
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
      "dateAdded": "2026-08-28",
      "addedAt": "2026-08-28T23:11:12.605Z",
      "status": "READY",
      "artists": ["Artist One", "Artist Two"],
      "genres": ["Tech House", "Deep House"]
    }
  ],
  "page": 0,
  "size": 30,
  "totalElements": 1,
  "totalPages": 1,
  "hasNext": false
}
```

`status` is one of: `QUEUED`, `PROCESSING`, `READY`, `FAILED`. A track is only ever visible via this API
once it's fully registered — there is no "uploading" state exposed; see `POST /api/tracks` below.

`artists` is just a flat list of artist names (not ids), for display. To edit a track's artist
associations use the ids returned by the artist endpoints below, not names — see `PUT /api/tracks/{id}`.

`genres` is the same idea, for a track's up to 3 genres — a flat list of genre names, edited via
`genreIds` using the ids returned by the genre endpoints below — see `PUT /api/tracks/{id}`.

---

## `GET /api/tracks/{id}`

**Public.** Fetch a single track.

Response `200`: same shape as one `content` entry above. `404` if no track has that id.

---

## `GET /api/tracks/recent`

**Requires a JWT** (any role) — unlike the rest of `GET /api/tracks/**`, this isn't public, since it's
personalized to the caller (see `isNew` below). Most-recently-added tracks first.

Query params:

| param   | default | notes                     |
|---------|---------|----------------------------|
| `limit` | `20`    | max results                |

Response `200`:
```json
{
  "tracks": [
    {
      "id": 1,
      "title": "Song Name",
      "artists": ["Artist One"],
      "addedAt": "2026-08-29T14:03:11.123Z",
      "isNew": true
    }
  ],
  "newCount": 12
}
```
`addedAt` is the exact moment the track was added (unlike `dateAdded` elsewhere, which is day-only).
`isNew` is `true` if `addedAt` is after the caller's last call to `POST /api/auth/me/recently-added-seen`
(or always `true` if they've never called it) — see that endpoint below.

`newCount` is the *total* number of new tracks, independent of `limit` — it can exceed `tracks.length` when
there are more new tracks than fit in the response; every entry in `tracks` is still guaranteed to be one
of the most-recently-added tracks overall, so `isNew` stays correct even when `tracks` doesn't contain all
of them.

---

## `GET /api/tracks/{id}/audio`

**Public.** Streams the track's generated streaming preview — **never the original upload**. The preview
is a lower-bitrate MP3 transcode produced by the analysis pipeline (see `POST /api/tracks` below); it only
exists once analysis has finished successfully (`status == READY`).

Supports HTTP range requests (`Range: bytes=...`), so a `<audio>`/`<video>` element can seek without
downloading the whole file first.

Response `206` (always partial content, even without a `Range` header — the first response is capped to
a ~1MB chunk so the client naturally follows up with further range requests): the raw audio bytes,
`Content-Type` always `audio/mpeg` (previews are always MP3, regardless of the original's `fileFormat`).

`404` `"No preview available for this track yet"` if the track doesn't exist, or has no preview yet —
this includes any track that's `QUEUED`, `PROCESSING`, or `FAILED`, and legacy rows from before this
pipeline existed that haven't been reprocessed yet. There is no fallback to the original file.

---

## `GET /api/tracks/queue`

**Public.** Live snapshot of the analysis queue, for showing per-track progress in a frontend (poll this
endpoint on an interval — there's no push/WebSocket variant).

Response `200`:
```json
{
  "queued": [5, 6, 7],
  "processing": { "trackId": 4, "step": "BPM_ANALYSIS" }
}
```
`queued` is every track id waiting its turn, in the order they'll be processed. `processing` is `null`
when the worker is idle; otherwise the track currently being analyzed and which of the three steps is
running: `PREVIEW_GENERATION`, `BPM_ANALYSIS`, or `KEY_ANALYSIS`. Tracks are always processed one at a
time, in the order they were queued.

---

## `GET /api/tracks/{id}/cover`

**Public.** Reads the embedded cover art straight out of the track's audio file (ID3 `APIC`/similar tag)
and streams it back. Nothing is cached, resized, or persisted separately — every call re-reads the tag
from the file on disk. There's no fallback image; a frontend should show its own placeholder on `404`.

Response `200`: the raw image bytes, `Content-Type` taken from the tag itself (typically `image/jpeg` or
`image/png`).

`404` if the track doesn't exist, has no file on disk, or the file has no embedded artwork.

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
- `genres` comes from the file's genre tag if present (up to 3, split on `;`/`/`/`,` and deduped
  case-insensitively; each name is found or created); otherwise the track is created with zero genres.
- `durationSeconds` is always read from the actual audio data, not a placeholder — this works even for a
  file with no tags at all.
- `bpm` (`0`) and `key` (`null`) are placeholders until analysis finishes — see below.
- `status` starts at `QUEUED`.
- `fileFormat` is the file's extension (`mp3`/`wav`).
- `dateAdded` is today's date (server-side, `yyyy-MM-dd`) — the day the track was uploaded. Not
  settable by the client and not part of `PUT /api/tracks/{id}`'s editable fields.
- `addedAt` is the exact upload instant (server-side) — same purpose as `dateAdded` but precise to the
  moment, for correct ordering when multiple tracks are added the same day. Also not settable by the
  client and not part of `PUT /api/tracks/{id}`'s editable fields.

The upload response returns immediately with `status: QUEUED`; the track is then picked up asynchronously
(one track at a time, in upload order) for analysis: a streaming preview is generated, then BPM is
detected, then musical key is detected. `status` moves to `PROCESSING` once its turn comes, then to
`READY` (with real `bpm`/`key` values, and a preview now servable via `GET /{id}/audio`) if all three
steps succeed, or `FAILED` if any one of them fails — nothing further happens to a `FAILED` track unless
the server is restarted (see "Not yet implemented" below). Poll `GET /api/tracks/queue` for live progress.

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

**Requires a JWT with role `EDITOR` or `ADMIN`.** Edits a track's metadata, artist tagging, and genre
tagging. This never creates a track or replaces its file — see `POST /api/tracks` for that — but it does
write `title`, `key`, `bpm`, and the artist and genre lists back into the original audio file's own tags
(if a file exists on disk for the track), so the file and the database never drift apart.

Request — replaces the full set of editable fields (not a partial patch):
```json
{
  "title": "Song Name",
  "durationSeconds": 214,
  "key": "8A",
  "bpm": 128,
  "fileFormat": "mp3",
  "status": "READY",
  "artistIds": [1, 2],
  "genreIds": [1, 2]
}
```
`artistIds` replaces the track's artist associations wholesale — resolve/create artists via the artist
endpoints first, then reference them by id here. An empty array clears all artist tags (and the file's
artist tag).

`genreIds` works the same way for genres, via the genre endpoints below — **at most 3 ids**.

Response `200`: the updated track, same shape as `GET /api/tracks/{id}`.

Errors:
- `404` if the track doesn't exist.
- `400` `"Unknown artist id: <id>"` if any id in `artistIds` doesn't exist.
- `400` `"Unknown genre id: <id>"` if any id in `genreIds` doesn't exist.
- `400` if `genreIds` has more than 3 entries.
- `500` `"Could not update audio file metadata"` if the track has a file on disk but writing the tags
  back to it fails — the whole update is rejected in this case, so the database and the file never end
  up disagreeing.

Note: `status` here is set exactly as sent — it is **not** validated against the analysis pipeline's own
state machine (`QUEUED → PROCESSING → READY/FAILED`, see `POST /api/tracks`). Setting it manually (e.g.
back to `QUEUED`) does not actually re-enqueue the track for analysis.

---

## `PUT /api/tracks/{id}/cover`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Replaces the track's embedded cover art. There's no
separate cover storage (see `GET /{id}/cover` above) — this writes the image straight into the
original audio file's artwork tag, replacing whatever was embedded before.

Request: `multipart/form-data` with a single part named `file` — a `.jpg`/`.jpeg` or `.png` image
(checked by `Content-Type`; max 200MB, same global limit as track uploads).

Response: `204 No Content`.

Errors:
- `404` if the track doesn't exist, or has no audio file on disk.
- `400` `"Uploaded cover image is empty"`.
- `400` `"Unsupported image type — only .jpg/.jpeg and .png are accepted"`.
- `500` `"Could not update audio file metadata"` if writing the artwork into the file fails.

---

## `DELETE /api/tracks/{id}`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Also deletes the track's audio file from disk, and its
generated preview file if one exists.
Response: `204 No Content`, or `404` if the track doesn't exist.

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

## `GET /api/genres/autocomplete`

**Public.** Case-insensitive substring search over genre names, for a search-as-you-type field.

Query params:

| param   | default | notes                                    |
|---------|---------|--------------------------------------------|
| `query` | —       | **required.** Blank/missing returns `[]` rather than erroring. |
| `limit` | `10`    | max results, sorted alphabetically by name |

Response `200`:
```json
[
  { "id": 1, "name": "Tech House" },
  { "id": 2, "name": "Deep House" }
]
```

---

## `GET /api/genres/distribution`

**Public.** How many tracks are tagged with each genre, most-tagged first. A genre with zero tagged
tracks is omitted entirely rather than returned with `count: 0`.

Response `200`:
```json
[
  { "name": "Tech House", "count": 42 },
  { "name": "Deep House", "count": 17 }
]
```

---

## `GET /api/genres/{name}/tracks`

**Public.** Same backend-driven search/sort/paging as `GET /api/tracks`, scoped to tracks tagged with
this genre — `{name}` is matched case-insensitively against the genre's name (not an id). A track
tagged with multiple genres appears under each of them.

Query params (all optional, identical semantics to `GET /api/tracks`): `page`, `size`, `sortBy`,
`direction`, `query` (further text-searches within this genre's tracks).

Response `200`: same shape as `GET /api/tracks`. `404` if no genre with that name exists.

---

## `POST /api/genres`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Creates a genre.

Request:
```json
{ "name": "Tech House" }
```

Response `200`: `{ "id": 1, "name": "Tech House" }`. `409` `"Genre already exists"` if the name
already exists (case-insensitive).

---

## `PUT /api/genres/{id}`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Renames a genre.

Request: `{ "name": "New Name" }`

Response `200`: the updated genre. `404` if the genre doesn't exist.

---

## `DELETE /api/genres/{id}`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Deletes a genre and untags it from every track that
referenced it (tracks themselves are not deleted). Response: `204 No Content`, or `404` if the genre
doesn't exist.

---

## `GET /api/playlists`

**Requires a valid JWT** (any role) — unlike track/artist/genre listing, this isn't public, since
visibility is per-user (see below).

Query params:

| param          | default | notes                                                                 |
|-----------------|---------|-------------------------------------------------------------------------|
| `editableOnly` | `false` | when `true`, only playlists the caller can add/remove tracks on are returned (see `canEditTracks` below) |

Returns every playlist visible to the caller: all public playlists, plus the caller's own private
ones — **regardless of whether the caller is subscribed** (see `subscribed` below and the
subscription endpoints further down). Ordered **most-recently-viewed-by-the-caller first** (viewing
is recorded by `GET /api/playlists/{id}`, below); playlists the caller has never viewed sort after
every viewed one, most-recently-created first among themselves.

A frontend showing "my" playlists (e.g. a sidebar) should filter this list client-side to entries
where `subscribed` is `true` **or** `ownerUsername` matches the caller — an owner isn't necessarily
subscribed to their own playlist (they can unsubscribe from it like anyone else without losing
ownership or access), so `subscribed` alone would incorrectly hide it. This endpoint intentionally
returns the full visible set (subscribed or not) so callers can also use it to find playlists to
subscribe to or add tracks to.

Response `200`:
```json
[
  {
    "id": 1,
    "name": "Peak Time",
    "isPublic": true,
    "ownerUsername": "tom",
    "createdAt": "2026-08-29T14:03:11.123Z",
    "trackCount": 12,
    "subscribed": true
  }
]
```

---

## `GET /api/playlists/{id}`

**Requires a valid JWT.** Fetches a single playlist's metadata (not its tracks — see
`GET /api/playlists/{id}/tracks` below for those). Also records that the caller viewed this playlist
just now — this is what drives the ordering of `GET /api/playlists` above.

A private playlist is only visible to its owner — **not** even to an `ADMIN`. Requesting one you can't
see returns `404`, not `403`, so a non-owner can't distinguish "doesn't exist" from "exists but is
private" by status code alone.

Response `200`:
```json
{
  "id": 1,
  "name": "Peak Time",
  "isPublic": true,
  "ownerUsername": "tom",
  "createdAt": "2026-08-29T14:03:11.123Z",
  "canEditTracks": true,
  "subscribed": true,
  "trackCount": 12
}
```
`canEditTracks` tells the frontend whether the caller is allowed to add/remove tracks on this
playlist right now (see the rule under `POST .../tracks` below) — computed server-side so the
frontend doesn't need to re-derive it. `subscribed` reflects the caller's own subscription (see
`POST .../subscription` below) — unrelated to `canEditTracks` and to ownership.

`404` if the playlist doesn't exist, or exists but is private and the caller isn't its owner.

---

## `GET /api/playlists/{id}/tracks`

**Requires a valid JWT** (same visibility rule as `GET /api/playlists/{id}` above — `404` for a private
playlist the caller doesn't own). Backend-driven search/sort/paging over this one playlist's tracks —
same query params, same response shape, and same `sortBy`/`direction` semantics as `GET /api/tracks`,
just scoped to this playlist instead of the whole library.

Query params (all optional): `page`, `size`, `sortBy`, `direction`, `query` — identical to
`GET /api/tracks` above.

Response `200`: same shape as `GET /api/tracks`.

---

## `POST /api/playlists`

**Requires a JWT with role `EDITOR` or `ADMIN`.** Creates a playlist owned by the caller. The owner is
automatically subscribed to it (see `POST .../subscription` below), so it shows up in their own
subscribed-playlists view right away.

Request:
```json
{ "name": "Peak Time", "isPublic": true }
```

Response `201`: the created playlist, same shape as one entry from `GET /api/playlists`
(`subscribed: true`).

---

## `PUT /api/playlists/{id}`

**Requires a JWT with role `EDITOR` or `ADMIN`, and the caller must be the playlist's owner** — unlike
track membership (`POST .../tracks` below), renaming or changing a playlist's public/private flag is
**not** open to every `EDITOR`/`ADMIN` on a public playlist, only to whoever created it. There is no
admin override.

Request: same shape as `POST /api/playlists` — replaces both fields.
```json
{ "name": "New Name", "isPublic": false }
```

Response `200`: the updated playlist, same shape as one entry from `GET /api/playlists`.

Errors:
- `404` if the playlist doesn't exist, or is private and not owned by the caller (privacy note above).
- `403` if the playlist is visible to the caller but they're not its owner.

---

## `DELETE /api/playlists/{id}`

**Same permission rule as `PUT /api/playlists/{id}` above — owner only.** Deletes the playlist itself
(not its tracks — the tracks stay in the library). Also removes every subscription and last-viewed
record pointing at it.

Response: `204 No Content`. Same `403`/`404` semantics as `PUT /api/playlists/{id}`.

---

## `POST /api/playlists/{id}/subscription`

**Requires a valid JWT — any role.** Subscribes the caller to this playlist. This is what determines
whether a playlist shows up in a caller-scoped view like a sidebar (via `subscribed` on
`GET /api/playlists`/`GET /api/playlists/{id}`) — separate from visibility and from edit rights.
Idempotent: subscribing twice is a no-op the second time.

Response `200`: the playlist, same shape as `GET /api/playlists/{id}` (`subscribed: true`).

`404` if the playlist doesn't exist, or is private and not owned by the caller (privacy note above) —
you can't subscribe to a playlist you can't see.

---

## `DELETE /api/playlists/{id}/subscription`

**Requires a valid JWT — any role.** Unsubscribes the caller. Idempotent: unsubscribing when not
subscribed is a no-op. Note this applies even to a playlist's own owner — unsubscribing from your own
playlist removes it from your subscribed-playlists view too (ownership is unaffected; you can still
open and edit it directly).

Response `200`: the playlist, same shape as `GET /api/playlists/{id}` (`subscribed: false`).

---

## `POST /api/playlists/{id}/tracks`

**Requires a JWT with role `EDITOR` or `ADMIN`, and permission on this specific playlist** — allowed
only if the playlist is public, **or** the caller owns it. (A plain role check isn't enough: an
`EDITOR` who doesn't own a private playlist can't add tracks to it either.)

Request:
```json
{ "trackId": 5 }
```

Response `200`: the updated playlist, same shape as `GET /api/playlists/{id}`.

Errors:
- `404` if the playlist doesn't exist or is private and not owned by the caller (see the privacy note
  under `GET /api/playlists/{id}`).
- `403` if the playlist is visible to the caller but they don't have edit rights on it (e.g. a public
  playlist and the caller is only `USER`, or a private playlist they don't own even though they are
  `EDITOR`/`ADMIN`).
- `404` `"Track not found"` if `trackId` doesn't exist.

---

## `DELETE /api/playlists/{id}/tracks/{trackId}`

**Same permission rule as `POST .../tracks` above.** Removes a track from the playlist; no error if
the track wasn't in the playlist to begin with.

Response `200`: the updated playlist, same shape as `GET /api/playlists/{id}`. Same `403`/`404`
semantics as `POST .../tracks`.

---

## Not yet implemented

Flagging gaps a frontend might expect but that don't exist yet: no "forgot password" email flow (only
`POST /api/auth/change-password` for a logged-in user — there's no mail service in this app), no way to
list/revoke outstanding registration codes, no manual retry for a `FAILED` track (only restarting the
server re-queues it — see `POST /api/tracks`), no cancelling a queued/in-progress analysis, no
push/WebSocket variant of `GET /api/tracks/queue` (polling only), and no way to transfer a playlist's
ownership to another user.
