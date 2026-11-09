// The mini player at the bottom of the panel (stage 10), like Arc's: leave a tab where a video
// is playing, and the video goes on showing here. Click it to go back to the tab. Off by
// default; turning it on asks to read pages (to find the video in the tab you leave).
//
// How: on leaving a tab the panel puts mini-player-source.js into it; if a video plays there,
// the page sends its picture over a local WebRTC connection (no server, nothing leaves the
// computer). Sound stays in the tab. The player is as wide as the panel and keeps the video's
// proportions, so it grows when the panel is made wider; the page is told the new width and
// sends a sharper picture.
//
// It stays as long as the video is in its tab: it goes away when you come back to that tab,
// close it or click ×. Another tab's video never takes the place of one that is playing. When
// the connection drops (the page reloaded or swapped its video, the browser hiccuped), the last
// picture stays and the panel connects again by itself; only a tab with no video left loses it.

import {
  MINI_PLAYER_KEY,
  MINI_PLAYER_ORIGINS,
  MINI_PLAYER_PORT,
  GIVE_UP_AFTER_MS,
  canInject,
  pickFrame,
  onSelected,
  isPlayingStatus,
  reconnectDelay,
  formatTime,
} from './lib/mini-player.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FIRST_FRAME_MS = 8000; // no picture by then — the page can't share this video
const DISCONNECTED_GRACE_MS = 3000; // WebRTC often comes back from "disconnected" by itself
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

