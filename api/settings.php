<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/bootstrap.php';

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $config = new AppConfig();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $data = $config->publicSettings();
        $data['scanner_url'] = app_base_url() . '/index.php';
        JsonResponse::success($data);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        JsonResponse::error('Method not allowed.', 405);
    }

    $body = read_json_body();
    $action = strtolower(trim((string) ($body['action'] ?? 'save')));

    // Optional PIN check
    $pin = $config->getString('settings_pin');
    if ($pin !== '') {
        $provided = (string) ($body['pin'] ?? '');
        if (!hash_equals($pin, $provided)) {
            JsonResponse::error('Invalid settings PIN.', 403);
        }
    }

    if ($action === 'test') {
        $recognizer = new ObjectRecognizer($config);
        JsonResponse::success($recognizer->testConnections());
    }

    if ($action !== 'save') {
        JsonResponse::error('Unknown action.', 400);
    }

    $config->save($body);
    $data = $config->publicSettings();
    $data['scanner_url'] = app_base_url() . '/index.php';
    JsonResponse::success($data);
} catch (Throwable $e) {
    app_log('api/settings.php error: ' . $e->getMessage(), 'ERROR');
    JsonResponse::error('Unable to process settings request.', 500);
}
