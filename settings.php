<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/bootstrap.php';

$base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($base === '/' || $base === '.') {
    $base = '';
}

$config = new AppConfig();
$settings = $config->publicSettings();
$scannerUrl = app_base_url() . '/index.php';
$qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' . rawurlencode($scannerUrl);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0b1220">
  <title data-i18n="settings_title">Settings</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" rel="stylesheet">
  <link href="<?= e($base) ?>/assets/css/app.css" rel="stylesheet">
</head>
<body class="page-body">
  <div class="page-wrap" data-base="<?= e($base) ?>" id="settingsApp"
       data-has-pin="<?= $settings['has_settings_pin'] ? '1' : '0' ?>">
    <header class="page-header">
      <a class="back-link" href="<?= e($base) ?>/index.php" data-i18n-aria="back_scanner" aria-label="Back to scanner">
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
      </a>
      <h1 data-i18n="settings_title">Settings</h1>
      <div class="header-actions">
        <div class="lang-switch" role="group" data-i18n-aria="lang_switch" aria-label="Language">
          <button type="button" class="lang-btn" data-lang-btn="en" aria-pressed="true">EN</button>
          <button type="button" class="lang-btn" data-lang-btn="zh" aria-pressed="false">中文</button>
        </div>
        <a class="icon-btn" href="<?= e($base) ?>/history.php" data-i18n-aria="history" aria-label="History">
          <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i>
        </a>
      </div>
    </header>

    <section class="glass-card qr-card">
      <h2 data-i18n="open_phone">Open on Phone</h2>
      <p class="muted" data-i18n="open_phone_help">Scan this QR code to open the scanner. Prefer HTTPS for camera access.</p>
      <img class="qr-image" src="<?= e($qrUrl) ?>" width="220" height="220" data-i18n-aria="qr_alt" alt="QR code">
      <p class="qr-url"><code id="scannerUrlText"><?= e($scannerUrl) ?></code></p>
    </section>

    <form id="settingsForm" class="glass-card settings-form" novalidate>
      <h2 data-i18n="ai_config">AI Configuration</h2>

      <div class="mb-3" id="pinGroup" <?= $settings['has_settings_pin'] ? '' : 'hidden' ?>>
        <label class="form-label" for="settingsPin" data-i18n="settings_pin">Settings PIN</label>
        <input type="password" class="form-control" id="settingsPin" name="pin" autocomplete="current-password" data-i18n-placeholder="pin_placeholder" placeholder="Enter PIN to save">
      </div>

      <div class="mb-3">
        <label class="form-label" for="aiProvider" data-i18n="ai_provider">AI Provider</label>
        <select class="form-select" id="aiProvider" name="ai_provider">
          <option value="auto" <?= $settings['ai_provider'] === 'auto' ? 'selected' : '' ?> data-i18n="provider_auto">Auto (Gemini → Agnes)</option>
          <option value="gemini" <?= $settings['ai_provider'] === 'gemini' ? 'selected' : '' ?>>Gemini</option>
          <option value="agnes" <?= $settings['ai_provider'] === 'agnes' ? 'selected' : '' ?>>Agnes</option>
        </select>
      </div>

      <div class="mb-3">
        <label class="form-label" for="geminiModel" data-i18n="gemini_model">Gemini Model</label>
        <input type="text" class="form-control" id="geminiModel" name="gemini_model" value="<?= e($settings['gemini_model']) ?>" placeholder="gemini-2.5-flash">
      </div>

      <div class="mb-3">
        <label class="form-label" for="geminiFallback" data-i18n="gemini_fallback">Gemini Fallback Models</label>
        <textarea class="form-control" id="geminiFallback" name="gemini_fallback_models" rows="3" data-i18n-placeholder="one_per_line" placeholder="One model per line"><?= e($settings['gemini_fallback_models']) ?></textarea>
      </div>

      <div class="mb-3">
        <label class="form-label" for="geminiKey" data-i18n="gemini_key">Gemini API Key</label>
        <div class="input-group">
          <input type="password" class="form-control" id="geminiKey" name="gemini_api_key" autocomplete="off" data-i18n-placeholder="keep_key" placeholder="Leave blank to keep saved key">
          <button type="button" class="btn btn-outline-light toggle-visibility" data-target="geminiKey" data-i18n="show" data-i18n-aria="show">Show</button>
        </div>
        <div class="key-status" id="geminiKeyStatus">
          <?= $settings['gemini_key_status'] === 'saved' ? '<span class="ok" data-i18n="key_saved">Key saved</span>' : '<span class="warn" data-i18n="not_configured">Not configured</span>' ?>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="agnesModel" data-i18n="agnes_model">Agnes Model</label>
        <input type="text" class="form-control" id="agnesModel" name="agnes_model" value="<?= e($settings['agnes_model']) ?>" placeholder="agnes-2.5-flash">
      </div>

      <div class="mb-3">
        <label class="form-label" for="agnesFallback" data-i18n="agnes_fallback">Agnes Fallback Models</label>
        <textarea class="form-control" id="agnesFallback" name="agnes_fallback_models" rows="3"><?= e($settings['agnes_fallback_models']) ?></textarea>
      </div>

      <div class="mb-3">
        <label class="form-label" for="agnesKey" data-i18n="agnes_key">Agnes API Key</label>
        <div class="input-group">
          <input type="password" class="form-control" id="agnesKey" name="agnes_api_key" autocomplete="off" data-i18n-placeholder="keep_key" placeholder="Leave blank to keep saved key">
          <button type="button" class="btn btn-outline-light toggle-visibility" data-target="agnesKey" data-i18n="show">Show</button>
        </div>
        <div class="key-status" id="agnesKeyStatus">
          <?= $settings['agnes_key_status'] === 'saved' ? '<span class="ok" data-i18n="key_saved">Key saved</span>' : '<span class="warn" data-i18n="not_configured">Not configured</span>' ?>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="requestTimeout" data-i18n="timeout_label">Request Timeout (seconds)</label>
        <input type="number" class="form-control" id="requestTimeout" name="request_timeout" min="10" max="120" value="<?= (int) $settings['request_timeout'] ?>">
        <div class="form-text text-light opacity-75" data-i18n="timeout_help">Allowed range: 10 – 120</div>
      </div>

      <div class="d-grid gap-2">
        <button type="submit" class="btn btn-primary btn-lg" id="saveBtn">
          <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> <span data-i18n="save_settings">Save Settings</span>
        </button>
        <button type="button" class="btn btn-outline-light" id="testBtn">
          <i class="fa-solid fa-plug" aria-hidden="true"></i> <span data-i18n="test_connection">Test Connection</span>
        </button>
      </div>

      <div id="settingsAlert" class="alert mt-3" role="status" aria-live="polite" hidden></div>

      <div id="testResults" class="test-results" hidden>
        <h3 data-i18n="connection_test">Connection Test</h3>
        <div class="test-row" id="testGemini"><span>Gemini</span><strong>—</strong></div>
        <div class="test-row" id="testAgnes"><span>Agnes</span><strong>—</strong></div>
      </div>
    </form>

    <p class="footer-note" data-i18n="footer_note">API keys never appear in frontend JavaScript responses. Saved keys are stored only on the server.</p>
  </div>

  <script src="<?= e($base) ?>/assets/js/i18n.js"></script>
  <script src="<?= e($base) ?>/assets/js/settings.js"></script>
</body>
</html>