// The mini player's other end, in the page (stage 10). The panel injects this file into the tab
// you leave (chrome.scripting.executeScript, every frame) and gets back what it found there; if
// a video is playing, the panel connects to this frame and the video's picture is sent to the
// panel over a local WebRTC connection (video.captureStream). Sound keeps playing in the tab,
// the video keeps playing in the page: the panel only shows it and sends play / pause / seek.
//
// Injected again every time you leave the tab: the second time only answers the probe.
// The last expression of the file is what executeScript returns.

(() => {
  const PORT_NAME = 'tabbs-mini-player';
  const MIN_W = 200; // smaller videos are previews and ads, not what you were watching
  const MIN_H = 112;
  const STATUS_EVERY_MS = 500;

  const isPlaying = (video) => !video.paused && !video.ended && video.readyState >= 2;

  function area(video) {
    const rect = video.getBoundingClientRect();
    return rect.width >= MIN_W && rect.height >= MIN_H ? rect.width * rect.height : 0;
  }

  // The video you were watching: the largest playing one; not a muted looping background.
  function pick() {
    let best = null;
    let bestArea = 0;
    for (const video of document.querySelectorAll('video')) {
      if (!isPlaying(video) || (video.muted && video.loop)) continue;
      const size = area(video);
      if (size > bestArea) {
        best = video;
        bestArea = size;
      }
    }
    return { video: best, area: bestArea };
  }

  if (!globalThis.__tabbsMiniPlayer) {
    let chosen = null; // WeakRef of the video found by the last probe

    function connect(port) {
      const video = chosen?.deref();
      if (!video || !video.isConnected) {
        port.postMessage({ type: 'gone' });
        port.disconnect();
        return;
      }

      let stream;
      try {
        stream = video.captureStream();
      } catch (error) {
        port.postMessage({ type: 'unsupported', reason: String(error?.message ?? error) });
        port.disconnect();
        return;
      }

      const pc = new RTCPeerConnection();
      let sender = null;
      let width = 0; // what the panel shows, in device pixels: sent no larger

      async function fitSize() {
        if (!sender || !width || !video.videoWidth) return;
        const parameters = sender.getParameters();
        if (!parameters.encodings?.length) return;
        parameters.encodings[0].scaleResolutionDownBy = Math.max(1, video.videoWidth / width);
        parameters.encodings[0].maxBitrate = 4_000_000;
        parameters.degradationPreference = 'maintain-framerate';
        await sender.setParameters(parameters).catch(() => {});
      }

      function addVideoTrack() {
        const track = stream.getVideoTracks()[0];
        if (!track) return;
        if (sender) sender.replaceTrack(track).catch(() => {});
        else sender = pc.addTrack(track, stream);
        fitSize();
      }

      // A new source (the next video, an ad) brings a new track.
      stream.addEventListener('addtrack', addVideoTrack);
      addVideoTrack();

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) port.postMessage({ type: 'candidate', candidate: candidate.toJSON() });
      };

      let lastStatus = 0;
      function status(force = false) {
        const now = Date.now();
        if (!force && now - lastStatus < STATUS_EVERY_MS) return;
        lastStatus = now;
        port.postMessage({
          type: 'status',
          paused: video.paused,
          ended: video.ended,
          currentTime: video.currentTime,
          duration: Number.isFinite(video.duration) ? video.duration : null,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
      }
      const onTime = () => status();
      const onState = () => {
        status(true);
        fitSize();
      };
      const events = ['play', 'pause', 'ended', 'seeked', 'loadedmetadata', 'resize', 'durationchange'];
      video.addEventListener('timeupdate', onTime);
      for (const name of events) video.addEventListener(name, onState);

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
        video.removeEventListener('timeupdate', onTime);
        for (const name of events) video.removeEventListener(name, onState);
        stream.removeEventListener('addtrack', addVideoTrack);
        pc.close();
        // Stopping the copies doesn't stop the video itself.
        for (const track of stream.getTracks()) track.stop();
      });
    }

    globalThis.__tabbsMiniPlayer = {
      probe() {
        const { video, area: size } = pick();
        chosen = video ? new WeakRef(video) : null;
        return { playing: Boolean(video), area: size, muted: Boolean(video?.muted) };
      },
    };

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === PORT_NAME) connect(port);
    });
  }

  return globalThis.__tabbsMiniPlayer.probe();
})();
