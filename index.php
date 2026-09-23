<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($base === '/' || $base === '.') {
    $base = '';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
  <meta name="theme-color" content="#0b1220">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title data-i18n="app_title">AI + AR Object Scanner</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" rel="stylesheet">
  <link href="<?= e($base) ?>/assets/css/app.css" rel="stylesheet">
</head>
<body class="scanner-body">
  <div id="app" class="scanner-shell" data-base="<?= e($base) ?>">
    <header class="scanner-header">
      <div class="brand-block">
        <span class="brand-mark" aria-hidden="true"></span>
        <div>
          <h1 class="brand-title" data-i18n="app_title">AI + AR Object Scanner</h1>
          <p class="brand-sub" data-i18n="brand_sub">Smart recognition overlay</p>
        </div>
      </div>
      <div class="header-actions">
        <div class="lang-switch" role="group" data-i18n-aria="lang_switch" aria-label="Language">
          <button type="button" class="lang-btn" data-lang-btn="en" aria-pressed="true">EN</button>
          <button type="button" class="lang-btn" data-lang-btn="zh" aria-pressed="false">中文</button>
        </div>
        <a class="icon-btn" href="<?= e($base) ?>/history.php" data-i18n-aria="history" data-i18n-title="history" aria-label="History" title="History">
          <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
        </a>
        <a class="icon-btn" href="<?= e($base) ?>/settings.php" data-i18n-aria="settings" data-i18n-title="settings" aria-label="Settings" title="Settings">
          <i class="fa-solid fa-gear" aria-hidden="true"></i>
        </a>
      </div>
    </header>

    <main class="camera-stage" id="cameraStage">
      <video id="cameraVideo" class="camera-video" playsinline muted autoplay data-i18n-aria="live_camera" aria-label="Live camera preview"></video>
      <canvas id="captureCanvas" class="capture-canvas" aria-hidden="true"></canvas>

      <div id="viewfinder" class="viewfinder" aria-hidden="true">
        <span class="vf-corner tl"></span>
        <span class="vf-corner tr"></span>
        <span class="vf-corner bl"></span>
        <span class="vf-corner br"></span>
        <span class="vf-label" data-i18n="object">OBJECT</span>
      </div>

      <div id="arLayer" class="ar-layer" hidden>
        <div id="detectionBox" class="detection-box" role="img" aria-label="Detected object bounds"></div>
        <div id="infoCard" class="info-card" role="dialog" aria-expanded="false" aria-controls="infoCardDetails" tabindex="0">
          <div class="info-card-drag" id="infoCardDrag" data-i18n-title="drag_title" data-i18n-aria="drag" title="Drag to move" aria-label="Drag">
            <span class="drag-bars" aria-hidden="true"></span>
            <span class="drag-label" data-i18n="drag">Drag</span>
          </div>
          <button type="button" class="info-card-summary" id="infoCardToggle" aria-expanded="false" aria-controls="infoCardDetails">
            <strong id="cardProductName">Product</strong>
            <em id="cardProductNameAlt" class="zh-line"></em>
            <span id="cardHint" data-i18n="tap_details">Tap for details</span>
          </button>
          <div id="infoCardDetails" class="info-card-details" hidden>
            <div class="detail-row">
              <span data-i18n="manufacturer">Manufacturer</span>
              <strong id="cardManufacturer">—</strong>
              <em id="cardManufacturerAlt" class="zh-line"></em>
            </div>
            <div class="detail-row">
              <span data-i18n="specification">Specification</span>
              <strong id="cardSpecification">—</strong>
              <em id="cardSpecificationAlt" class="zh-line"></em>
            </div>
            <div class="detail-row">
              <span data-i18n="description">Description</span>
              <strong id="cardDescription">—</strong>
              <em id="cardDescriptionAlt" class="zh-line"></em>
            </div>
            <div class="detail-row">
              <span data-i18n="confidence">Confidence</span>
              <strong id="cardConfidence">—</strong>
            </div>
            <div class="detail-row">
              <span data-i18n="provider">AI Provider</span>
              <strong id="cardProvider">—</strong>
            </div>
          </div>
        </div>
      </div>

      <div id="progressPanel" class="progress-panel glass-panel" hidden>
        <h2 id="progressTitle" data-i18n="identifying">Identifying Object</h2>
        <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="progressBar">
          <div class="progress-fill" id="progressFill"></div>
        </div>
        <p class="progress-pct" id="progressPct">0%</p>
        <ul class="progress-steps" id="progressSteps">
          <li data-step="capture"><i class="fa-regular fa-circle"></i> <span data-i18n="step_capture">Capture image</span></li>
          <li data-step="ai"><i class="fa-regular fa-circle"></i> <span data-i18n="step_ai">AI identification</span></li>
          <li data-step="lookup"><i class="fa-regular fa-circle"></i> <span data-i18n="step_lookup">Product lookup</span></li>
          <li data-step="display"><i class="fa-regular fa-circle"></i> <span data-i18n="step_display">Display result</span></li>
        </ul>
      </div>

      <div id="cameraError" class="camera-error glass-panel" hidden>
        <i class="fa-solid fa-video-slash" aria-hidden="true"></i>
        <p id="cameraErrorText" data-i18n="cam_permission">Camera permission is required.</p>
        <button type="button" class="btn btn-light btn-sm" id="retryCameraBtn" data-i18n="try_again">Try again</button>
      </div>
    </main>

    <footer class="scanner-footer">
      <p id="statusMessage" class="status-message" role="status" aria-live="polite" data-i18n="point_camera">Point camera at an object</p>
      <button type="button" id="scanBtn" class="scan-btn" data-i18n-aria="scan" aria-label="Scan">
        <span class="scan-btn-ring" aria-hidden="true"></span>
        <span class="scan-btn-label" id="scanBtnLabel" data-i18n="scan">SCAN</span>
      </button>
    </footer>
  </div>

  <script src="<?= e($base) ?>/assets/js/i18n.js"></script>
  <script src="<?= e($base) ?>/assets/js/camera.js"></script>
  <script src="<?= e($base) ?>/assets/js/ar-overlay.js"></script>
  <script src="<?= e($base) ?>/assets/js/scanner.js"></script>
</body>
</html>