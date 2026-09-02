import { ApiError } from "./api";

/**
 * Fetches an authenticated binary endpoint (a single track's audio file, or a playlist/genre ZIP)
 * and triggers a browser "Save As" via a synthetic <a download>. The filename is taken from the
 * server's Content-Disposition header when present — that's the source of truth, matching the
 * sanitized "{Title} - {Artist(s)}.{ext}"/"{Name}.zip" naming the backend generates —
 * `fallbackFileName` only covers a missing/unparsable header.
 */
export async function downloadFile(url: string, token: string, fallbackFileName = "download"): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new ApiError(0, "Could not reach the server. Is the backend running?");
  }

  if (!res.ok) {
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await res.json().catch(() => null) : null;
    throw new ApiError(res.status, body?.message ?? res.statusText);
  }

  const fileName = parseFileNameFromContentDisposition(res.headers.get("content-disposition")) ?? fallbackFileName;
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function parseFileNameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;

  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // fall through to the plain filename below
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}
