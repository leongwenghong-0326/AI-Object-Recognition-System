<?php

declare(strict_types=1);

/**
 * Shared helper functions.
 */

/**
 * Write a safe log line (never log API keys).
 */
function app_log(string $message, string $level = 'INFO'): void
{
    $file = APP_ROOT . '/logs/app.log';
    $safe = preg_replace('/(AIza[0-9A-Za-z_-]{10,}|sk-[0-9A-Za-z_-]{10,}|Bearer\s+[^\s]+)/i', '[REDACTED]', $message) ?? $message;
    $line = sprintf("[%s] [%s] %s\n", date('Y-m-d H:i:s'), strtoupper($level), $safe);
    @file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
}

/**
 * Escape for HTML output.
 */
function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Detect the base URL of this application (subdirectory-safe).
 */
function app_base_url(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443)
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

    $scheme = $https ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

    $script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
    $dir = rtrim(str_replace('\\', '/', dirname($script)), '/');

    // If called from /api/*.php, go up one level
    if (str_ends_with($dir, '/api')) {
        $dir = dirname($dir);
    }

    if ($dir === '/' || $dir === '.' || $dir === '\\') {
        $dir = '';
    }

    return $scheme . '://' . $host . $dir;
}

/**
 * Read JSON body from the request.
 *
 * @return array<string, mixed>
 */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/**
 * Parse a newline/comma separated model list.
 *
 * @return list<string>
 */
function parse_model_list(string $raw): array
{
    $parts = preg_split('/[\r\n,]+/', $raw) ?: [];
    $out = [];
    foreach ($parts as $part) {
        $m = trim($part);
        if ($m !== '') {
            $out[] = $m;
        }
    }
    return array_values(array_unique($out));
}
