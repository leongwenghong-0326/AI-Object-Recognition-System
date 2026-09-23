<?php

declare(strict_types=1);

/**
 * Small cURL HTTP client with timeout support.
 */
final class HttpClient
{
    /**
     * @param array<string, string> $headers
     * @return array{status:int, body:string, error:?string}
     */
    public static function postJson(string $url, array $payload, array $headers = [], int $timeout = 45): array
    {
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return ['status' => 0, 'body' => '', 'error' => 'Failed to encode request JSON.'];
        }

        if (!function_exists('curl_init')) {
            return self::postJsonFallback($url, $json, $headers, $timeout);
        }

        $ch = curl_init($url);
        if ($ch === false) {
            return ['status' => 0, 'body' => '', 'error' => 'Unable to initialize HTTP client.'];
        }

        $headerLines = ['Content-Type: application/json'];
        foreach ($headers as $name => $value) {
            $headerLines[] = $name . ': ' . $value;
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => $headerLines,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => min(15, $timeout),
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        $body = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = $errno ? curl_error($ch) : null;
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($body === false) {
            return ['status' => 0, 'body' => '', 'error' => $error ?: 'HTTP request failed.'];
        }

        return ['status' => $status, 'body' => (string) $body, 'error' => $error];
    }

    /**
     * @param array<string, string> $headers
     * @return array{status:int, body:string, error:?string}
     */
    public static function get(string $url, array $headers = [], int $timeout = 20): array
    {
        if (!function_exists('curl_init')) {
            $ctx = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'timeout' => $timeout,
                    'header' => self::formatHeaders($headers),
                    'ignore_errors' => true,
                ],
            ]);
            $body = @file_get_contents($url, false, $ctx);
            $status = 0;
            if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
                $status = (int) $m[1];
            }
            return ['status' => $status, 'body' => $body === false ? '' : (string) $body, 'error' => $body === false ? 'HTTP GET failed.' : null];
        }

        $ch = curl_init($url);
        if ($ch === false) {
            return ['status' => 0, 'body' => '', 'error' => 'Unable to initialize HTTP client.'];
        }

        $headerLines = [];
        foreach ($headers as $name => $value) {
            $headerLines[] = $name . ': ' . $value;
        }

        curl_setopt_array($ch, [
            CURLOPT_HTTPGET => true,
            CURLOPT_HTTPHEADER => $headerLines,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => min(10, $timeout),
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        $body = curl_exec($ch);
        $error = curl_errno($ch) ? curl_error($ch) : null;
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return ['status' => $status, 'body' => $body === false ? '' : (string) $body, 'error' => $error];
    }

    /**
     * @param array<string, string> $headers
     * @return array{status:int, body:string, error:?string}
     */
    private static function postJsonFallback(string $url, string $json, array $headers, int $timeout): array
    {
        $headerBag = "Content-Type: application/json\r\n" . self::formatHeaders($headers);
        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => $headerBag,
                'content' => $json,
                'timeout' => $timeout,
                'ignore_errors' => true,
            ],
        ]);

        $body = @file_get_contents($url, false, $ctx);
        $status = 0;
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
            $status = (int) $m[1];
        }

        return [
            'status' => $status,
            'body' => $body === false ? '' : (string) $body,
            'error' => $body === false ? 'HTTP request failed.' : null,
        ];
    }

    /**
     * @param array<string, string> $headers
     */
    private static function formatHeaders(array $headers): string
    {
        $lines = [];
        foreach ($headers as $name => $value) {
            $lines[] = $name . ': ' . $value;
        }
        return implode("\r\n", $lines) . (count($lines) ? "\r\n" : '');
    }
}
