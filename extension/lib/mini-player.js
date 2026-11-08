// The mini player's decisions (stage 10), no chrome.* calls. See mini-player.js.

export const MINI_PLAYER_KEY = 'miniPlayer'; // storage.local: true when it is on
export const MINI_PLAYER_ORIGINS = ['<all_urls>']; // asked for when it is turned on
export const MINI_PLAYER_PORT = 'tabbs-mini-player';

// Pages a script can be put into: not the browser's own pages, the web store or PDFs.
export function canInject(url) {
  if (typeof url !== 'string' || !/^(https?|file):/.test(url)) return false;
  return !/^https:\/\/(chrome\.google\.com\/webstore|chromewebstore\.google\.com)\//.test(url);
}

// executeScript results, one per frame: the frame whose playing video is the largest.
export function pickFrame(results) {
  let best = null;
  for (const entry of results ?? []) {
    const found = entry?.result;
    if (!found?.playing) continue;
    if (!best || found.area > best.area) best = { frameId: entry.frameId ?? 0, area: found.area };
  }
  return best;
}

// A tab of the panel's window was selected: what the mini player does.
//   'stop'  — the tab it shows came back to the front
//   'start' — try the tab just left (previous)
//   'keep'  — nothing changes
export function onSelected({ selected, previous, showing, enabled }) {
  if (showing !== null && selected === showing) return 'stop';
  if (!enabled || previous === null || previous === selected || previous === showing) return 'keep';
  return 'start';
}

// "1:05", "1:02:09".
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}
