import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canInject, pickFrame, onSelected, formatTime, reconnectDelay, isPlayingStatus } from '../extension/lib/mini-player.js';

test('canInject: web pages only', () => {
  assert.ok(canInject('https://www.youtube.com/watch?v=1'));
  assert.ok(canInject('http://localhost:8000/'));
  for (const url of ['chrome://settings', 'helium://extensions', 'chrome-extension://x/sidepanel.html', 'https://chromewebstore.google.com/detail/x', 'about:blank', undefined]) {
    assert.equal(canInject(url), false, String(url));
  }
});

test('pickFrame: playing first, then the largest; paused only when asked', () => {
  assert.equal(pickFrame([]), null);
  assert.equal(pickFrame([{ frameId: 0, result: { found: false, playing: false, area: 0 } }]), null);
  assert.deepEqual(pickFrame([
    { frameId: 0, result: { found: true, playing: true, area: 100 } },
    { frameId: 3, result: { found: true, playing: true, area: 900 } },
    { frameId: 5, result: null },
  ]), { frameId: 3, area: 900, playing: true });
  const paused = [{ frameId: 2, result: { found: true, playing: false, area: 500 } }];
  assert.equal(pickFrame(paused), null);
  assert.equal(pickFrame(paused, { any: true }).frameId, 2);
  assert.equal(pickFrame([
    { frameId: 1, result: { found: true, playing: false, area: 900 } },
    { frameId: 4, result: { found: true, playing: true, area: 300 } },
  ], { any: true }).frameId, 4);
});

test('pickFrame withSound: a muted preview does not count', () => {
  const muted = [{ frameId: 0, result: { found: true, playing: true, area: 900, muted: true } }];
  assert.equal(pickFrame(muted, { withSound: true }), null);
  assert.equal(pickFrame(muted).frameId, 0);
});

test('onSelected: a playing video is never replaced; coming back stops it', () => {
  assert.equal(onSelected({ selected: 2, previous: 1, showing: null, enabled: true }), 'probe');
  assert.equal(onSelected({ selected: 2, previous: 1, showing: null, enabled: false }), 'keep');
  assert.equal(onSelected({ selected: 1, previous: 2, showing: 1, enabled: true }), 'stop');
  assert.equal(onSelected({ selected: 1, previous: 2, showing: 1, enabled: false }), 'stop');
  assert.equal(onSelected({ selected: 3, previous: 2, showing: 1, showingPlaying: true, enabled: true }), 'keep');
  assert.equal(onSelected({ selected: 3, previous: 2, showing: 1, showingPlaying: false, enabled: true }), 'probe');
  assert.equal(onSelected({ selected: 3, previous: 1, showing: 1, enabled: true }), 'keep');
  assert.equal(onSelected({ selected: 3, previous: null, showing: null, enabled: true }), 'keep');
});

test('reconnectDelay: quick at first, then steady', () => {
  assert.equal(reconnectDelay(0), 300);
  assert.equal(reconnectDelay(4), 5000);
  assert.equal(reconnectDelay(40), 5000);
  assert.ok(isPlayingStatus({ paused: false, ended: false }));
  assert.ok(!isPlayingStatus({ paused: true, ended: false }));
  assert.ok(!isPlayingStatus(null));
});

test('formatTime', () => {
  assert.equal(formatTime(65), '1:05');
  assert.equal(formatTime(3729), '1:02:09');
  assert.equal(formatTime(NaN), '');
});
