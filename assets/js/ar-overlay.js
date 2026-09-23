/**
 * Lightweight AR overlay: detection box + draggable bilingual info card.
 */
(function (global) {
  "use strict";

  const Overlay = {
    layer: null,
    box: null,
    card: null,
    details: null,
    toggleBtn: null,
    dragHandle: null,
    stage: null,
    expanded: false,
    lastResult: null,
    dragState: null,

    t(key) {
      return (global.I18n && I18n.t(key)) || key;
    },

    init() {
      this.layer = document.getElementById("arLayer");
      this.box = document.getElementById("detectionBox");
      this.card = document.getElementById("infoCard");
      this.details = document.getElementById("infoCardDetails");
      this.toggleBtn = document.getElementById("infoCardToggle");
      this.dragHandle = document.getElementById("infoCardDrag");
      this.stage = document.getElementById("cameraStage");

      if (this.toggleBtn) {
        this.toggleBtn.addEventListener("pointerup", (e) => {
          if (e.button !== undefined && e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          this.toggle();
        });
        this.toggleBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
      }

      if (this.card) {
        this.card.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.toggle();
          }
        });
      }

      this.bindDrag();
      if (this.details) {
        this.details.addEventListener("touchmove", function (e) { e.stopPropagation(); }, { passive: true });
        this.details.addEventListener("wheel", function (e) { e.stopPropagation(); }, { passive: true });
      }

      document.addEventListener("i18n:change", () => this.onLangChange());
    },

    onLangChange() {
      if (this.lastResult) {
        this.applyResultTexts(this.lastResult);
        this.updateHint();
      } else {
        this.updateHint();
      }
    },

    bindDrag() {
      if (!this.dragHandle) return;
      this.dragHandle.addEventListener("pointerdown", (e) => this.onPointerDown(e));
      window.addEventListener("pointermove", (e) => this.onPointerMove(e));
      window.addEventListener("pointerup", (e) => this.onPointerUp(e));
      window.addEventListener("pointercancel", (e) => this.onPointerUp(e));
    },

    onPointerDown(e) {
      if (!this.card || !this.stage || !this.dragHandle) return;
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const rect = this.card.getBoundingClientRect();
      const stageRect = this.stage.getBoundingClientRect();
      this.dragState = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: rect.left - stageRect.left,
        origTop: rect.top - stageRect.top,
        moved: false,
        capturing: false,
      };
    },

    onPointerMove(e) {
      if (!this.dragState || this.dragState.pointerId !== e.pointerId) return;
      if (!this.card || !this.stage) return;

      const dx = e.clientX - this.dragState.startX;
      const dy = e.clientY - this.dragState.startY;
      if (!this.dragState.moved && Math.hypot(dx, dy) < 6) return;

      if (!this.dragState.capturing) {
        this.dragState.capturing = true;
        this.card.classList.add("dragging");
        try { this.dragHandle.setPointerCapture(e.pointerId); } catch (_) {}
      }

      this.dragState.moved = true;
      e.preventDefault();

      const stageRect = this.stage.getBoundingClientRect();
      const cardRect = this.card.getBoundingClientRect();
      let left = this.dragState.origLeft + dx;
      let top = this.dragState.origTop + dy;
      const maxLeft = Math.max(0, stageRect.width - cardRect.width);
      const maxTop = Math.max(0, stageRect.height - cardRect.height);
      left = Math.min(maxLeft, Math.max(0, left));
      top = Math.min(maxTop, Math.max(0, top));

      this.card.style.left = left + "px";
      this.card.style.top = top + "px";
      this.card.style.transform = "none";
    },

    onPointerUp(e) {
      if (!this.dragState || this.dragState.pointerId !== e.pointerId) return;
      if (this.card) this.card.classList.remove("dragging");
      if (this.dragHandle) {
        try { this.dragHandle.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      this.dragState = null;
      this.clampCardInView();
    },

    updateHint() {
      const hint = document.getElementById("cardHint");
      if (!hint) return;
      hint.textContent = this.expanded ? this.t("tap_collapse") : this.t("tap_details");
    },

    hide() {
      if (!this.layer) return;
      this.layer.hidden = true;
      this.expanded = false;
      if (this.details) {
        this.details.hidden = true;
        this.details.style.display = "none";
        this.details.scrollTop = 0;
      }
      if (this.card) {
        this.card.setAttribute("aria-expanded", "false");
        this.card.classList.remove("dragging");
      }
      if (this.toggleBtn) this.toggleBtn.setAttribute("aria-expanded", "false");
      this.updateHint();
      this.lastResult = null;
      this.dragState = null;
    },

    show(result) {
      if (!this.layer || !result) return;
      this.lastResult = result;
      this.layer.hidden = false;

      const bb = result.boundingBox || { ymin: 200, xmin: 200, ymax: 800, xmax: 800 };
      this.box.style.top = (bb.ymin / 1000) * 100 + "%";
      this.box.style.left = (bb.xmin / 1000) * 100 + "%";
      this.box.style.width = Math.max(8, ((bb.xmax - bb.xmin) / 1000) * 100) + "%";
      this.box.style.height = Math.max(8, ((bb.ymax - bb.ymin) / 1000) * 100) + "%";

      this.applyResultTexts(result);

      this.expanded = false;
      if (this.details) {
        this.details.hidden = true;
        this.details.style.display = "none";
        this.details.scrollTop = 0;
      }
      this.card.setAttribute("aria-expanded", "false");
      if (this.toggleBtn) this.toggleBtn.setAttribute("aria-expanded", "false");
      this.updateHint();

      this.positionCard(bb);
    },

    applyResultTexts(result) {
      this.setBilingual(
        "cardProductName",
        "cardProductNameAlt",
        result.productName || result.objectLabel || this.t("object"),
        result.productNameZh || result.objectLabelZh || ""
      );
      this.setBilingual(
        "cardManufacturer",
        "cardManufacturerAlt",
        result.manufacturer || this.t("unknown"),
        result.manufacturerZh || ""
      );
      this.setBilingual(
        "cardSpecification",
        "cardSpecificationAlt",
        result.specification || "—",
        result.specificationZh || ""
      );
      this.setBilingual(
        "cardDescription",
        "cardDescriptionAlt",
        result.description || "—",
        result.descriptionZh || ""
      );
      const confEl = document.getElementById("cardConfidence");
      if (confEl) confEl.textContent = this.formatConfidence(result.confidence);
      const provEl = document.getElementById("cardProvider");
      if (provEl) provEl.textContent = this.formatProvider(result.provider);
    },

    /**
     * Primary line follows UI language; alt line shows the other language when different.
     */
    setBilingual(primaryId, altId, enText, zhText) {
      const primary = document.getElementById(primaryId);
      const alt = document.getElementById(altId);
      const lang = (global.I18n && I18n.lang) || "en";
      const en = (enText || "").trim() || "—";
      const zh = (zhText || "").trim();

      if (lang === "zh") {
        if (primary) primary.textContent = zh || en;
        if (alt) {
          if (zh && zh !== en) {
            alt.textContent = en;
            alt.hidden = false;
          } else {
            alt.textContent = "";
            alt.hidden = true;
          }
        }
      } else {
        if (primary) primary.textContent = en;
        if (alt) {
          if (zh && zh !== en) {
            alt.textContent = zh;
            alt.hidden = false;
          } else {
            alt.textContent = "";
            alt.hidden = true;
          }
        }
      }
    },

    positionCard(bb) {
      if (!this.stage || !this.card) return;
      const midX = ((bb.xmin + bb.xmax) / 2 / 1000) * this.stage.clientWidth;
      const belowY = (bb.ymax / 1000) * this.stage.clientHeight + 12;
      const cardW = Math.min(this.stage.clientWidth * 0.9, 360);
      let left = midX - cardW / 2;
      let top = Math.min(belowY, this.stage.clientHeight * 0.42);
      left = Math.min(this.stage.clientWidth - cardW - 8, Math.max(8, left));
      top = Math.max(8, top);
      this.card.style.width = cardW + "px";
      this.card.style.left = left + "px";
      this.card.style.top = top + "px";
      this.card.style.transform = "none";
      this.clampCardInView();
    },

    clampCardInView() {
      if (!this.stage || !this.card) return;
      const stageH = this.stage.clientHeight;
      const stageW = this.stage.clientWidth;
      const maxCardH = Math.floor(stageH * (this.expanded ? 0.82 : 0.55));
      this.card.style.maxHeight = maxCardH + "px";

      const cardH = Math.min(this.card.offsetHeight || maxCardH, maxCardH);
      const cardW = this.card.offsetWidth || 220;
      let left = parseFloat(this.card.style.left) || 0;
      let top = parseFloat(this.card.style.top) || 0;
      left = Math.min(Math.max(8, left), Math.max(8, stageW - cardW - 8));
      top = Math.min(Math.max(8, top), Math.max(8, stageH - cardH - 8));
      this.card.style.left = left + "px";
      this.card.style.top = top + "px";

      if (this.details && this.expanded) {
        const dragH = (this.dragHandle && this.dragHandle.offsetHeight) || 36;
        const summaryH = (this.toggleBtn && this.toggleBtn.offsetHeight) || 70;
        const detailsMax = Math.max(120, maxCardH - dragH - summaryH - 8);
        this.details.style.maxHeight = detailsMax + "px";
      }
    },

    toggle() {
      if (!this.lastResult || !this.details) return;
      this.expanded = !this.expanded;
      this.details.hidden = !this.expanded;
      this.details.style.display = this.expanded ? "block" : "none";
      if (!this.expanded) {
        this.details.scrollTop = 0;
        this.details.style.maxHeight = "";
      }
      this.card.setAttribute("aria-expanded", this.expanded ? "true" : "false");
      if (this.toggleBtn) this.toggleBtn.setAttribute("aria-expanded", this.expanded ? "true" : "false");
      this.updateHint();
      requestAnimationFrame(() => {
        this.clampCardInView();
        if (this.expanded && this.details) {
          this.details.scrollTop = 0;
        }
      });
    },

    formatConfidence(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return "—";
      const pct = n <= 1 ? n * 100 : n;
      return Math.round(pct) + "%";
    },

    formatProvider(value) {
      const p = String(value || "").toLowerCase();
      if (p === "gemini") return "Gemini";
      if (p === "agnes") return "Agnes";
      return value || "—";
    },
  };

  global.AROverlay = Overlay;
})(window);