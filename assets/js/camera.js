/**
 * Camera access and live preview helpers.
 */
(function (global) {
  'use strict';

  const Camera = {
    stream: null,
    video: null,

    async start(videoEl) {
      this.video = videoEl;

      if (!global.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        throw Object.assign(new Error('Please use HTTPS to access the camera.'), { code: 'INSECURE' });
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw Object.assign(new Error('Camera is unavailable.'), { code: 'UNSUPPORTED' });
      }

      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // Fallback without facingMode for some desktops
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        } catch (err2) {
          const name = err2 && err2.name ? err2.name : '';
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            throw Object.assign(new Error('Camera permission is required.'), { code: 'DENIED' });
          }
          if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            throw Object.assign(new Error('Camera is unavailable.'), { code: 'NOT_FOUND' });
          }
          throw Object.assign(new Error('Camera is unavailable.'), { code: 'UNKNOWN', cause: err2 });
        }
      }

      videoEl.srcObject = this.stream;
      videoEl.setAttribute('playsinline', 'true');
      videoEl.muted = true;

      await videoEl.play().catch(() => {});
      await this.waitForFrames(videoEl);
      return this.stream;
    },

    waitForFrames(videoEl) {
      return new Promise((resolve) => {
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
          resolve();
          return;
        }
        const onReady = () => {
          videoEl.removeEventListener('loadeddata', onReady);
          resolve();
        };
        videoEl.addEventListener('loadeddata', onReady);
        setTimeout(resolve, 2500);
      });
    },

    /**
     * Capture current video frame as JPEG data URL (max 1280px, quality ~0.70).
     * Crops to the visible object-fit:cover area shown in the video element.
     */
    captureJpeg(videoEl, maxDim = 1280, quality = 0.7) {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      if (!vw || !vh) {
        throw new Error('Camera frame is not ready.');
      }

      const ew = videoEl.clientWidth || vw;
      const eh = videoEl.clientHeight || vh;
      const videoRatio = vw / vh;
      const elemRatio = ew / eh;

      let sx = 0;
      let sy = 0;
      let sw = vw;
      let sh = vh;

      // Reverse object-fit: cover mapping
      if (videoRatio > elemRatio) {
        sw = vh * elemRatio;
        sx = (vw - sw) / 2;
      } else {
        sh = vw / elemRatio;
        sy = (vh - sh) / 2;
      }

      let outW = Math.round(sw);
      let outH = Math.round(sh);
      const longest = Math.max(outW, outH);
      if (longest > maxDim) {
        const scale = maxDim / longest;
        outW = Math.max(1, Math.round(outW * scale));
        outH = Math.max(1, Math.round(outH * scale));
      }

      const canvas = document.getElementById('captureCanvas') || document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, outW, outH);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      return {
        dataUrl,
        width: outW,
        height: outH,
        source: { sx, sy, sw, sh, vw, vh },
      };
    },

    /**
     * Best-effort tap-to-focus / continuous focus where supported.
     */
    async tryFocus(xRatio, yRatio) {
      if (!this.stream) return;
      const track = this.stream.getVideoTracks()[0];
      if (!track || typeof track.getCapabilities !== 'function') return;

      const caps = track.getCapabilities();
      const advanced = [];

      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      } else if (caps.focusMode && caps.focusMode.includes('single-shot')) {
        advanced.push({ focusMode: 'single-shot' });
      }

      if (caps.pointsOfInterest) {
        advanced.push({
          pointsOfInterest: [{ x: Math.min(1, Math.max(0, xRatio)), y: Math.min(1, Math.max(0, yRatio)) }],
        });
      }

      if (!advanced.length) return;

      try {
        await track.applyConstraints({ advanced });
      } catch (_) {
        // Unsupported on this device — ignore
      }
    },

    stop() {
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
      }
      if (this.video) {
        this.video.srcObject = null;
      }
    },
  };

  global.ARCamera = Camera;
})(window);
