<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($base === '/' || $base === '.') {
    $base = '';
}

$config = new AppConfig();
$historyEnabled = (new ScanHistory($config))->isEnabled();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0b1220">
  <title data-i18n="history_title">Scan History</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" rel="stylesheet">
  <link href="<?= e($base) ?>/assets/css/app.css" rel="stylesheet">
</head>
<body class="page-body">
  <div class="page-wrap" id="historyApp" data-base="<?= e($base) ?>" data-enabled="<?= $historyEnabled ? '1' : '0' ?>">
    <header class="page-header">
      <a class="back-link" href="<?= e($base) ?>/index.php" data-i18n-aria="back_scanner" aria-label="Back to scanner">
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
      </a>
      <h1 data-i18n="history_title">Scan History</h1>
      <div class="header-actions">
        <div class="lang-switch" role="group" data-i18n-aria="lang_switch" aria-label="Language">
          <button type="button" class="lang-btn" data-lang-btn="en" aria-pressed="true">EN</button>
          <button type="button" class="lang-btn" data-lang-btn="zh" aria-pressed="false">中文</button>
        </div>
        <a class="icon-btn" href="<?= e($base) ?>/settings.php" data-i18n-aria="settings" aria-label="Settings">
          <i class="fa-solid fa-gear" aria-hidden="true"></i>
        </a>
      </div>
    </header>

    <?php if (!$historyEnabled): ?>
      <section class="glass-card">
        <h2 data-i18n="history_unavailable">History unavailable</h2>
        <p class="muted" data-i18n="history_unavailable_help">Scan history could not start. Ensure db_enabled is true in config, and that the storage folder is writable (SQLite) or MySQL is configured.</p>
      </section>
    <?php else: ?>
      <section class="glass-card">
        <form id="historySearch" class="history-search" role="search">
          <label class="visually-hidden" for="historyQuery" data-i18n="search_scans">Search scans</label>
          <input type="search" id="historyQuery" class="form-control" data-i18n-placeholder="search_placeholder" placeholder="Search product, manufacturer…">
          <button type="submit" class="btn btn-primary" data-i18n="search">Search</button>
          <button type="button" class="btn btn-outline-danger" id="clearHistoryBtn" data-i18n="clear">Clear</button>
        </form>

        <div class="table-responsive mt-3">
          <table class="table table-dark table-hover align-middle history-table">
            <thead>
              <tr>
                <th scope="col" data-i18n="product">Product</th>
                <th scope="col" data-i18n="provider">Provider</th>
                <th scope="col" data-i18n="confidence">Confidence</th>
                <th scope="col" data-i18n="date">Date</th>
              </tr>
            </thead>
            <tbody id="historyBody">
              <tr><td colspan="4" class="text-center muted" data-i18n="loading">Loading…</td></tr>
            </tbody>
          </table>
        </div>

        <nav class="history-pager" aria-label="History pagination">
          <button type="button" class="btn btn-sm btn-outline-light" id="prevPage" disabled data-i18n="prev">Prev</button>
          <span id="pageInfo">Page 1</span>
          <button type="button" class="btn btn-sm btn-outline-light" id="nextPage" disabled data-i18n="next">Next</button>
        </nav>
      </section>

      <div class="modal fade" id="detailModal" tabindex="-1" aria-labelledby="detailModalTitle" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content history-modal">
            <div class="modal-header">
              <h2 class="modal-title fs-5" id="detailModalTitle" data-i18n="scan_details">Scan details</h2>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" data-i18n-aria="close" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="detailBody"></div>
          </div>
        </div>
      </div>
    <?php endif; ?>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="<?= e($base) ?>/assets/js/i18n.js"></script>
  <script src="<?= e($base) ?>/assets/js/history.js"></script>
</body>
</html>