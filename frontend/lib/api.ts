const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  // Let the browser set multipart/form-data with its boundary itself.
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "Could not reach the server. Is the backend running?");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? res.statusText);
  }

  return body as T;
}

export type Role = "USER" | "EDITOR" | "ADMIN";

export interface AuthResponse {
  token: string;
  username: string;
  role: Role;
}

export interface MeResponse {
  id: number;
  username: string;
  role: Role;
}

export const authApi = {
  login: (username: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  refresh: (token: string) => request<AuthResponse>("/api/auth/refresh", { method: "POST" }, token),

  me: (token: string) => request<MeResponse>("/api/auth/me", { method: "GET" }, token),

  logout: (token: string) => request<void>("/api/auth/logout", { method: "POST" }, token),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<void>(
      "/api/auth/change-password",
      { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) },
      token
    ),

  register: (username: string, password: string, registrationCode: string) =>
    request<void>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, registrationCode }),
    }),

  generateRegistrationCode: (token: string, role: Role) =>
    request<RegistrationCodeResponse>(
      "/api/auth/registration-codes",
      { method: "POST", body: JSON.stringify({ role }) },
      token
    ),

  markRecentlyAddedSeen: (token: string) =>
    request<void>("/api/auth/me/recently-added-seen", { method: "POST" }, token),
};

export interface RegistrationCodeResponse {
  code: string;
  role: Role;
}

export type TrackStatus = "QUEUED" | "PROCESSING" | "READY" | "FAILED";

export interface TrackResponse {
  id: number;
  title: string;
  durationSeconds: number;
  key: string | null;
  bpm: number;
  fileFormat: string;
  dateAdded: string;
  addedAt: string;
  status: TrackStatus;
  artists: string[];
  genres: string[];
}

export interface RecentTrackResponse {
  id: number;
  title: string;
  artists: string[];
  addedAt: string;
  isNew: boolean;
}

export interface RecentTracksResponse {
  tracks: RecentTrackResponse[];
  newCount: number;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
}

export interface TrackUpdateRequest {
  title: string;
  durationSeconds: number;
  key: string | null;
  bpm: number;
  fileFormat: string;
  status: TrackStatus;
  artistIds: number[];
  genreIds: number[];
}

export interface ArtistResponse {
  id: number;
  name: string;
}

export const artistsApi = {
  autocomplete: (query: string) => {
    const qs = new URLSearchParams();
    if (query) qs.set("query", query);
    return request<ArtistResponse[]>(`/api/artists/autocomplete?${qs.toString()}`, { method: "GET" });
  },
  create: (name: string, token: string) =>
    request<ArtistResponse>("/api/artists", { method: "POST", body: JSON.stringify({ name }) }, token),
};

export interface GenreResponse {
  id: number;
  name: string;
}

export const genresApi = {
  autocomplete: (query: string) => {
    const qs = new URLSearchParams();
    if (query) qs.set("query", query);
    return request<GenreResponse[]>(`/api/genres/autocomplete?${qs.toString()}`, { method: "GET" });
  },
  create: (name: string, token: string) =>
    request<GenreResponse>("/api/genres", { method: "POST", body: JSON.stringify({ name }) }, token),
  distribution: () => request<GenreDistributionResponse[]>("/api/genres/distribution", { method: "GET" }),

  getTracks: (name: string, params: TrackListParams = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.size !== undefined) query.set("size", String(params.size));
    if (params.sortBy) query.set("sortBy", params.sortBy);
    if (params.direction) query.set("direction", params.direction);
    if (params.query) query.set("query", params.query);
    const qs = query.toString();
    return request<PageResponse<TrackResponse>>(`/api/genres/${encodeURIComponent(name)}/tracks${qs ? `?${qs}` : ""}`, { method: "GET" });
  },
};

export interface GenreDistributionResponse {
  name: string;
  count: number;
}

export type AnalysisStep = "PREVIEW_GENERATION" | "BPM_ANALYSIS" | "KEY_ANALYSIS";

export interface QueueStatus {
  queued: number[];
  processing: { trackId: number; step: AnalysisStep } | null;
}

export interface TrackListParams {
  page?: number;
  size?: number;
  sortBy?: string;
  direction?: "asc" | "desc";
  query?: string;
  excludePlaylistId?: number;
}

