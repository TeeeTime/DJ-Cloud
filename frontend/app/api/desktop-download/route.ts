import { NextResponse } from "next/server";

const REPO = "TeeeTime/DJ-Cloud";

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

export interface DesktopDownloadLinks {
  version: string | null;
  windows: string | null;
  macos: string | null;
}

/**
 * Resolves the current release's real installer URLs from GitHub rather than linking to anything
 * fixed — every installer filename embeds the version and changes each release. Cached via the
 * `fetch` call's own revalidation, not per-request, so visitor traffic never drives GitHub API
 * rate limits.
 */
export async function GET() {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "djcloud-website",
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    return NextResponse.json<DesktopDownloadLinks>({ version: null, windows: null, macos: null }, { status: 502 });
  }

  const release: GitHubRelease = await response.json();
  const assets = release.assets ?? [];

  const windows = assets.find((asset) => asset.name.endsWith("-setup.exe"));
  const macos = assets.find((asset) => asset.name.endsWith(".dmg"));

  return NextResponse.json<DesktopDownloadLinks>({
    version: release.tag_name ?? null,
    windows: windows?.browser_download_url ?? null,
    macos: macos?.browser_download_url ?? null,
  });
}
