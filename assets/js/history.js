/**
 * Scan history list, search, pagination, details, clear.
 */
(function () {
  "use strict";

  const root = document.getElementById("historyApp");
  if (!root || root.dataset.enabled !== "1") return;

  const base = root.dataset.base || "";
  const apiUrl = base + "/api/history.php";
  const body = document.getElementById("historyBody");
  const pageInfo = document.getElementById("pageInfo");
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  const queryInput = document.getElementById("historyQuery");
  const detailBody = document.getElementById("detailBody");

  let page = 1;
  let total = 0;
  let perPage = 20;
  let query = "";
  let modal = null;
  let lastDetail = null;

  if (window.bootstrap) {
    modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("detailModal"));
  }

  function t(key) {
    return (window.I18n && I18n.t(key)) || key;
  }

  function pct(conf) {
    const n = Number(conf);
    if (!Number.isFinite(n)) return "—";
    return Math.round((n <= 1 ? n * 100 : n)) + "%";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderDetail(d) {
    detailBody.innerHTML =
      "<p><strong>" + t("product") + ":</strong> " + escapeHtml(d.productName) + "</p>" +
      "<p><strong>" + t("object") + ":</strong> " + escapeHtml(d.objectLabel) + "</p>" +
      "<p><strong>" + t("manufacturer") + ":</strong> " + escapeHtml(d.manufacturer || "—") + "</p>" +
      "<p><strong>" + t("specification") + ":</strong> " + escapeHtml(d.specification || "—") + "</p>" +
      "<p><strong>" + t("description") + ":</strong> " + escapeHtml(d.description || "—") + "</p>" +
      "<p><strong>" + t("confidence") + ":</strong> " + pct(d.confidence) + "</p>" +
      "<p><strong>" + t("provider") + ":</strong> " + escapeHtml(d.provider || "—") + "</p>" +
      "<p><strong>" + t("date") + ":</strong> " + escapeHtml(d.createdAt || "—") + "</p>";
  }

  async function load() {
    body.innerHTML = '<tr><td colspan="4" class="text-center muted">' + t("loading") + "</td></tr>";
    const url = apiUrl + "?page=" + encodeURIComponent(page) + "&q=" + encodeURIComponent(query);
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error((json && json.error) || t("details_fail"));
      }

      const data = json.data;
      total = data.total || 0;
      perPage = data.perPage || 20;
      page = data.page || 1;
      const items = data.items || [];

      if (!items.length) {
        body.innerHTML = '<tr><td colspan="4" class="text-center muted">' + t("no_scans") + "</td></tr>";
      } else {
        body.innerHTML = items.map((item) => `
          <tr data-id="${item.id}" tabindex="0" role="button" aria-label="${escapeHtml(item.productName)}">
            <td>
              <strong>${escapeHtml(item.productName)}</strong>
              <div class="muted small">${escapeHtml(item.manufacturer || item.objectLabel || "")}</div>
            </td>
            <td>${escapeHtml(item.provider || "—")}</td>
            <td>${pct(item.confidence)}</td>
            <td>${escapeHtml(item.createdAt || "")}</td>
          </tr>
        `).join("");
      }

      const pages = Math.max(1, Math.ceil(total / perPage));
      pageInfo.textContent = t("page") + " " + page + " / " + pages;
      prevBtn.disabled = page <= 1;
      nextBtn.disabled = page >= pages;
    } catch (err) {
      body.innerHTML = '<tr><td colspan="4" class="text-center text-danger">' + escapeHtml(err.message) + "</td></tr>";
    }
  }

  async function showDetails(id) {
    try {
      const res = await fetch(apiUrl + "?id=" + encodeURIComponent(id), { headers: { Accept: "application/json" } });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error((json && json.error) || t("details_fail"));
      lastDetail = json.data;
      renderDetail(lastDetail);
      if (modal) modal.show();
    } catch (err) {
      alert(err.message || t("details_fail"));
    }
  }

  body.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-id]");
    if (row) showDetails(row.getAttribute("data-id"));
  });

  body.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest("tr[data-id]");
    if (!row) return;
    e.preventDefault();
    showDetails(row.getAttribute("data-id"));
  });

  document.getElementById("historySearch").addEventListener("submit", (e) => {
    e.preventDefault();
    query = queryInput.value.trim();
    page = 1;
    load();
  });

  prevBtn.addEventListener("click", () => {
    if (page > 1) {
      page -= 1;
      load();
    }
  });

  nextBtn.addEventListener("click", () => {
    const pages = Math.max(1, Math.ceil(total / perPage));
    if (page < pages) {
      page += 1;
      load();
    }
  });

  document.getElementById("clearHistoryBtn").addEventListener("click", async () => {
    if (!confirm(t("clear_confirm"))) return;
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error((json && json.error) || t("clear_fail"));
      page = 1;
      load();
    } catch (err) {
      alert(err.message || t("clear_fail"));
    }
  });

  document.addEventListener("i18n:change", () => {
    load();
    if (lastDetail) renderDetail(lastDetail);
  });

  load();
})();