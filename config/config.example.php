<?php

declare(strict_types=1);

/**
 * Copy this file to config.php and fill in your values.
 * Never commit config.php with real API keys.
 */
return array (
  'ai_provider' => 'auto',
  'gemini_api_key' => '',
  'gemini_model' => 'gemini-2.5-flash',
  'gemini_fallback_models' => 'gemini-3.6-flash
gemini-3.5-flash
gemini-2.5-flash-lite',
  'agnes_api_key' => '',
  'agnes_model' => 'agnes-2.5-flash',
  'agnes_fallback_models' => 'agnes-2.0-flash',
  'agnes_base_url' => 'https://apihub.agnes-ai.com/v1',
  'request_timeout' => 45,
  'db_host' => '127.0.0.1',
  'db_port' => 3306,
  'db_name' => 'ai_ar_scanner',
  'db_user' => 'root',
  'db_pass' => '',
  'db_enabled' => true,
  'settings_pin' => '',
  'db_driver' => 'sqlite',
);
