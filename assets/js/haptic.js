/**
 * Optional short vibration. Silent when unsupported or turned off.
 */
(function (global) {
  "use strict";

  const ARHaptic = {
    supported() {
      return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
    },

    enabled() {
      const prefs = global.ARPrefs ? ARPrefs.load() : { haptic: false };
      return !!prefs.haptic && this.supported();
    },

    pulse(kind) {
      if (!this.enabled()) return;
      try {
        if (kind === "focus") navigator.vibrate(30);
        else if (kind === "success") navigator.vibrate([30, 50, 30]);
        else if (kind === "error") navigator.vibrate([80, 40, 80]);
        else navigator.vibrate(20);
      } catch (_) {}
    },
  };

  global.ARHaptic = ARHaptic;
})(window);