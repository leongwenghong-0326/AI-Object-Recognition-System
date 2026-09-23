/**
 * Settings page: save config, test AI connections, toggle key visibility.
 */
(function () {
  "use strict";

  const root = document.getElementById("settingsApp");
  if (!root) return;

  const base = root.dataset.base || "";
  const apiUrl = base + "/api/settings.php";
  const form = document.getElementById("settingsForm");
  const alertBox = document.getElementById("settingsAlert");
  const testResults = document.getElementById("testResults");
  const saveBtn = document.getElementById("saveBtn");
  const testBtn = document.getElementById("testBtn");

  function t(key) {
    return (window.I18n && I18n.t(key)) || key;
  }

  function showAlert(type, message) {
    alertBox.hidden = false;
    alertBox.className = "alert mt-3 alert-" + (type === "success" ? "success" : "danger");
    alertBox.textContent = message;
  }

  function keyStatusHtml(status) {
    return status === "saved"
      ? '<span class="ok" data-i18n="key_saved">' + t("key_saved") + "</span>"
      : '<span class="warn" data-i18n="not_configured">' + t("not_configured") + "</span>";
  }

  function syncToggleLabels() {
    document.querySelectorAll(".toggle-visibility").forEach((btn) => {
      const id = btn.getAttribute("data-target");
      const input = document.getElementById(id);
      if (!input) return;
      const show = input.type === "text";
      btn.textContent = show ? t("hide") : t("show");
      btn.setAttribute("aria-label", (show ? t("hide") : t("show")));
    });
  }

  document.querySelectorAll(".toggle-visibility").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-target");
      const input = document.getElementById(id);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? t("hide") : t("show");
      btn.setAttribute("aria-label", show ? t("hide") : t("show"));
    });
  });

  async function postAction(payload) {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    let json;
    try {
      json = await res.json();
    } catch (_) {
      throw new Error(t("invalid_server"));
    }
    if (!res.ok || !json.ok) {
      throw new Error((json && json.error) || t("save_fail"));
    }
    return json.data;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;

    const timeout = Number(document.getElementById("requestTimeout").value);
    if (!Number.isFinite(timeout) || timeout < 10 || timeout > 120) {
      showAlert("error", t("timeout_err"));
      saveBtn.disabled = false;
      return;
    }

    const payload = {
      action: "save",
      pin: document.getElementById("settingsPin")?.value || "",
      ai_provider: document.getElementById("aiProvider").value,
      gemini_model: document.getElementById("geminiModel").value.trim(),
      gemini_fallback_models: document.getElementById("geminiFallback").value,
      gemini_api_key: document.getElementById("geminiKey").value.trim(),
      agnes_model: document.getElementById("agnesModel").value.trim(),
      agnes_fallback_models: document.getElementById("agnesFallback").value,
      agnes_api_key: document.getElementById("agnesKey").value.trim(),
      request_timeout: timeout,
    };

    try {
      const data = await postAction(payload);
      document.getElementById("geminiKey").value = "";
      document.getElementById("agnesKey").value = "";
      document.getElementById("geminiKeyStatus").innerHTML = keyStatusHtml(data.gemini_key_status);
      document.getElementById("agnesKeyStatus").innerHTML = keyStatusHtml(data.agnes_key_status);
      if (data.scanner_url) {
        const urlText = document.getElementById("scannerUrlText");
        if (urlText) urlText.textContent = data.scanner_url;
        const qrImg = document.querySelector(".qr-image");
        if (qrImg) {
          qrImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(data.scanner_url);
          qrImg.alt = t("qr_alt");
        }
      }
      showAlert("success", t("saved_ok"));
    } catch (err) {
      showAlert("error", err.message || t("save_fail"));
    } finally {
      saveBtn.disabled = false;
    }
  });

  testBtn.addEventListener("click", async () => {
    testBtn.disabled = true;
    testResults.hidden = false;
    document.querySelector("#testGemini strong").textContent = t("testing");
    document.querySelector("#testAgnes strong").textContent = t("testing");
    document.getElementById("testGemini").className = "test-row";
    document.getElementById("testAgnes").className = "test-row";

    try {
      const data = await postAction({
        action: "test",
        pin: document.getElementById("settingsPin")?.value || "",
      });

      const g = data.gemini || {};
      const a = data.agnes || {};
      const gEl = document.getElementById("testGemini");
      const aEl = document.getElementById("testAgnes");

      gEl.className = "test-row " + (g.ok ? "ok" : "fail");
      aEl.className = "test-row " + (a.ok ? "ok" : "fail");
      gEl.querySelector("strong").textContent = (g.ok ? "✓ " : "✗ ") + (g.message || (g.ok ? t("connected") : t("failed")));
      aEl.querySelector("strong").textContent = (a.ok ? "✓ " : "✗ ") + (a.message || (a.ok ? t("connected") : t("failed")));
      showAlert("success", t("test_done"));
    } catch (err) {
      showAlert("error", err.message || t("test_fail"));
    } finally {
      testBtn.disabled = false;
    }
  });

  document.addEventListener("i18n:change", () => {
    syncToggleLabels();
    const gStatus = document.getElementById("geminiKeyStatus");
    const aStatus = document.getElementById("agnesKeyStatus");
    if (gStatus) {
      const saved = gStatus.querySelector(".ok");
      gStatus.innerHTML = keyStatusHtml(saved ? "saved" : "missing");
    }
    if (aStatus) {
      const saved = aStatus.querySelector(".ok");
      aStatus.innerHTML = keyStatusHtml(saved ? "saved" : "missing");
    }
  });
})();