// S — the panel's texts (S.miniPlayer); before — the element the player goes above;
// onResize(grownBy) — the player appeared, went or changed height (the list above got shorter or taller).
export function setUpMiniPlayer({ S, before, onResize = () => {} }) {
  const T = S.miniPlayer;

  // ---------- Elements

  const root = el('section', 'mini-player');
  root.hidden = true;
  root.setAttribute('aria-label', T.label);

  const screen = el('div', 'mini-player-screen');
  screen.title = T.back;
  // While the panel connects again: the last picture, so the player doesn't go blank.
  const freezeEl = el('canvas', 'mini-player-freeze');
  freezeEl.hidden = true;

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

  screen.append(freezeEl, controls, soundEl, closeEl, timeEl, progressEl);

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

  // What is shown: { tabId, conn, status, lostAt, retry, retryTimer } — conn null while it
  // connects again. A connection: { tabId, port, pc, video, shown, post, close }.
  let session = null;
  let pending = null; // a connection to another tab's video, until its first picture
  let probeToken = 0; // a newer look into a tab cancels one under way

  const showing = () => session?.tabId ?? null;

  function newVideo() {
    const video = el('video', 'is-pending');
    video.muted = true; // the sound plays in the tab
    video.autoplay = true;
    video.playsInline = true;
    video.disablePictureInPicture = true;
    screen.prepend(video);
    return video;
  }

  // Width in device pixels: the page sends no sharper picture than that.
  const pixelWidth = () => Math.round((screen.clientWidth || document.body.clientWidth) * devicePixelRatio);

  // A connection to the video in a frame of a tab. onFirst — its first picture came;
  // onLost — it couldn't start or it broke.
  function connectTo(tabId, frameId, { onFirst, onLost }) {
    const port = chrome.tabs.connect(tabId, { name: MINI_PLAYER_PORT, frameId });
    const pc = new RTCPeerConnection();
    const video = newVideo();
    const conn = { tabId, port, pc, video, shown: false, closed: false };
    let graceTimer = 0;

    const post = (message) => {
      if (conn.closed) return;
      try { port.postMessage(message); } catch {}
    };
    conn.post = post;
    conn.close = () => {
      if (conn.closed) return;
      conn.closed = true;
      clearTimeout(firstTimer);
      clearTimeout(graceTimer);
      try { port.disconnect(); } catch {}
      pc.close();
      video.srcObject = null;
      video.remove();
    };
    const lost = (why) => {
      if (conn.closed) return;
      console.debug('Mini player: connection lost', tabId, why);
      const wasShown = conn.shown;
      onLost(conn, wasShown);
    };

    const firstTimer = setTimeout(() => {
      if (!conn.shown) lost('no picture');
    }, FIRST_FRAME_MS);

    pc.ontrack = ({ track, streams }) => {
      if (conn.closed) return;
      video.srcObject = streams[0] ?? new MediaStream([track]);
      video.play().catch(() => {});
    };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) post({ type: 'candidate', candidate: candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      clearTimeout(graceTimer);
      if (pc.connectionState === 'failed') lost('failed');
      else if (pc.connectionState === 'disconnected') {
        graceTimer = setTimeout(() => pc.connectionState !== 'connected' && lost('disconnected'), DISCONNECTED_GRACE_MS);
      }
    };
    video.addEventListener('loadeddata', () => {
      if (conn.closed || conn.shown) return;
      conn.shown = true;
      clearTimeout(firstTimer);
      onFirst(conn);
    });

    port.onMessage.addListener(async (message) => {
      if (conn.closed) return;
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
            conn.status = message;
            if (session?.conn === conn) {
              session.status = message;
              applyStatus();
            }
            break;
          case 'gone':
          case 'unsupported':
            lost(message.type);
            break;
        }
      } catch (error) {
        console.debug('Mini player:', error);
      }
    });
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError; // the page reloaded, went away or the tab closed
      lost('port');
    });

    post({ type: 'start', width: pixelWidth() });
    return conn;
  }

  // The connection's picture becomes the one shown.
  function showConn(conn) {
    for (const old of screen.querySelectorAll('video')) {
      if (old !== conn.video) old.classList.add('is-pending');
    }
    conn.video.classList.remove('is-pending');
    freezeEl.hidden = true;
    root.hidden = false;
    conn.post({ type: 'width', width: pixelWidth() });
  }

  function stop() {
    probeToken++;
    pending?.close();
    pending = null;
    if (session) {
      clearTimeout(session.retryTimer);
      session.conn?.close();
      session = null;
    }
    freezeEl.hidden = true;
    root.hidden = true;
    root.classList.remove('is-paused');
  }

  // A video found in a tab you left: shown once its first picture comes. Until then what is
  // shown stays (if anything); if it never comes, nothing changes.
  function offer(tab, frameId) {
    pending?.close();
    const conn = connectTo(tab.id, frameId, {
      onFirst(conn) {
        if (pending !== conn) return conn.close();
        pending = null;
        if (tab.id === lastActive) return conn.close(); // you came back meanwhile
        if (session) {
          clearTimeout(session.retryTimer);
          session.conn?.close();
        }
        session = { tabId: tab.id, conn, status: conn.status ?? null, lostAt: 0, retry: 0, retryTimer: 0 };
        applyTab(tab);
        applyStatus();
        showConn(conn);
      },
      onLost(conn, wasShown) {
        if (session?.conn === conn) sessionLost(wasShown);
        else conn.close();
        if (pending === conn) pending = null;
      },
    });
    pending = conn;
  }

  // The shown video's connection broke: keep its last picture and get it back.
  function sessionLost() {
    const conn = session.conn;
    freeze(conn.video);
    conn.close();
    session.conn = null;
    if (!session.lostAt) session.lostAt = Date.now();
    session.retry = 0;
    scheduleReconnect();
  }

  function freeze(video) {
    if (!video?.videoWidth) return;
    freezeEl.width = video.videoWidth;
    freezeEl.height = video.videoHeight;
    try {
      freezeEl.getContext('2d').drawImage(video, 0, 0);
      freezeEl.hidden = false;
    } catch {}
  }

  function scheduleReconnect(delay = reconnectDelay(session.retry)) {
    clearTimeout(session.retryTimer);
    const current = session;
    current.retryTimer = setTimeout(() => reconnect(current), delay);
  }

  async function reconnect(current) {
    if (session !== current || current.conn) return;
    let tab;
    try {
      tab = await chrome.tabs.get(current.tabId);
    } catch {
      if (session === current) stop(); // closed
      return;
    }
    if (session !== current) return;
    if (tab.active && tab.windowId === windowId) return stop(); // you're back in it
    const frame = tab.discarded || !canInject(tab.url) ? null : await findVideo(tab.id, { any: true });
    if (session !== current || current.conn) return;
    if (!frame) {
      // No video there (yet): the page may still be loading. Only a tab that stays without one loses the player.
      if (Date.now() - current.lostAt > GIVE_UP_AFTER_MS) return stop();
      current.retry++;
      return scheduleReconnect();
    }
    current.conn = connectTo(tab.id, frame.frameId, {
      onFirst(conn) {
        if (session !== current || current.conn !== conn) return conn.close();
        current.lostAt = 0;
        current.retry = 0;
        current.status = conn.status ?? current.status;
        applyTab(tab);
        applyStatus();
        showConn(conn);
      },
      onLost(conn) {
        conn.close();
        if (session !== current || current.conn !== conn) return;
        current.conn = null;
        if (Date.now() - current.lostAt > GIVE_UP_AFTER_MS) return stop();
        current.retry++;
        scheduleReconnect();
      },
    });
  }

  // The frame of the tab with the best video, or null. any: a paused one will do.
  async function findVideo(tabId, { any = false, withSound = false } = {}) {
    try {
      let results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['mini-player-source.js'] });
      if (any) {
        results = await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          func: () => globalThis.__tabbsMiniPlayer?.probe(true) ?? null,
        });
      }
      return pickFrame(results, { any, withSound });
    } catch (error) {
      console.debug('Mini player: no access to the tab', tabId, error);
      return null;
    }
  }

  // You left a tab: is a video playing there?
  async function probe(tabId) {
    const token = ++probeToken;
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      return; // closed
    }
    if (!canInject(tab.url) || tab.discarded) return;
    // A paused video shown may give its place only to one with sound, not to a muted preview.
    const frame = await findVideo(tabId, { withSound: session !== null });
    if (!frame || token !== probeToken || tabId === lastActive) return;
    if (session && isPlayingStatus(session.status)) return; // it started playing again meanwhile
    offer(tab, frame.frameId);
  }

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

  // The list above gets shorter as the player appears or grows: the panel keeps the selected tab in view.
  let height = 0;
  new ResizeObserver(() => {
    const next = root.hidden ? 0 : root.offsetHeight;
    if (next === height) return;
    const grownBy = next - height;
    height = next;
    onResize(grownBy);
  }).observe(root);

  // The player is as wide as the panel: a wider panel asks for a sharper picture.
  let widthTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(widthTimer);
    widthTimer = setTimeout(() => session?.conn?.post({ type: 'width', width: pixelWidth() }), 150);
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
    session?.conn?.post({ type: isPlayingStatus(session.status) ? 'pause' : 'play' });
  });
  rewindEl.addEventListener('click', () => session?.conn?.post({ type: 'skip', seconds: -SKIP_SECONDS }));
  forwardEl.addEventListener('click', () => session?.conn?.post({ type: 'skip', seconds: SKIP_SECONDS }));
  soundEl.addEventListener('click', () => {
    const tabId = showing();
    if (tabId === null) return;
    chrome.tabs.update(tabId, { muted: soundEl.dataset.muted !== 'true' })
      .catch((error) => console.error('Failed to mute or unmute', tabId, error));
  });
  progressEl.addEventListener('click', (event) => {
    const rect = progressEl.getBoundingClientRect();
    session?.conn?.post({ type: 'seek', fraction: (event.clientX - rect.left) / rect.width });
  });

  // ---------- Tabs

  chrome.tabs.onActivated.addListener(({ tabId, windowId: inWindow }) => {
    if (pending?.tabId === tabId) {
      pending.close();
      pending = null;
    }
    if (tabId === showing()) {
      stop(); // back in the video's tab (in this window or another)
      if (inWindow === windowId) lastActive = tabId;
      return;
    }
    if (inWindow !== windowId) return;
    const previous = lastActive;
    lastActive = tabId;
    const action = onSelected({ selected: tabId, previous, showing: showing(), showingPlaying: isPlayingStatus(session?.status), enabled });
    if (action === 'probe') probe(previous);
  });
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === showing()) stop();
    if (pending?.tabId === tabId) {
      pending.close();
      pending = null;
    }
    if (tabId === lastActive) lastActive = null;
  });
  chrome.tabs.onReplaced.addListener((added, removed) => {
    if (removed === lastActive) lastActive = added;
    if (session?.tabId === removed) {
      // Same page under a new id (prerendering, a restored tab): follow it.
      session.tabId = added;
      session.conn?.close();
      session.conn = null;
      if (!session.lostAt) session.lostAt = Date.now();
      scheduleReconnect(0);
    }
  });
  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (tabId !== showing()) return;
    if ('title' in info || 'favIconUrl' in info || 'mutedInfo' in info) applyTab(tab);
    if (info.status === 'complete' && !session.conn) scheduleReconnect(0); // reloaded: try at once
    if (info.discarded) stop(); // the browser unloaded the tab: no video left
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
    height: () => height,
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
