<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/bootstrap.php';

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    JsonResponse::error('Method not allowed.', 405);
}

try {
    $body = read_json_body();
    $lang = is_string($body['lang'] ?? null) ? $body['lang'] : 'en';
    $fields = [
        'productName' => mb_substr(trim((string) ($body['productName'] ?? '')), 0, 300),
        'manufacturer' => mb_substr(trim((string) ($body['manufacturer'] ?? '')), 0, 200),
        'specification' => mb_substr(trim((string) ($body['specification'] ?? '')), 0, 500),
        'description' => mb_substr(trim((string) ($body['description'] ?? '')), 0, 800),
    ];
    if ($fields['productName'] === '' && $fields['description'] === '') {
        JsonResponse::error('Nothing to translate.', 422);
    }

    $config = new AppConfig();
    $translator = new TextTranslator($config);
    $normalized = $translator->normalizeLang($lang);
    if ($normalized === 'en') {
        JsonResponse::success($fields);
    }

    $outcome = $translator->translate($fields, $normalized);
    if (empty($outcome['ok'])) {
        JsonResponse::error($outcome['error'] ?? 'Unable to translate.', 422);
    }

    JsonResponse::success($outcome['fields']);
} catch (Throwable $e) {
    app_log('translate.php error: ' . $e->getMessage(), 'ERROR');
    JsonResponse::error('Server error while translating.', 500);
}