/**
 * Simple EN / ZH language switch for the whole app.
 * Usage: I18n.t("key"), I18n.setLang("zh"), data-i18n="key" in HTML.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "ai_ar_lang";

  const dict = {
    en: {
      app_title: "AI + AR Object Scanner",
      brand_sub: "Smart recognition overlay",
      history: "History",
      settings: "Settings",
      back_scanner: "Back to scanner",
      live_camera: "Live camera preview",
      object: "OBJECT",
      drag: "Drag",
      drag_title: "Drag to move",
      tap_details: "Tap for details",
      tap_collapse: "Tap to collapse",
      manufacturer: "Manufacturer",
      specification: "Specification",
      description: "Description",
      confidence: "Confidence",
      provider: "AI Provider",
      identifying: "Identifying Object",
      step_capture: "Capture image",
      step_ai: "AI identification",
      step_lookup: "Product lookup",
      step_display: "Display result",
      cam_permission: "Camera permission is required.",
      try_again: "Try again",
      point_camera: "Point camera at an object",
      starting_camera: "Starting camera...",
      scan: "SCAN",
      scanning: "SCANNING...",
      scan_again: "SCAN AGAIN",
      capturing: "Capturing image...",
      ai_identifying: "AI identifying object...",
      checking_product: "Checking product information...",
      object_identified: "Object identified",
      unable_capture: "Unable to capture image. Please try again.",
      unable_identify: "Unable to identify the object. Please try again.",
      timeout: "AI request timed out. Please try again.",
      invalid_server: "Invalid server response.",
      cam_unavailable: "Camera is unavailable.",
      cam_https: "Please use HTTPS to access the camera.",
      progress_capture: "Capturing image...",
      progress_ai: "AI identifying object...",
      progress_lookup: "Checking product information...",
      progress_display: "Object identified",
      progress_fail: "Unable to identify",
      settings_title: "Settings",
      open_phone: "Open on Phone",
      open_phone_help: "Scan this QR code to open the scanner. Prefer HTTPS for camera access.",
      qr_alt: "QR code linking to scanner page",
      ai_config: "AI Configuration",
      settings_pin: "Settings PIN",
      pin_placeholder: "Enter PIN to save",
      ai_provider: "AI Provider",
      provider_auto: "Auto (Gemini → Agnes)",
      gemini_model: "Gemini Model",
      gemini_fallback: "Gemini Fallback Models",
      one_per_line: "One model per line",
      gemini_key: "Gemini API Key",
      agnes_model: "Agnes Model",
      agnes_fallback: "Agnes Fallback Models",
      agnes_key: "Agnes API Key",
      keep_key: "Leave blank to keep saved key",
      show: "Show",
      hide: "Hide",
      key_saved: "Key saved",
      not_configured: "Not configured",
      timeout_label: "Request Timeout (seconds)",
      timeout_help: "Allowed range: 10 – 120",
      save_settings: "Save Settings",
      test_connection: "Test Connection",
      connection_test: "Connection Test",
      footer_note: "API keys never appear in frontend JavaScript responses. Saved keys are stored only on the server.",
      saved_ok: "Settings saved successfully.",
      timeout_err: "Request timeout must be between 10 and 120 seconds.",
      save_fail: "Unable to save settings.",
      test_fail: "Connection test failed.",
      test_done: "Connection test finished.",
      testing: "Testing…",
      connected: "Connected",
      failed: "Failed",
      history_title: "Scan History",
      history_unavailable: "History unavailable",
      history_unavailable_help: "Scan history could not start. Ensure db_enabled is true in config, and that the storage folder is writable (SQLite) or MySQL is configured.",
      search_scans: "Search scans",
      search_placeholder: "Search product, manufacturer…",
      search: "Search",
      clear: "Clear",
      product: "Product",
      date: "Date",
      loading: "Loading…",
      no_scans: "No scans found.",
      prev: "Prev",
      next: "Next",
      page: "Page",
      scan_details: "Scan details",
      close: "Close",
      clear_confirm: "Clear all scan history? This cannot be undone.",
      clear_fail: "Unable to clear history.",
      details_fail: "Unable to load details.",
      unknown: "Unknown",
      lang_en: "EN",
      lang_zh: "中文",
      lang_switch: "Language",
    },
    zh: {
      app_title: "AI + AR \u7269\u4f53\u626b\u63cf",
      brand_sub: "\u667a\u80fd\u8bc6\u522b\u53e0\u52a0\u5c42",
      history: "\u5386\u53f2",
      settings: "\u8bbe\u7f6e",
      back_scanner: "\u8fd4\u56de\u626b\u63cf",
      live_camera: "\u5b9e\u65f6\u76f8\u673a\u9884\u89c8",
      object: "\u76ee\u6807",
      drag: "\u62d6\u52a8",
      drag_title: "\u62d6\u52a8\u79fb\u52a8",
      tap_details: "\u70b9\u51fb\u67e5\u770b",
      tap_collapse: "\u70b9\u51fb\u6536\u8d77",
      manufacturer: "\u5236\u9020\u5546",
      specification: "\u89c4\u683c",
      description: "\u63cf\u8ff0",
      confidence: "\u7f6e\u4fe1\u5ea6",
      provider: "AI\u63d0\u4f9b\u5546",
      identifying: "\u6b63\u5728\u8bc6\u522b\u7269\u4f53",
      step_capture: "\u6355\u6349\u56fe\u50cf",
      step_ai: "AI\u8bc6\u522b",
      step_lookup: "\u4ea7\u54c1\u67e5\u8be2",
      step_display: "\u663e\u793a\u7ed3\u679c",
      cam_permission: "\u9700\u8981\u76f8\u673a\u6743\u9650\u3002",
      try_again: "\u91cd\u8bd5",
      point_camera: "\u5c06\u76f8\u673a\u5bf9\u51c6\u7269\u4f53",
      starting_camera: "\u6b63\u5728\u542f\u52a8\u76f8\u673a...",
      scan: "\u626b\u63cf",
      scanning: "\u626b\u63cf\u4e2d...",
      scan_again: "\u518d\u6b21\u626b\u63cf",
      capturing: "\u6b63\u5728\u6355\u6349\u56fe\u50cf...",
      ai_identifying: "AI\u6b63\u5728\u8bc6\u522b\u7269\u4f53...",
      checking_product: "\u6b63\u5728\u67e5\u8be2\u4ea7\u54c1\u4fe1\u606f...",
      object_identified: "\u7269\u4f53\u5df2\u8bc6\u522b",
      unable_capture: "\u65e0\u6cd5\u6355\u6349\u56fe\u50cf\uff0c\u8bf7\u91cd\u8bd5\u3002",
      unable_identify: "\u65e0\u6cd5\u8bc6\u522b\u8be5\u7269\u4f53\uff0c\u8bf7\u91cd\u8bd5\u3002",
      timeout: "AI\u8bf7\u6c42\u8d85\u65f6\uff0c\u8bf7\u91cd\u8bd5\u3002",
      invalid_server: "\u670d\u52a1\u5668\u54cd\u5e94\u65e0\u6548\u3002",
      cam_unavailable: "\u76f8\u673a\u4e0d\u53ef\u7528\u3002",
      cam_https: "\u8bf7\u4f7f\u7528 HTTPS \u8bbf\u95ee\u76f8\u673a\u3002",
      progress_capture: "\u6b63\u5728\u6355\u6349\u56fe\u50cf...",
      progress_ai: "AI\u6b63\u5728\u8bc6\u522b\u7269\u4f53...",
      progress_lookup: "\u6b63\u5728\u67e5\u8be2\u4ea7\u54c1\u4fe1\u606f...",
      progress_display: "\u7269\u4f53\u5df2\u8bc6\u522b",
      progress_fail: "\u65e0\u6cd5\u8bc6\u522b",
      settings_title: "\u8bbe\u7f6e",
      open_phone: "\u5728\u624b\u673a\u4e0a\u6253\u5f00",
      open_phone_help: "\u7528\u624b\u673a\u626b\u63cf\u6b64\u4e8c\u7ef4\u7801\u6253\u5f00\u626b\u63cf\u9875\u3002\u5efa\u8bae\u4f7f\u7528 HTTPS \u4ee5\u8bbf\u95ee\u76f8\u673a\u3002",
      qr_alt: "\u94fe\u63a5\u5230\u626b\u63cf\u9875\u7684\u4e8c\u7ef4\u7801",
      ai_config: "AI\u914d\u7f6e",
      settings_pin: "\u8bbe\u7f6e PIN",
      pin_placeholder: "\u8f93\u5165 PIN \u4ee5\u4fdd\u5b58",
      ai_provider: "AI\u63d0\u4f9b\u5546",
      provider_auto: "\u81ea\u52a8\uff08Gemini \u2192 Agnes\uff09",
      gemini_model: "Gemini \u6a21\u578b",
      gemini_fallback: "Gemini \u5907\u7528\u6a21\u578b",
      one_per_line: "\u6bcf\u884c\u4e00\u4e2a\u6a21\u578b",
      gemini_key: "Gemini API \u5bc6\u94a5",
      agnes_model: "Agnes \u6a21\u578b",
      agnes_fallback: "Agnes \u5907\u7528\u6a21\u578b",
      agnes_key: "Agnes API \u5bc6\u94a5",
      keep_key: "\u7559\u7a7a\u5219\u4fdd\u6301\u5df2\u4fdd\u5b58\u5bc6\u94a5",
      show: "\u663e\u793a",
      hide: "\u9690\u85cf",
      key_saved: "\u5bc6\u94a5\u5df2\u4fdd\u5b58",
      not_configured: "\u672a\u914d\u7f6e",
      timeout_label: "\u8bf7\u6c42\u8d85\u65f6\uff08\u79d2\uff09",
      timeout_help: "\u5141\u8bb8\u8303\u56f4\uff1a10 \u2013 120",
      save_settings: "\u4fdd\u5b58\u8bbe\u7f6e",
      test_connection: "\u6d4b\u8bd5\u8fde\u63a5",
      connection_test: "\u8fde\u63a5\u6d4b\u8bd5",
      footer_note: "API \u5bc6\u94a5\u4e0d\u4f1a\u51fa\u73b0\u5728\u524d\u7aef JavaScript \u54cd\u5e94\u4e2d\u3002\u5df2\u4fdd\u5b58\u7684\u5bc6\u94a5\u4ec5\u5b58\u50a8\u5728\u670d\u52a1\u5668\u3002",
      saved_ok: "\u8bbe\u7f6e\u5df2\u4fdd\u5b58\u3002",
      timeout_err: "\u8bf7\u6c42\u8d85\u65f6\u5fc5\u987b\u5728 10 \u5230 120 \u79d2\u4e4b\u95f4\u3002",
      save_fail: "\u65e0\u6cd5\u4fdd\u5b58\u8bbe\u7f6e\u3002",
      test_fail: "\u8fde\u63a5\u6d4b\u8bd5\u5931\u8d25\u3002",
      test_done: "\u8fde\u63a5\u6d4b\u8bd5\u5b8c\u6210\u3002",
      testing: "\u6d4b\u8bd5\u4e2d\u2026",
      connected: "\u5df2\u8fde\u63a5",
      failed: "\u5931\u8d25",
      history_title: "\u626b\u63cf\u5386\u53f2",
      history_unavailable: "\u5386\u53f2\u4e0d\u53ef\u7528",
      history_unavailable_help: "\u65e0\u6cd5\u542f\u52a8\u626b\u63cf\u5386\u53f2\u3002\u8bf7\u786e\u4fdd\u914d\u7f6e\u4e2d db_enabled \u4e3a true\uff0c\u4e14 storage \u76ee\u5f55\u53ef\u5199\uff08SQLite\uff09\u6216\u5df2\u914d\u7f6e MySQL\u3002",
      search_scans: "\u641c\u7d22\u626b\u63cf",
      search_placeholder: "\u641c\u7d22\u4ea7\u54c1\u3001\u5236\u9020\u5546\u2026",
      search: "\u641c\u7d22",
      clear: "\u6e05\u7a7a",
      product: "\u4ea7\u54c1",
      date: "\u65e5\u671f",
      loading: "\u52a0\u8f7d\u4e2d\u2026",
      no_scans: "\u6682\u65e0\u626b\u63cf\u8bb0\u5f55\u3002",
      prev: "\u4e0a\u4e00\u9875",
      next: "\u4e0b\u4e00\u9875",
      page: "\u7b2c",
      scan_details: "\u626b\u63cf\u8be6\u60c5",
      close: "\u5173\u95ed",
      clear_confirm: "\u786e\u5b9a\u6e05\u7a7a\u5168\u90e8\u626b\u63cf\u5386\u53f2\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002",
      clear_fail: "\u65e0\u6cd5\u6e05\u7a7a\u5386\u53f2\u3002",
      details_fail: "\u65e0\u6cd5\u52a0\u8f7d\u8be6\u60c5\u3002",
      unknown: "\u672a\u77e5",
      lang_en: "EN",
      lang_zh: "\u4e2d\u6587",
      lang_switch: "\u8bed\u8a00",
    },
  };

  const I18n = {
    lang: "en",

    init() {
      const saved = localStorage.getItem(STORAGE_KEY);
      this.lang = saved === "zh" || saved === "en" ? saved : "en";
      this.apply();
      this.bindToggle();
      document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: this.lang } }));
    },

    t(key) {
      const table = dict[this.lang] || dict.en;
      return table[key] || dict.en[key] || key;
    },

    setLang(lang) {
      this.lang = lang === "zh" ? "zh" : "en";
      localStorage.setItem(STORAGE_KEY, this.lang);
      this.apply();
      document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: this.lang } }));
    },

    toggle() {
      this.setLang(this.lang === "zh" ? "en" : "zh");
    },

    apply() {
      document.documentElement.lang = this.lang === "zh" ? "zh-CN" : "en";
      document.documentElement.setAttribute("data-lang", this.lang);

      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (!key) return;
        const text = this.t(key);
        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          // text content not for inputs
        } else {
          el.textContent = text;
        }
      });

      document.querySelectorAll("[data-i18n-html]").forEach((el) => {
        const key = el.getAttribute("data-i18n-html");
        if (key) el.innerHTML = this.t(key);
      });

      document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (key) el.setAttribute("placeholder", this.t(key));
      });

      document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
        const key = el.getAttribute("data-i18n-aria");
        if (key) el.setAttribute("aria-label", this.t(key));
      });

      document.querySelectorAll("[data-i18n-title]").forEach((el) => {
        const key = el.getAttribute("data-i18n-title");
        if (key) el.setAttribute("title", this.t(key));
      });

      document.querySelectorAll("option[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (key) el.textContent = this.t(key);
      });

      // Update language toggle buttons
      document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
        const lang = btn.getAttribute("data-lang-btn");
        btn.classList.toggle("active", lang === this.lang);
        btn.setAttribute("aria-pressed", lang === this.lang ? "true" : "false");
      });

      // Page title if marked
      const titleEl = document.querySelector("title[data-i18n]");
      if (titleEl) {
        document.title = this.t(titleEl.getAttribute("data-i18n"));
      }
    },

    bindToggle() {
      document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const lang = btn.getAttribute("data-lang-btn");
          this.setLang(lang);
        });
      });
    },
  };

  global.I18n = I18n;
  document.addEventListener("DOMContentLoaded", () => I18n.init());
})(window);