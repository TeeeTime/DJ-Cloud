import { NextResponse } from "next/server";

const REPO = "TeeeTime/DJ-Cloud";
const WINDOWS_SUFFIX = "-setup.exe";
const MACOS_SUFFIX = ".dmg";
const TTL_MS = 120_000;

interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
}

export interface DesktopDownloadLinks {
  version: string | null;
  windows: string | null;
  macos: string | null;
}

const EMPTY_LINKS: DesktopDownloadLinks = { version: null, windows: null, macos: null };

function hasBothInstallers(release: GitHubRelease): boolean {
  const assets = release.assets ?? [];
  return assets.some((a) => a.name.endsWith(WINDOWS_SUFFIX)) && assets.some((a) => a.name.endsWith(MACOS_SUFFIX));
}

// Explicit in-process cache instead of relying on Next's route/fetch caching — that requires
// `export const dynamic = 'force-static'` to make `next: { revalidate }` take effect at all (this
// route previously assumed it didn't), which is exactly the kind of subtle, version-sensitive
// framework behavior we got burned by once already. This is only safe as long as the frontend runs
// as a single instance (true today: one Docker container on one VPS) — a multi-replica deployment
// would need a shared cache instead, since each instance would otherwise track its own.
let cache: { data: DesktopDownloadLinks; fetchedAt: number } | null = null;
let inFlight: Promise<DesktopDownloadLinks> | null = null;

/**
 * Resolves the current release's real installer URLs from GitHub rather than linking to anything
 * fixed — every installer filename embeds the version and changes each release.
 *
 * Deliberately walks the release list (newest first) instead of trusting `releases/latest` alone:
 * the desktop client is built by a separate, much slower CI job (native compiles for two platforms)
 * that uploads its installers to a release *after* that release is already published, so the newest
 * release can sit live on GitHub for several minutes with zero or one of the two installers actually
 * attached. Falling back to the newest release that already has *both* assets means visitors always
 * get a working download (at worst one version behind) instead of a dead button during that gap.
 *
 * The fallback search prefers a non-prerelease release (matching `releases/latest`'s own semantics)
 * but accepts a prerelease one too if that's all that's available: in this repo's actual history
 * only one release has ever been marked non-prerelease, so requiring that flag on the fallback as
 * well would leave zero candidates during almost every gap — defeating the point of having one.
 */
async function fetchLinksFromGitHub(): Promise<DesktopDownloadLinks> {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "djcloud-website",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `GitHub releases request failed: ${response.status} ${response.statusText} ` +
      `(rate-limit remaining: ${response.headers.get("x-ratelimit-remaining") ?? "unknown"}, ` +
      `resets at: ${response.headers.get("x-ratelimit-reset") ?? "unknown"})`
    );
  }

  const releases: GitHubRelease[] = await response.json();
  const published = releases.filter((r) => !r.draft && hasBothInstallers(r));
  const release = published.find((r) => !r.prerelease) ?? published[0];

  if (!release) {
    throw new Error("No published GitHub release with both installers found");
  }

  const windows = release.assets.find((asset) => asset.name.endsWith(WINDOWS_SUFFIX));
  const macos = release.assets.find((asset) => asset.name.endsWith(MACOS_SUFFIX));

  return {
    version: release.tag_name ?? null,
    windows: windows?.browser_download_url ?? null,
    macos: macos?.browser_download_url ?? null,
  };
}

// On failure, serves the last known-good links instead of nulling out working buttons — a
// transient GitHub hiccup or rate-limit shouldn't take down the download links. `fetchedAt` is
// deliberately not bumped here, so the next request retries GitHub instead of pinning a stale
// result for a full TTL window.
async function refresh(): Promise<DesktopDownloadLinks> {
  try {
    const data = await fetchLinksFromGitHub();
    cache = { data, fetchedAt: Date.now() };
    return data;
  } catch (err) {
    console.error("[desktop-download] Failed to refresh links from GitHub:", err);
    return cache?.data ?? EMPTY_LINKS;
  }
}

export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) {
    return NextResponse.json<DesktopDownloadLinks>(cache.data);
  }

  // De-dupes concurrent cache-miss requests (e.g. a burst of visitors right after a redeploy, or
  // right when the TTL expires) into a single upstream GitHub call instead of one per visitor.
  if (!inFlight) {
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
  }

  const data = await inFlight;
  return NextResponse.json<DesktopDownloadLinks>(data, { status: data === EMPTY_LINKS ? 502 : 200 });
}
