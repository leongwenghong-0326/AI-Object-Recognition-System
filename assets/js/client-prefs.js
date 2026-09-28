/**
 * Device-local camera and voice preferences. Does not touch server AI settings.
 */
(function (global) {
  "use strict";

  const KEY = "ai_ar_client_prefs";
  const VERSION = 2;

  const DEFAULTS = {
    cameraResolution: "auto",
    autofocus: true,
    tapToFocus: true,
    haptic: true,
    torch: false,
    voiceEnabled: true,
    autoSpeak: true,
    voiceURI: "",
    voiceLang: "",
    voiceName: "",
    volume: 100,
  };

  function load() {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {};
    } catch (_) {
      saved = {};
    }
    const prefs = Object.assign({}, DEFAULTS, saved);
    prefs.volume = Math.min(100, Math.max(0, Number(prefs.volume)));
    if (!Number.isFinite(prefs.volume)) prefs.volume = 100;
    if (Number(saved._v) !== VERSION) {
      prefs.autofocus = DEFAULTS.autofocus;
      prefs.tapToFocus = DEFAULTS.tapToFocus;
      prefs.haptic = DEFAULTS.haptic;
      prefs.torch = DEFAULTS.torch;
      prefs.voiceEnabled = DEFAULTS.voiceEnabled;
      prefs.autoSpeak = DEFAULTS.autoSpeak;
      prefs._v = VERSION;
      try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (_) {}
    }
    ["autofocus", "tapToFocus", "haptic", "torch", "voiceEnabled", "autoSpeak"].forEach((k) => {
      prefs[k] = !!prefs[k];
    });
    if (!["auto", "standard", "720", "1080", "high"].includes(prefs.cameraResolution)) {
      prefs.cameraResolution = "auto";
    }
    return prefs;
  }

  const ARPrefs = {
    defaults: DEFAULTS,
    load,
    save(partial) {
      const next = Object.assign(load(), partial || {});
      localStorage.setItem(KEY, JSON.stringify(next));
      document.dispatchEvent(new CustomEvent("arprefs:change", { detail: next }));
      return next;
    },
    reset() {
      localStorage.removeItem(KEY);
      const next = load();
      document.dispatchEvent(new CustomEvent("arprefs:change", { detail: next }));
      return next;
    },
  };

  global.ARPrefs = ARPrefs;
})(window);