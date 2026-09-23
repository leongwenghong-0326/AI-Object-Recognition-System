/**
 * Main scanner workflow: capture -> API -> AR overlay -> scan again.
 */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const base = (app && app.dataset.base) || "";
  const apiUrl = base + "/api/recognize.php";

  const els = {
    video: document.getElementById("cameraVideo"),
    stage: document.getElementById("cameraStage"),
    viewfinder: document.getElementById("viewfinder"),
    status: document.getElementById("statusMessage"),
    scanBtn: document.getElementById("scanBtn"),
    scanLabel: document.getElementById("scanBtnLabel"),
    errorBox: document.getElementById("cameraError"),
    errorText: document.getElementById("cameraErrorText"),
    retryBtn: document.getElementById("retryCameraBtn"),
    progress: document.getElementById("progressPanel"),
    progressTitle: document.getElementById("progressTitle"),
    progressFill: document.getElementById("progressFill"),
    progressPct: document.getElementById("progressPct"),
    progressBar: document.getElementById("progressBar"),
  };

  let state = "idle";
  let busy = false;
  let lastStatusKey = "point_camera";
  let lastButtonKey = "scan";

  function t(key) {
    return (window.I18n && I18n.t(key)) || key;
  }

  function setStatus(messageOrKey, isKey) {
    const text = isKey ? t(messageOrKey) : messageOrKey;
    if (isKey) lastStatusKey = messageOrKey;
    else lastStatusKey = null;
    if (els.status) els.status.textContent = text;
  }

  function setButton(labelKey, disabled) {
    lastButtonKey = labelKey;
    if (els.scanLabel) els.scanLabel.textContent = t(labelKey);
    if (els.scanBtn) {
      els.scanBtn.disabled = !!disabled;
      els.scanBtn.classList.toggle("busy", !!disabled && labelKey === "scanning");
      els.scanBtn.setAttribute("aria-label", t(labelKey));
    }
  }

  function showError(message) {
    if (els.errorText) els.errorText.textContent = message;
    if (els.errorBox) els.errorBox.hidden = false;
    if (els.viewfinder) { els.viewfinder.hidden = true; els.viewfinder.setAttribute("aria-hidden", "true"); }
  }

  function hideError() {
    if (els.errorBox) els.errorBox.hidden = true;
  }

  function cameraErrorMessage(err) {
    const code = err && err.code;
    if (code === "INSECURE") return t("cam_https");
    if (code === "DENIED") return t("cam_permission");
    if (code === "UNSUPPORTED" || code === "NOT_FOUND" || code === "UNKNOWN") return t("cam_unavailable");
    return (err && err.message) || t("cam_unavailable");
  }

  function setProgress(stage) {
    const map = {
      capture: { pct: 25, titleKey: "progress_capture" },
      ai: { pct: 55, titleKey: "progress_ai" },
      lookup: { pct: 80, titleKey: "progress_lookup" },
      display: { pct: 100, titleKey: "progress_display" },
      fail: { pct: 100, titleKey: "progress_fail" },
    };

    const info = map[stage] || map.capture;
    els.progress.hidden = false;
    els.progressTitle.textContent = t(info.titleKey);
    els.progressFill.style.width = info.pct + "%";
    els.progressPct.textContent = info.pct + "%";
    els.progressBar.setAttribute("aria-valuenow", String(info.pct));

    const order = ["capture", "ai", "lookup", "display"];
    const idx = order.indexOf(stage === "fail" ? "ai" : stage);

    document.querySelectorAll("#progressSteps li").forEach((li) => {
      const step = li.getAttribute("data-step");
      const stepIdx = order.indexOf(step);
      li.classList.remove("done", "active");
      const icon = li.querySelector("i");
      if (stepIdx < idx || stage === "display") {
        li.classList.add("done");
        if (icon) icon.className = "fa-solid fa-circle-check";
      } else if (stepIdx === idx) {
        li.classList.add("active");
        if (icon) icon.className = "fa-solid fa-circle";
      } else if (icon) {
        icon.className = "fa-regular fa-circle";
      }
    });
  }

  function hideProgress() {
    els.progress.hidden = true;
  }

  async function startCamera() {
    hideError();
    setStatus("starting_camera", true);
    try {
      await window.ARCamera.start(els.video);
      if (els.viewfinder) { els.viewfinder.hidden = false; els.viewfinder.setAttribute("aria-hidden", "false"); }
      setStatus("point_camera", true);
      setButton("scan", false);
      state = "idle";
    } catch (err) {
      const msg = cameraErrorMessage(err);
      showError(msg);
      setStatus(msg, false);
      setButton("scan", true);
    }
  }

  function validateResult(data) {
    if (!data || typeof data !== "object") return null;
    if (!data.productName || !data.objectLabel) return null;
    if (!data.boundingBox || typeof data.boundingBox !== "object") return null;

    const bb = data.boundingBox;
    const keys = ["ymin", "xmin", "ymax", "xmax"];
    for (const k of keys) {
      if (!Number.isFinite(Number(bb[k]))) return null;
      const n = Number(bb[k]);
      if (n < 0 || n > 1000) return null;
    }

    let confidence = Number(data.confidence);
    if (!Number.isFinite(confidence)) confidence = 0.5;
    if (confidence > 1 && confidence <= 100) confidence /= 100;
    confidence = Math.min(1, Math.max(0, confidence));

    return {
      objectLabel: String(data.objectLabel),
      objectLabelZh: String(data.objectLabelZh || ""),
      productName: String(data.productName),
      productNameZh: String(data.productNameZh || ""),
      manufacturer: String(data.manufacturer || ""),
      manufacturerZh: String(data.manufacturerZh || ""),
      specification: String(data.specification || ""),
      specificationZh: String(data.specificationZh || ""),
      description: String(data.description || ""),
      descriptionZh: String(data.descriptionZh || ""),
      boundingBox: {
        ymin: Number(bb.ymin),
        xmin: Number(bb.xmin),
        ymax: Number(bb.ymax),
        xmax: Number(bb.xmax),
      },
      confidence: confidence,
      provider: String(data.provider || ""),
    };
  }

  async function runScan() {
    if (busy) return;
    if (state === "success" || state === "failure") {
      window.AROverlay.hide();
      hideProgress();
      if (els.viewfinder) { els.viewfinder.hidden = false; els.viewfinder.setAttribute("aria-hidden", "false"); }
      setStatus("point_camera", true);
      setButton("scan", false);
      state = "idle";
      return;
    }

    busy = true;
    window.AROverlay.hide();
    setButton("scanning", true);
    state = "capturing";
    setStatus("capturing", true);
    setProgress("capture");

    let payload;
    try {
      payload = window.ARCamera.captureJpeg(els.video, 1280, 0.7);
    } catch (err) {
      busy = false;
      state = "failure";
      hideProgress();
      setStatus("unable_capture", true);
      setButton("scan_again", false);
      return;
    }

    state = "ai";
    setStatus("ai_identifying", true);
    setProgress("ai");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(function () { controller.abort(); }, 120000);

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ image: payload.dataUrl }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      state = "lookup";
      setProgress("lookup");
      setStatus("checking_product", true);

      let json;
      try {
        json = await response.json();
      } catch (e) {
        throw new Error(t("invalid_server"));
      }

      if (!response.ok || !json.ok) {
        const msg = (json && json.error) || t("unable_identify");
        throw new Error(msg);
      }

      const result = validateResult(json.data);
      if (!result) {
        throw new Error(t("unable_identify"));
      }

      setProgress("display");
      if (els.viewfinder) { els.viewfinder.hidden = true; els.viewfinder.setAttribute("aria-hidden", "true"); }
      window.AROverlay.show(result);
      setStatus("object_identified", true);
      state = "success";
      setButton("scan_again", false);

      setTimeout(function () {
        if (state === "success") hideProgress();
      }, 700);
    } catch (err) {
      setProgress("fail");
      if (err && err.name === "AbortError") {
        setStatus("timeout", true);
      } else {
        const msg = (err && err.message) || t("unable_identify");
        setStatus(msg, false);
      }
      state = "failure";
      setButton("scan_again", false);
      setTimeout(hideProgress, 900);
    } finally {
      busy = false;
    }
  }

  function refreshDynamicI18n() {
    if (lastStatusKey) setStatus(lastStatusKey, true);
    if (lastButtonKey) {
      const disabled = !!(els.scanBtn && els.scanBtn.disabled);
      setButton(lastButtonKey, disabled);
    }
    if (els.progress && !els.progress.hidden) {
      // Re-apply current progress title from last known state
      if (state === "capturing") setProgress("capture");
      else if (state === "ai") setProgress("ai");
      else if (state === "lookup") setProgress("lookup");
      else if (state === "success") setProgress("display");
      else if (state === "failure") setProgress("fail");
    }
  }

  if (els.scanBtn) {
    els.scanBtn.addEventListener("click", runScan);
  }

  if (els.retryBtn) {
    els.retryBtn.addEventListener("click", startCamera);
  }

  if (els.stage) {
    els.stage.addEventListener("click", function (e) {
      if (e.target.closest("#infoCard") || e.target.closest("#scanBtn")) return;
      const rect = els.stage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      window.ARCamera.tryFocus(x, y);
    });
  }

  document.addEventListener("i18n:change", refreshDynamicI18n);

  window.AROverlay.init();
  startCamera();

  window.addEventListener("beforeunload", function () {
    window.ARCamera.stop();
  });
})();