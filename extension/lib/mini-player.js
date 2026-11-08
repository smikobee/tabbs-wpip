// The mini player's decisions (stage 10), no chrome.* calls. See mini-player.js.

export const MINI_PLAYER_KEY = 'miniPlayer'; // storage.local: true when it is on
export const MINI_PLAYER_ORIGINS = ['<all_urls>']; // asked for when it is turned on
export const MINI_PLAYER_PORT = 'tabbs-mini-player';

// Waits between attempts to get a lost video back, then the last one repeats; how long to keep
// trying when the tab has no video at all any more.
export const RECONNECT_DELAYS_MS = [300, 1000, 2000, 3000, 5000];
export const GIVE_UP_AFTER_MS = 45_000;

// Pages a script can be put into: not the browser's own pages, the web store or PDFs.
export function canInject(url) {
  if (typeof url !== 'string' || !/^(https?|file):/.test(url)) return false;
  return !/^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com)\//.test(url);
}

// executeScript results, one per frame: the frame with the best video. Playing ones first, then
// the largest. any: a paused video will do (getting a lost one back); withSound: only a video
// that isn't muted (to take the place of a paused one).
export function pickFrame(results, { any = false, withSound = false } = {}) {
  let best = null;
  let bestScore = 0;
  for (const entry of results ?? []) {
    const found = entry?.result;
    if (!found || !(found.playing || (any && found.found))) continue;
    if (withSound && found.muted) continue;
    const score = (found.area || 1) * (found.playing ? 4 : 1);
    if (score > bestScore) {
      best = { frameId: entry.frameId ?? 0, area: found.area, playing: Boolean(found.playing) };
      bestScore = score;
    }
  }
  return best;
}

// A tab of the panel's window was selected: what the mini player does.
//   'stop'  — the tab it shows came back to the front
//   'probe' — look for a video in the tab just left (previous)
//   'keep'  — nothing changes: above all, a video that is playing is never replaced by another
//             tab's (a muted preview, an ad); a paused one only by a video with sound
export function onSelected({ selected, previous, showing, showingPlaying = false, enabled }) {
  if (showing !== null && selected === showing) return 'stop';
  if (!enabled || previous === null || previous === selected || previous === showing) return 'keep';
  if (showing !== null && showingPlaying) return 'keep';
  return 'probe';
}

export const isPlayingStatus = (status) => Boolean(status) && !status.paused && !status.ended;

// The wait before attempt `n` (0-based) to get a lost video back.
export const reconnectDelay = (n) => RECONNECT_DELAYS_MS[Math.min(n, RECONNECT_DELAYS_MS.length - 1)];

// "1:05", "1:02:09".
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
