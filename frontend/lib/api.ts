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
  status: TrackStatus;
  artists: string[];
  genres: string[];
}

export interface TracksPage {
  content: TrackResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  numberOfElements: number;
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
};

export type AnalysisStep = "PREVIEW_GENERATION" | "BPM_ANALYSIS" | "KEY_ANALYSIS";

export interface QueueStatus {
  queued: number[];
  processing: { trackId: number; step: AnalysisStep } | null;
}

export const tracksApi = {
  list: (params: { page?: number; size?: number; sortBy?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page !== undefined) query.set("page", String(params.page));
    if (params.size !== undefined) query.set("size", String(params.size));
    if (params.sortBy) query.set("sortBy", params.sortBy);
    const qs = query.toString();
    return request<TracksPage>(`/api/tracks${qs ? `?${qs}` : ""}`, { method: "GET" });
  },

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
