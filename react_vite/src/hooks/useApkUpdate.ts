/**
 * useApkUpdate
 *
 * Update checking for the Android build, which the web mechanism cannot do.
 *
 * useAppUpdate works by polling /version.json and reloading. Inside the APK the
 * origin is https://localhost and Capacitor serves it from the packaged assets,
 * so that file is the one built into the running APK and always matches — and
 * even if it did not, reloading re-reads the same bundled files. A packaged app
 * only changes when a new APK is installed.
 *
 * So this compares the app's own versionName against the newest GitHub release
 * and hands over the download link. It cannot install anything: sideloading is
 * the user's job, and asking for REQUEST_INSTALL_PACKAGES to automate it would
 * be a far bigger permission than a prayer-times display should hold.
 *
 * TV boxes are the reason this matters. Nobody browses to a wall-mounted
 * display, so without a prompt it sits on whatever build was sideloaded onto it
 * indefinitely.
 */
import { useCallback, useEffect, useState } from 'react';

const REPO = 'onestorefoundations-wq/azan-times';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

/** Six hours: a display is never in a hurry, and the API is rate-limited per IP. */
const POLL_MS = 6 * 60 * 60 * 1000;

export type ApkUpdateState =
  /** Web build — there is no APK to update. */
  | 'unsupported'
  | 'idle'
  | 'checking'
  | 'current'
  | 'available'
  | 'offline'
  | 'error';

export interface ApkUpdate {
  state: ApkUpdateState;
  /** versionName of the running APK, null on the web. */
  running: string | null;
  /** Tag of the newest release, once known. */
  latest: string | null;
  /** Direct APK link when the release has one, else the releases page. */
  url: string;
  check: () => void;
}

/**
 * Compares dotted numeric versions, ignoring a leading "v" and any suffix.
 * String comparison would rank 1.0.10 below 1.0.9, which is exactly the point
 * at which a release stops reaching anyone.
 */
export function isNewerVersion(latest: string, running: string): boolean {
  const parts = (v: string) =>
    v
      .replace(/^v/i, '')
      .split(/[.\-+]/)
      .map((n) => {
        const parsed = parseInt(n, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
      });

  const a = parts(latest);
  const b = parts(running);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export function useApkUpdate(): ApkUpdate {
  const running = __NATIVE_VERSION__;
  const [state, setState] = useState<ApkUpdateState>(running ? 'idle' : 'unsupported');
  const [latest, setLatest] = useState<string | null>(null);
  const [url, setUrl] = useState<string>(RELEASES_PAGE);

  const check = useCallback(() => {
    if (!running) return;
    if (!navigator.onLine) {
      setState('offline');
      return;
    }
    setState('checking');

    void (async () => {
      try {
        const res = await fetch(RELEASES_API, {
          headers: { Accept: 'application/vnd.github+json' },
          cache: 'no-store',
          signal: AbortSignal.timeout?.(10000) ?? undefined,
        });
        // An unauthenticated GitHub API call is rate-limited per IP, and a
        // display behind a shared connection can be refused through no fault of
        // its own. That is not an error worth alarming anyone about.
        if (!res.ok) {
          setState('error');
          return;
        }

        const data = (await res.json()) as {
          tag_name?: string;
          assets?: { name: string; browser_download_url: string }[];
        };
        const tag = data.tag_name ?? null;
        const apk = (data.assets ?? []).find((a) => a.name.toLowerCase().endsWith('.apk'));

        setLatest(tag);
        setUrl(apk?.browser_download_url ?? RELEASES_PAGE);
        setState(tag && isNewerVersion(tag, running) ? 'available' : 'current');
      } catch {
        setState('error');
      }
    })();
  }, [running]);

  useEffect(() => {
    if (!running) return;
    check();
    const timer = setInterval(check, POLL_MS);
    window.addEventListener('online', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', check);
    };
  }, [running, check]);

  return { state, running, latest, url, check };
}