export const tracksApi = {
  list: (params: TrackListParams = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.size !== undefined) query.set("size", String(params.size));
    if (params.sortBy) query.set("sortBy", params.sortBy);
    if (params.direction) query.set("direction", params.direction);
    if (params.query) query.set("query", params.query);
    if (params.excludePlaylistId !== undefined) query.set("excludePlaylistId", String(params.excludePlaylistId));
    const qs = query.toString();
    return request<PageResponse<TrackResponse>>(`/api/tracks${qs ? `?${qs}` : ""}`, { method: "GET" });
  },

  recent: (limit: number, token: string) =>
    request<RecentTracksResponse>(`/api/tracks/recent?limit=${limit}`, { method: "GET" }, token),

  get: (id: number) => request<TrackResponse>(`/api/tracks/${id}`, { method: "GET" }),

  upload: (file: File, token: string) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<TrackResponse>("/api/tracks", { method: "POST", body: formData }, token);
  },

  update: (id: number, data: TrackUpdateRequest, token: string) =>
    request<TrackResponse>(
      `/api/tracks/${id}`,
      { method: "PUT", body: JSON.stringify(data) },
      token
    ),

  delete: (id: number, token: string) =>
    request<void>(`/api/tracks/${id}`, { method: "DELETE" }, token),

  audioUrl: (id: number) => `${API_BASE_URL}/api/tracks/${id}/audio`,

  coverUrl: (id: number) => `${API_BASE_URL}/api/tracks/${id}/cover`,

  queue: () => request<QueueStatus>("/api/tracks/queue", { method: "GET" }),
};

export interface PlaylistResponse {
  id: number;
  name: string;
  isPublic: boolean;
  ownerUsername: string;
  createdAt: string;
  trackCount: number;
  subscribed: boolean;
}

export interface PlaylistDetailResponse {
  id: number;
  name: string;
  isPublic: boolean;
  ownerUsername: string;
  createdAt: string;
  canEditTracks: boolean;
  subscribed: boolean;
  trackCount: number;
}

export const playlistsApi = {
  list: (token: string, editableOnly = false) =>
    request<PlaylistResponse[]>(`/api/playlists?editableOnly=${editableOnly}`, { method: "GET" }, token),

  get: (id: number, token: string) =>
    request<PlaylistDetailResponse>(`/api/playlists/${id}`, { method: "GET" }, token),

  getTracks: (id: number, params: TrackListParams, token: string) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.size !== undefined) query.set("size", String(params.size));
    if (params.sortBy) query.set("sortBy", params.sortBy);
    if (params.direction) query.set("direction", params.direction);
    if (params.query) query.set("query", params.query);
    const qs = query.toString();
    return request<PageResponse<TrackResponse>>(`/api/playlists/${id}/tracks${qs ? `?${qs}` : ""}`, { method: "GET" }, token);
  },

  create: (name: string, isPublic: boolean, token: string) =>
    request<PlaylistResponse>(
      "/api/playlists",
      { method: "POST", body: JSON.stringify({ name, isPublic }) },
      token
    ),

  update: (id: number, name: string, isPublic: boolean, token: string) =>
    request<PlaylistResponse>(
      `/api/playlists/${id}`,
      { method: "PUT", body: JSON.stringify({ name, isPublic }) },
      token
    ),

  delete: (id: number, token: string) =>
    request<void>(`/api/playlists/${id}`, { method: "DELETE" }, token),

  subscribe: (id: number, token: string) =>
    request<PlaylistDetailResponse>(`/api/playlists/${id}/subscription`, { method: "POST" }, token),

  unsubscribe: (id: number, token: string) =>
    request<PlaylistDetailResponse>(`/api/playlists/${id}/subscription`, { method: "DELETE" }, token),

  addTrack: (playlistId: number, trackId: number, token: string) =>
    request<PlaylistDetailResponse>(
      `/api/playlists/${playlistId}/tracks`,
      { method: "POST", body: JSON.stringify({ trackId }) },
      token
    ),

  removeTrack: (playlistId: number, trackId: number, token: string) =>
    request<PlaylistDetailResponse>(
      `/api/playlists/${playlistId}/tracks/${trackId}`,
      { method: "DELETE" },
      token
    ),
};
