// The mini player's other end, in the page (stage 10). The panel injects this file into the tab
// you leave (chrome.scripting.executeScript, every frame) and gets back what it found there; if
// a video is playing, the panel connects to this frame and the video's picture is sent to the
// panel over a local WebRTC connection (video.captureStream). Sound keeps playing in the tab,
// the video keeps playing in the page: the panel only shows it and sends play / pause / seek.
//
// Sites swap their video element now and then (an ad, the next episode, a quality change): the
// connection follows the new one by itself, so the player in the panel doesn't go away.
//
// Injected again every time you leave the tab: the second time only answers the probe.
// The last expression of the file is what executeScript returns.

(() => {
  const PORT_NAME = 'tabbs-mini-player'; // lib/mini-player.js MINI_PLAYER_PORT
  const MIN_W = 200; // smaller videos are previews and ads, not what you were watching
  const MIN_H = 112;
  const STATUS_EVERY_MS = 500;
  const FOLLOW_EVERY_MS = 1000;

  const isPlaying = (video) => !video.paused && !video.ended && video.readyState >= 2;

  function area(video) {
    if (!video.isConnected) return 0;
    const rect = video.getBoundingClientRect();
    return rect.width >= MIN_W && rect.height >= MIN_H ? rect.width * rect.height : 0;
  }

  // The video you were watching: the largest playing one; not a muted looping background.
  // any: a paused one will do too (the page has just reloaded, say), playing ones first.
  function pick(any = false) {
    let best = null;
    let bestScore = 0;
    for (const video of document.querySelectorAll('video')) {
      if (video.muted && video.loop) continue;
      const playing = isPlaying(video);
      if (!playing && !(any && video.readyState >= 1)) continue;
      const size = area(video);
      if (!size) continue;
      const score = size * (playing ? 4 : 1);
      if (score > bestScore) {
        best = video;
        bestScore = score;
      }
    }
    return best;
  }

  if (!globalThis.__tabbsMiniPlayer) {
    let chosen = null; // WeakRef of the video found by the last probe

    function connect(port) {
      let video = chosen?.deref();
      if (!video || !video.isConnected) video = pick(true);
      if (!video) {
        port.postMessage({ type: 'gone' });
        port.disconnect();
        return;
      }

      const pc = new RTCPeerConnection();
      let sender = null;
      let stream = null;
      let width = 0; // what the panel shows, in device pixels: sent no larger
      let closed = false;

      async function fitSize() {
        if (!sender || !width || !video.videoWidth) return;
        const parameters = sender.getParameters();
        if (!parameters.encodings?.length) return;
        parameters.encodings[0].scaleResolutionDownBy = Math.max(1, video.videoWidth / width);
        parameters.encodings[0].maxBitrate = 4_000_000;
        parameters.degradationPreference = 'maintain-framerate';
        await sender.setParameters(parameters).catch(() => {});
      }

      function sendTrack() {
        const track = stream?.getVideoTracks()[0];
        if (!track) return;
        if (sender) sender.replaceTrack(track).catch(() => {});
        else sender = pc.addTrack(track);
        fitSize();
      }

      let lastStatus = 0;
      function status(force = false) {
        const now = Date.now();
        if (closed || (!force && now - lastStatus < STATUS_EVERY_MS)) return;
        lastStatus = now;
        try {
          port.postMessage({
            type: 'status',
            paused: video.paused,
            ended: video.ended,
            currentTime: video.currentTime,
            duration: Number.isFinite(video.duration) ? video.duration : null,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
          });
        } catch {}
      }
      const onTime = () => status();
      const onState = () => {
        status(true);
        fitSize();
      };
      const EVENTS = ['play', 'playing', 'pause', 'ended', 'seeked', 'loadedmetadata', 'resize', 'durationchange'];

      function release() {
        video.removeEventListener('timeupdate', onTime);
        for (const name of EVENTS) video.removeEventListener(name, onState);
        if (stream) {
          stream.removeEventListener('addtrack', sendTrack);
          // Stopping the copies doesn't stop the video itself.
          for (const track of stream.getTracks()) track.stop();
        }
        stream = null;
      }

      // Capture `next` and send it in place of what was sent: the connection stays.
      function bind(next) {
        let nextStream;
        try {
          nextStream = next.captureStream();
        } catch (error) {
          return false; // DRM or another site's video without permission
        }
        release();
        video = next;
        stream = nextStream;
        stream.addEventListener('addtrack', sendTrack); // a new source brings a new track
        video.addEventListener('timeupdate', onTime);
        for (const name of EVENTS) video.addEventListener(name, onState);
        sendTrack();
        status(true);
        return true;
      }

      if (!bind(video)) {
        port.postMessage({ type: 'unsupported' });
        port.disconnect();
        pc.close();
        return;
      }

      // The page swapped its video: the one shown is gone or stopped while another one plays.
      function follow() {
        if (closed) return;
        if (video.isConnected && isPlaying(video)) return;
        const next = pick(!video.isConnected);
        if (next && next !== video) bind(next);
      }
      const followTimer = setInterval(follow, FOLLOW_EVERY_MS);
      const onAnyPlay = (event) => {
        if (event.target instanceof HTMLVideoElement && event.target !== video) follow();
      };
      document.addEventListener('playing', onAnyPlay, true); // media events don't bubble, but are captured

      pc.onicecandidate = ({ candidate }) => {
        if (candidate && !closed) {
          try { port.postMessage({ type: 'candidate', candidate: candidate.toJSON() }); } catch {}
        }
      };

      port.onMessage.addListener(async (message) => {
        try {
          switch (message?.type) {
            case 'start': {
              width = Number(message.width) || 0;
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              port.postMessage({ type: 'offer', sdp: pc.localDescription.toJSON() });
              status(true);
              break;
            }
            case 'answer':
              await pc.setRemoteDescription(message.sdp);
              fitSize();
              break;
            case 'candidate':
              await pc.addIceCandidate(message.candidate);
              break;
            case 'width':
              width = Number(message.width) || 0;
              fitSize();
              break;
            case 'play':
              await video.play();
              break;
            case 'pause':
              video.pause();
              break;
            case 'seek':
              if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(1, message.fraction)) * video.duration;
              break;
            case 'skip':
              video.currentTime = Math.max(0, video.currentTime + Number(message.seconds || 0));
              break;
          }
        } catch (error) {
          console.debug('Tabbs mini player:', error);
        }
      });

      port.onDisconnect.addListener(() => {
        closed = true;
        clearInterval(followTimer);
        document.removeEventListener('playing', onAnyPlay, true);
        release();
        pc.close();
      });
    }

    globalThis.__tabbsMiniPlayer = {
      probe(any = false) {
        const video = pick(any);
        chosen = video ? new WeakRef(video) : null;
        return {
          found: Boolean(video),
          playing: Boolean(video && isPlaying(video)),
          area: video ? area(video) : 0,
          muted: Boolean(video?.muted),
        };
      },
    };

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === PORT_NAME) connect(port);
    });
  }

  return globalThis.__tabbsMiniPlayer.probe();
})();
