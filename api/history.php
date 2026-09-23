<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/includes/bootstrap.php';

header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $config = new AppConfig();
    $history = new ScanHistory($config);

    if (!$history->isEnabled()) {
        JsonResponse::error('Scan history is disabled. Enable the database in config.', 503);
    }

    $method = $_SERVER['REQUEST_METHOD'];
    $body = ($method === 'POST' || $method === 'DELETE') ? read_json_body() : [];

    if ($method === 'GET') {
        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
        if ($id > 0) {
            $item = $history->get($id);
            if ($item === null) {
                JsonResponse::error('Scan not found.', 404);
            }
            JsonResponse::success($item);
        }

        $search = isset($_GET['q']) ? (string) $_GET['q'] : '';
        $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
        JsonResponse::success($history->list($search, $page));
    }

    $action = strtolower((string) ($_GET['action'] ?? ($body['action'] ?? '')));
    if ($method === 'DELETE' || ($method === 'POST' && $action === 'clear')) {
        $deleted = $history->clear();
        JsonResponse::success(['deleted' => $deleted]);
    }

    JsonResponse::error('Method not allowed.', 405);
} catch (Throwable $e) {
    app_log('api/history.php error: ' . $e->getMessage(), 'ERROR');
    JsonResponse::error('Unable to load scan history.', 500);
}
