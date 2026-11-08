// The mini player at the bottom of the panel (stage 10), like Arc's: leave a tab where a video
// is playing, and the video goes on showing here. Click it to go back to the tab. Off by
// default; turning it on asks to read pages (to find the video in the tab you leave).
//
// How: on leaving a tab the panel puts mini-player-source.js into it; if a video plays there,
// the page sends its picture over a local WebRTC connection (no server, nothing leaves the
// computer). Sound stays in the tab. The player is as wide as the panel and keeps the video's
// proportions, so it grows when the panel is made wider; the page is told the new width and
// sends a sharper picture.

import {
  MINI_PLAYER_KEY,
  MINI_PLAYER_ORIGINS,
  MINI_PLAYER_PORT,
  canInject,
  pickFrame,
  onSelected,
  formatTime,
} from './lib/mini-player.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FIRST_FRAME_MS = 4000; // no picture by then — the page can't share this video
const SKIP_SECONDS = 10;

const ICONS = {
  play: 'M5 3.5v9l7.5-4.5z',
  pause: 'M4.5 3.5h2.5v9H4.5zM9 3.5h2.5v9H9z',
  back: 'M7.5 4 3.5 8l4 4M3.5 8h9',
  close: 'M4 4l8 8M12 4 4 12',
  soundOn: 'M2.5 6.25h2.25L8 3.5v9L4.75 9.75H2.5zM10.5 6.25a2.5 2.5 0 0 1 0 3.5M12.25 4.5a5 5 0 0 1 0 7',
  soundOff: 'M2.5 6.25h2.25L8 3.5v9L4.75 9.75H2.5zM10.5 6.5l3 3M13.5 6.5l-3 3',
  rewind: 'M7.5 4.5 3.5 8l4 3.5zM12.5 4.5 8.5 8l4 3.5z',
  forward: 'M3.5 4.5 7.5 8l-4 3.5zM8.5 4.5 12.5 8l-4 3.5z',
};

function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function button(className, label, iconName) {
  const node = el('button', `mini-player-button ${className}`);
  node.type = 'button';
  node.title = label;
  node.setAttribute('aria-label', label);
  node.append(icon(iconName));
  return node;
}

