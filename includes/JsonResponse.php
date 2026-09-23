<?php

declare(strict_types=1);

/**
 * Standardized JSON HTTP responses.
 */
final class JsonResponse
{
    /**
     * @param array<string, mixed>|null $data
     */
    public static function success(?array $data = null, int $status = 200): never
    {
        self::send(['ok' => true, 'data' => $data], $status);
    }

    public static function error(string $message, int $status = 400, ?array $extra = null): never
    {
        $payload = ['ok' => false, 'error' => $message];
        if ($extra !== null) {
            $payload = array_merge($payload, $extra);
        }
        self::send($payload, $status);
    }

    /**
     * @param array<string, mixed> $payload
     */
    public static function send(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}
