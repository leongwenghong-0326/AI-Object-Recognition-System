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
    if (!isset($body['image']) || !is_string($body['image'])) {
        JsonResponse::error('Invalid image payload.', 422);
    }
    $image = $body['image'];

    $validator = new ImageValidator();
    $validated = $validator->validateBase64($image);
    if (empty($validated['ok'])) {
        JsonResponse::error($validated['error'] ?? 'Invalid image.', 422);
    }

    $config = new AppConfig();
    $recognizer = new ObjectRecognizer($config);
    $outcome = $recognizer->recognize(
        (string) $validated['binary'],
        (string) $validated['mime']
    );

    if (empty($outcome['ok']) || !isset($outcome['result']) || !($outcome['result'] instanceof ProductResult)) {
        $status = ($outcome['stage'] ?? '') === 'config' ? 503 : 422;
        JsonResponse::error(
            $outcome['error'] ?? 'Unable to identify the object.',
            $status
        );
    }

    /** @var ProductResult $result */
    $result = $outcome['result'];

    // Optional history
    try {
        $history = new ScanHistory($config);
        if ($history->isEnabled()) {
            $history->save($result);
        }
    } catch (Throwable $e) {
        app_log('History save skipped: ' . $e->getMessage(), 'WARN');
    }

    JsonResponse::success($result->toArray());
} catch (Throwable $e) {
    app_log('recognize.php error: ' . $e->getMessage(), 'ERROR');
    JsonResponse::error('Server error while processing the image.', 500);
}