// S — the panel's texts (S.miniPlayer); before — the element the player goes above.
export function setUpMiniPlayer({ S, before }) {
  const T = S.miniPlayer;

  // ---------- Elements

  const root = el('section', 'mini-player');
  root.hidden = true;
  root.setAttribute('aria-label', T.label);

  const screen = el('div', 'mini-player-screen');
  screen.title = T.back;
  const video = el('video');
  video.muted = true; // the sound plays in the tab
  video.autoplay = true;
  video.playsInline = true;
  video.disablePictureInPicture = true;

  const controls = el('div', 'mini-player-controls');
  const rewindEl = button('is-skip', T.rewind, 'rewind');
  const playEl = button('is-play', T.pause, 'pause');
  const forwardEl = button('is-skip', T.forward, 'forward');
  controls.append(rewindEl, playEl, forwardEl);

  const soundEl = button('is-corner is-sound', T.mute, 'soundOn');
  const closeEl = button('is-corner is-close', T.close, 'close');
  const timeEl = el('div', 'mini-player-time');

  const progressEl = el('div', 'mini-player-progress');
  const barEl = el('div', 'mini-player-bar');
  progressEl.append(barEl);
  progressEl.title = T.seek;

  screen.append(video, controls, soundEl, closeEl, timeEl, progressEl);

  const titleEl = el('button', 'mini-player-title');
  titleEl.type = 'button';
  titleEl.title = T.back;
  const faviconEl = el('img', 'mini-player-favicon');
  faviconEl.alt = '';
  const titleText = el('span', 'mini-player-title-text');
  titleEl.append(faviconEl, titleText);

  root.append(screen, titleEl);
  before.before(root);

  // ---------- State

  let windowId;
  let enabled = false;
  let lastActive = null; // the selected tab of this window
  let session = null; // what is shown: { tabId, port, pc, status }
  let generation = 0; // a newer start or stop cancels one under way

  const showing = () => session?.tabId ?? null;

  function stop() {
    generation++;
    if (!session) return;
    const { port, pc, timer } = session;
    session = null;
    clearTimeout(timer);
    try { port.disconnect(); } catch {}
    pc.close();
    video.srcObject = null;
    root.hidden = true;
    root.classList.remove('is-paused');
  }

  // Width in device pixels: the page sends no sharper picture than that.
  const pixelWidth = () => Math.round((screen.clientWidth || document.body.clientWidth) * devicePixelRatio);

  async function tryStart(tabId) {
    const token = ++generation;
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      return; // closed
    }
    if (!canInject(tab.url) || tab.discarded) return;

    let results = [];
    try {
      results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['mini-player-source.js'] });
    } catch (error) {
      console.debug('Mini player: no access to the tab', tabId, error);
      return;
    }
    const frame = pickFrame(results);
    if (!frame || token !== generation) return;
    if (tabId === lastActive) return; // back already
    open(tab, frame.frameId);
  }

  function open(tab, frameId) {
    stop();
    const token = generation;
    const port = chrome.tabs.connect(tab.id, { name: MINI_PLAYER_PORT, frameId });
    const pc = new RTCPeerConnection();
    const current = { tabId: tab.id, port, pc, status: null, timer: 0, shown: false };
    session = current;
    const alive = () => session === current && token === generation;

    current.timer = setTimeout(() => {
      if (alive() && !current.shown) stop(); // the page can't share this video
    }, FIRST_FRAME_MS);

    pc.ontrack = ({ track, streams }) => {
      if (!alive()) return;
      video.srcObject = streams[0] ?? new MediaStream([track]);
      video.play().catch(() => {});
    };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && alive()) post({ type: 'candidate', candidate: candidate.toJSON() });
    };

    function post(message) {
      try { port.postMessage(message); } catch {}
    }
    current.post = post;

    port.onMessage.addListener(async (message) => {
      if (!alive()) return;
      try {
        switch (message?.type) {
          case 'offer':
            await pc.setRemoteDescription(message.sdp);
            await pc.setLocalDescription(await pc.createAnswer());
            post({ type: 'answer', sdp: pc.localDescription.toJSON() });
            break;
          case 'candidate':
            await pc.addIceCandidate(message.candidate);
            break;
          case 'status':
            current.status = message;
            applyStatus();
            break;
          case 'gone':
          case 'unsupported':
            stop();
            break;
        }
      } catch (error) {
        console.debug('Mini player:', error);
      }
    });
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError; // the tab navigated away or closed
      if (session === current) stop();
    });

    applyTab(tab);
    post({ type: 'start', width: pixelWidth() });
  }

  // The first picture: the player appears.
  video.addEventListener('loadeddata', () => {
    if (!session || session.shown) return;
    session.shown = true;
    clearTimeout(session.timer);
    root.hidden = false;
    session.post({ type: 'width', width: pixelWidth() });
  });

  // ---------- Showing

  function applyStatus() {
    const status = session?.status;
    if (!status) return;
    const paused = status.paused || status.ended;
    root.classList.toggle('is-paused', paused);
    playEl.replaceChildren(icon(paused ? 'play' : 'pause'));
    playEl.title = paused ? T.play : T.pause;
    playEl.setAttribute('aria-label', playEl.title);
    if (status.videoWidth && status.videoHeight) {
      screen.style.aspectRatio = `${status.videoWidth} / ${status.videoHeight}`;
    }
    const live = status.duration === null;
    progressEl.hidden = live;
    rewindEl.hidden = live;
    forwardEl.hidden = live;
    barEl.style.width = live ? '0' : `${Math.min(100, (status.currentTime / status.duration) * 100)}%`;
    timeEl.textContent = live ? T.live : `${formatTime(status.currentTime)} / ${formatTime(status.duration)}`;
  }

  function applyTab(tab) {
    titleText.textContent = tab.title || tab.url;
    faviconEl.hidden = !tab.favIconUrl;
    if (tab.favIconUrl) faviconEl.src = tab.favIconUrl;
    const muted = Boolean(tab.mutedInfo?.muted);
    soundEl.replaceChildren(icon(muted ? 'soundOff' : 'soundOn'));
    soundEl.title = muted ? T.unmute : T.mute;
    soundEl.setAttribute('aria-label', soundEl.title);
    soundEl.dataset.muted = String(muted);
  }

  // The player is as wide as the panel: a wider panel asks for a sharper picture.
  let widthTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(widthTimer);
    widthTimer = setTimeout(() => session?.post?.({ type: 'width', width: pixelWidth() }), 150);
  }).observe(screen);

  // ---------- Controls

  function backToTab() {
    const tabId = showing();
    if (tabId === null) return;
    chrome.tabs.update(tabId, { active: true })
      .then((tab) => tab && tab.windowId !== windowId && chrome.windows.update(tab.windowId, { focused: true }))
      .catch((error) => console.error('Failed to go back to the tab', tabId, error));
  }

  screen.addEventListener('click', (event) => {
    if (event.target.closest('button, .mini-player-progress')) return;
    backToTab();
  });
  titleEl.addEventListener('click', backToTab);
  closeEl.addEventListener('click', stop);
  playEl.addEventListener('click', () => {
    const status = session?.status;
    session?.post({ type: status?.paused || status?.ended ? 'play' : 'pause' });
  });
  rewindEl.addEventListener('click', () => session?.post({ type: 'skip', seconds: -SKIP_SECONDS }));
  forwardEl.addEventListener('click', () => session?.post({ type: 'skip', seconds: SKIP_SECONDS }));
  soundEl.addEventListener('click', () => {
    const tabId = showing();
    if (tabId === null) return;
    chrome.tabs.update(tabId, { muted: soundEl.dataset.muted !== 'true' })
      .catch((error) => console.error('Failed to mute or unmute', tabId, error));
  });
  progressEl.addEventListener('click', (event) => {
    const rect = progressEl.getBoundingClientRect();
    session?.post({ type: 'seek', fraction: (event.clientX - rect.left) / rect.width });
  });

  // ---------- Tabs

  chrome.tabs.onActivated.addListener(({ tabId, windowId: inWindow }) => {
    if (inWindow !== windowId) return;
    const previous = lastActive;
    lastActive = tabId;
    const action = onSelected({ selected: tabId, previous, showing: showing(), enabled });
    if (action === 'stop') stop();
    else if (action === 'start') tryStart(previous);
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === showing()) stop();
    if (tabId === lastActive) lastActive = null;
  });
  chrome.tabs.onReplaced.addListener((added, removed) => {
    if (removed === showing()) stop();
    if (removed === lastActive) lastActive = added;
  });
  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (tabId === showing() && ('title' in info || 'favIconUrl' in info || 'mutedInfo' in info)) applyTab(tab);
  });

  // ---------- On and off

  const hasAccess = () => chrome.permissions.contains({ origins: MINI_PLAYER_ORIGINS });

  async function refreshEnabled() {
    const { [MINI_PLAYER_KEY]: on } = await chrome.storage.local.get(MINI_PLAYER_KEY);
    enabled = on === true && (await hasAccess());
    if (!enabled) stop();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && MINI_PLAYER_KEY in changes) refreshEnabled().catch(() => {});
  });
  chrome.permissions.onRemoved.addListener(() => refreshEnabled().catch(() => {}));
  chrome.permissions.onAdded.addListener(() => refreshEnabled().catch(() => {}));

  (async () => {
    windowId = (await chrome.windows.getCurrent()).id;
    const [active] = await chrome.tabs.query({ active: true, windowId });
    if (lastActive === null) lastActive = active?.id ?? null;
    await refreshEnabled();
  })().catch((error) => console.error('Failed to start the mini player', error));

  return {
    isEnabled: () => enabled,
    // From a click (the menu): the permission prompt needs it, so it is asked at once.
    turnOn() {
      return chrome.permissions.request({ origins: MINI_PLAYER_ORIGINS })
        .then((granted) => granted && chrome.storage.local.set({ [MINI_PLAYER_KEY]: true }))
        .catch((error) => console.error('Failed to turn on the mini player', error));
    },
    turnOff() {
      stop();
      enabled = false;
      return chrome.storage.local.set({ [MINI_PLAYER_KEY]: false })
        .then(() => chrome.permissions.remove({ origins: MINI_PLAYER_ORIGINS }))
        .catch((error) => console.error('Failed to turn off the mini player', error));
    },
  };
}
