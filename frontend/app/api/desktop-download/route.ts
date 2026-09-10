import { NextResponse } from "next/server";

const REPO = "TeeeTime/DJ-Cloud";
const WINDOWS_SUFFIX = "-setup.exe";
const MACOS_SUFFIX = ".dmg";

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

function hasBothInstallers(release: GitHubRelease): boolean {
  const assets = release.assets ?? [];
  return assets.some((a) => a.name.endsWith(WINDOWS_SUFFIX)) && assets.some((a) => a.name.endsWith(MACOS_SUFFIX));
}

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
export async function GET() {
  const response = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "djcloud-website",
    },
    // Short enough that a release which was mid-upload stops being served within a few minutes of
    // finishing, rather than the hour a longer window would otherwise pin a stale/incomplete
    // result for — this single server-side fetch is shared across all visitors either way, so it
    // stays comfortably under GitHub's unauthenticated rate limit even at this interval.
    next: { revalidate: 120 },
  });

  if (!response.ok) {
    return NextResponse.json<DesktopDownloadLinks>({ version: null, windows: null, macos: null }, { status: 502 });
  }

  const releases: GitHubRelease[] = await response.json();
  const published = releases.filter((r) => !r.draft && hasBothInstallers(r));
  const release = published.find((r) => !r.prerelease) ?? published[0];

  if (!release) {
    return NextResponse.json<DesktopDownloadLinks>({ version: null, windows: null, macos: null });
  }

  const windows = release.assets.find((asset) => asset.name.endsWith(WINDOWS_SUFFIX));
  const macos = release.assets.find((asset) => asset.name.endsWith(MACOS_SUFFIX));

  return NextResponse.json<DesktopDownloadLinks>({
    version: release.tag_name ?? null,
    windows: windows?.browser_download_url ?? null,
    macos: macos?.browser_download_url ?? null,
  });
}
