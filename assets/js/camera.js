/**
 * Camera access, resolution, torch, device switching, and focus helpers.
 */
(function (global) {
  "use strict";

  const RESOLUTIONS = {
    standard: { width: 640, height: 480 },
    "720": { width: 1280, height: 720 },
    "1080": { width: 1920, height: 1080 },
    high: { width: 2560, height: 1440 },
    auto: { width: 1920, height: 1080 },
  };

  const Camera = {
    stream: null,
    video: null,
    currentDeviceId: "",
    torchOn: false,

    prefs() {
      return global.ARPrefs ? ARPrefs.load() : {
        cameraResolution: "auto",
        autofocus: true,
        tapToFocus: true,
        torch: false,
      };
    },

    track() {
      return this.stream && this.stream.getVideoTracks ? this.stream.getVideoTracks()[0] : null;
    },

    capabilities() {
      const track = this.track();
      if (!track || typeof track.getCapabilities !== "function") return {};
      try { return track.getCapabilities() || {}; } catch (_) { return {}; }
    },

    torchSupported() {
      return this.capabilities().torch === true;
    },

    focusSupported() {
      const caps = this.capabilities();
      return !!(caps.focusMode && caps.focusMode.length) || !!caps.pointsOfInterest;
    },

    async listCameras() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
      const all = await navigator.mediaDevices.enumerateDevices();
      return all.filter((d) => d.kind === "videoinput").map((d, index) => ({
        deviceId: d.deviceId,
        label: d.label || ("Camera " + (index + 1)),
      }));
    },

    videoConstraint(mode, deviceId) {
      const preset = RESOLUTIONS[mode] || RESOLUTIONS.auto;
      const video = {
        width: { ideal: preset.width },
        height: { ideal: preset.height },
      };
      if (deviceId) video.deviceId = { exact: deviceId };
      else video.facingMode = { ideal: "environment" };
      return video;
    },

    async openStream(videoConstraints) {
      return navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints });
    },

    async start(videoEl, options) {
      this.video = videoEl;
      const opts = options || {};
      const settings = this.prefs();
      const mode = opts.resolution || settings.cameraResolution || "auto";
      const deviceId = opts.deviceId || "";

      if (!global.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
        throw Object.assign(new Error("Please use HTTPS to access the camera."), { code: "INSECURE" });
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw Object.assign(new Error("Camera is unavailable."), { code: "UNSUPPORTED" });
      }

      this.stopTracks();

      const attempts = [];
      attempts.push(this.videoConstraint(mode, deviceId));
      if (mode === "high" || mode === "auto" || mode === "1080") {
        attempts.push(this.videoConstraint("720", deviceId));
      }
      if (mode !== "standard") attempts.push(this.videoConstraint("standard", deviceId));
      if (!deviceId) attempts.push(true);

      let lastError = null;
      for (let i = 0; i < attempts.length; i += 1) {
        try {
          this.stream = await this.openStream(attempts[i]);
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!this.stream) {
        const name = lastError && lastError.name ? lastError.name : "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          throw Object.assign(new Error("Camera permission was denied."), { code: "DENIED" });
        }
        if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
          throw Object.assign(new Error("Camera is unavailable."), { code: "NOT_FOUND" });
        }
        throw Object.assign(new Error("Camera is unavailable."), { code: "UNKNOWN", cause: lastError });
      }

      const track = this.track();
      const settingsNow = track && track.getSettings ? track.getSettings() : {};
      this.currentDeviceId = settingsNow.deviceId || deviceId || "";

      videoEl.srcObject = this.stream;
      videoEl.setAttribute("playsinline", "true");
      videoEl.muted = true;
      await videoEl.play().catch(() => {});
      await this.waitForFrames(videoEl);

      await this.applyAutofocus();
      if (settings.torch && this.torchSupported()) {
        await this.setTorch(true);
      } else {
        this.torchOn = false;
      }

      document.dispatchEvent(new CustomEvent("arcamera:ready", {
        detail: {
          torch: this.torchSupported(),
          focus: this.focusSupported(),
          deviceId: this.currentDeviceId,
          devices: await this.listCameras(),
        },
      }));
      return this.stream;
    },

    async applyAutofocus() {
      const settings = this.prefs();
      if (!settings.autofocus) return false;
      const track = this.track();
      const caps = this.capabilities();
      if (!track || !caps.focusMode) return false;
      const advanced = [];
      if (caps.focusMode.indexOf("continuous") !== -1) advanced.push({ focusMode: "continuous" });
      else if (caps.focusMode.indexOf("single-shot") !== -1) advanced.push({ focusMode: "single-shot" });
      if (!advanced.length) return false;
      try {
        await track.applyConstraints({ advanced });
        return true;
      } catch (_) {
        return false;
      }
    },

    async setTorch(on) {
      const track = this.track();
      if (!track || !this.torchSupported()) {
        this.torchOn = false;
        return { ok: false, reason: "unsupported" };
      }
      try {
        await track.applyConstraints({ advanced: [{ torch: !!on }] });
        this.torchOn = !!on;
        if (global.ARPrefs) ARPrefs.save({ torch: this.torchOn });
        return { ok: true, on: this.torchOn };
      } catch (_) {
        return { ok: false, reason: "failed" };
      }
    },

    async switchNext() {
      const devices = await this.listCameras();
      if (devices.length < 2) return { ok: false, reason: "single" };
      const index = devices.findIndex((d) => d.deviceId && d.deviceId === this.currentDeviceId);
      const next = devices[(index + 1 + devices.length) % devices.length];
      const previous = this.currentDeviceId;
      const keepTorch = this.torchOn;
      try {
        await this.start(this.video, { deviceId: next.deviceId });
        if (keepTorch) await this.setTorch(true);
        return { ok: true, deviceId: this.currentDeviceId, label: next.label };
      } catch (err) {
        if (previous) {
          try { await this.start(this.video, { deviceId: previous }); } catch (_) {}
        }
        return { ok: false, reason: "failed", error: err };
      }
    },

    async useDevice(deviceId) {
      const previous = this.currentDeviceId;
      const keepTorch = this.torchOn;
      try {
        await this.start(this.video, { deviceId: deviceId || "" });
        if (keepTorch) await this.setTorch(true);
        return { ok: true, deviceId: this.currentDeviceId };
      } catch (err) {
        if (previous) {
          try { await this.start(this.video, { deviceId: previous }); } catch (_) {}
        }
        return { ok: false, reason: "failed", error: err };
      }
    },

    waitForFrames(videoEl) {
      return new Promise((resolve) => {
        if (videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
          resolve();
          return;
        }
        const onReady = () => {
          videoEl.removeEventListener("loadeddata", onReady);
          resolve();
        };
        videoEl.addEventListener("loadeddata", onReady);
        setTimeout(resolve, 2500);
      });
    },

    /**
     * Capture current video frame as JPEG data URL (max 1280px, quality ~0.70).
     * High-resolution preview is downscaled here so AI uploads stay small.
     */
    captureJpeg(videoEl, maxDim = 1280, quality = 0.7) {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      if (!vw || !vh) {
        throw new Error("Camera frame is not ready.");
      }

      const ew = videoEl.clientWidth || vw;
      const eh = videoEl.clientHeight || vh;
      const videoRatio = vw / vh;
      const elemRatio = ew / eh;

      let sx = 0;
      let sy = 0;
      let sw = vw;
      let sh = vh;

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

      const canvas = document.getElementById("captureCanvas") || document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d", { alpha: false });
      ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, outW, outH);

      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      return {
        dataUrl,
        width: outW,
        height: outH,
        source: { sx, sy, sw, sh, vw, vh },
      };
    },

    async tryFocus(xRatio, yRatio) {
      if (!this.stream) return false;
      const settings = this.prefs();
      if (settings.tapToFocus === false && settings.autofocus === false) return false;
      const track = this.track();
      if (!track || typeof track.getCapabilities !== "function") return false;

      const caps = track.getCapabilities();
      const advanced = [];

      if (settings.autofocus !== false && caps.focusMode && caps.focusMode.indexOf("continuous") !== -1) {
        advanced.push({ focusMode: "continuous" });
      } else if (caps.focusMode && caps.focusMode.indexOf("single-shot") !== -1) {
        advanced.push({ focusMode: "single-shot" });
      }

      if (caps.pointsOfInterest) {
        advanced.push({
          pointsOfInterest: [{
            x: Math.min(1, Math.max(0, xRatio)),
            y: Math.min(1, Math.max(0, yRatio)),
          }],
        });
      }

      if (!advanced.length) return false;
      try {
        await track.applyConstraints({ advanced });
        return true;
      } catch (_) {
        return false;
      }
    },

    stopTracks() {
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
    },

    stop() {
      this.stopTracks();
      this.torchOn = false;
      if (this.video) this.video.srcObject = null;
    },
  };

  global.ARCamera = Camera;
})(window);