<?php

declare(strict_types=1);

/**
 * Application bootstrap — load shared classes and helpers.
 */

define('APP_ROOT', dirname(__DIR__));
define('APP_VERSION', '1.0.0');

// Never show raw PHP errors to browser users
@ini_set('display_errors', '0');
@ini_set('display_startup_errors', '0');
@ini_set('log_errors', '1');

spl_autoload_register(static function (string $class): void {
    $path = APP_ROOT . '/includes/' . $class . '.php';
    if (is_file($path)) {
        require_once $path;
    }
});

require_once APP_ROOT . '/includes/helpers.php';

foreach ([APP_ROOT . '/logs', APP_ROOT . '/storage/temp'] as $dir) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
}