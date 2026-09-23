<?php

declare(strict_types=1);

/**
 * Google Gemini Vision provider.
 */
final class GeminiVision implements AIProvider
{
    private AppConfig $config;

    public function __construct(AppConfig $config)
    {
        $this->config = $config;
    }

    public function getName(): string
    {
        return 'gemini';
    }

    public function isConfigured(): bool
    {
        return $this->config->getString('gemini_api_key') !== '';
    }

    public function recognize(string $imageBinary, string $mime): array
    {
        if (!$this->isConfigured()) {
            return ['ok' => false, 'error' => 'Gemini API key is not configured.'];
        }

        $models = $this->config->geminiModels();
        if ($models === []) {
            return ['ok' => false, 'error' => 'No Gemini model configured.'];
        }

        $lastError = 'Gemini recognition failed.';
        foreach ($models as $model) {
            $response = $this->callModel($model, $imageBinary, $mime);
            if ($response['ok']) {
                return $response;
            }
            $lastError = $response['error'] ?? $lastError;
            app_log('Gemini model failed: ' . $model . ' — ' . $lastError, 'WARN');
        }

        return ['ok' => false, 'error' => $lastError];
    }

    public function testConnection(): array
    {
        if (!$this->isConfigured()) {
            return ['ok' => false, 'message' => 'API key not configured'];
        }

        $key = $this->config->getString('gemini_api_key');
        $model = $this->config->getString('gemini_model', 'gemini-2.5-flash');
        $url = sprintf(
            'https://generativelanguage.googleapis.com/v1beta/models/%s?key=%s',
            rawurlencode($model),
            rawurlencode($key)
        );

        $res = HttpClient::get($url, [], min(20, $this->config->getInt('request_timeout', 45)));
        if ($res['error']) {
            return ['ok' => false, 'message' => 'Connection failed: network error'];
        }

        if ($res['status'] >= 200 && $res['status'] < 300) {
            return ['ok' => true, 'message' => 'Connected'];
        }

        $msg = 'Connection failed';
        $json = json_decode($res['body'], true);
        if (is_array($json) && isset($json['error']['message'])) {
            $msg = 'Connection failed: ' . self::safeError((string) $json['error']['message']);
        } elseif ($res['status'] === 401 || $res['status'] === 403) {
            $msg = 'Connection failed: invalid API key';
        }

        return ['ok' => false, 'message' => $msg];
    }

    /**
     * @return array{ok:bool, result?:ProductResult, error?:string}
     */
    private function callModel(string $model, string $imageBinary, string $mime): array
    {
        $key = $this->config->getString('gemini_api_key');
        $timeout = $this->config->getInt('request_timeout', 45);
        $url = sprintf(
            'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
            rawurlencode($model),
            rawurlencode($key)
        );

        $payload = [
            'systemInstruction' => [
                'parts' => [
                    ['text' => VisionPrompt::systemInstruction()],
                ],
            ],
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => VisionPrompt::userText()],
                        [
                            'inlineData' => [
                                'mimeType' => $mime,
                                'data' => base64_encode($imageBinary),
                            ],
                        ],
                    ],
                ],
            ],
            'generationConfig' => [
                'temperature' => 0.2,
                'maxOutputTokens' => 1024,
                'responseMimeType' => 'application/json',
            ],
        ];

        $res = HttpClient::postJson($url, $payload, [], $timeout);
        if ($res['error']) {
            return ['ok' => false, 'error' => 'Gemini request timed out or failed.'];
        }

        if ($res['status'] < 200 || $res['status'] >= 300) {
            $detail = self::extractApiError($res['body']);
            return ['ok' => false, 'error' => 'Gemini API error' . ($detail ? ': ' . $detail : '.')];
        }

        $json = json_decode($res['body'], true);
        if (!is_array($json)) {
            return ['ok' => false, 'error' => 'Invalid Gemini response.'];
        }

        $text = '';
        if (isset($json['candidates'][0]['content']['parts']) && is_array($json['candidates'][0]['content']['parts'])) {
            foreach ($json['candidates'][0]['content']['parts'] as $part) {
                if (isset($part['text'])) {
                    $text .= (string) $part['text'];
                }
            }
        }

        $parsed = ProductResult::parseModelJson($text);
        if ($parsed === null) {
            return ['ok' => false, 'error' => 'Gemini returned invalid JSON.'];
        }

        $result = new ProductResult($parsed, 'gemini');
        if (!$result->isComplete()) {
            return ['ok' => false, 'error' => 'Gemini returned an incomplete result.'];
        }

        return ['ok' => true, 'result' => $result];
    }

    private static function extractApiError(string $body): string
    {
        $json = json_decode($body, true);
        if (is_array($json) && isset($json['error']['message'])) {
            return self::safeError((string) $json['error']['message']);
        }
        return '';
    }

    private static function safeError(string $message): string
    {
        $clean = preg_replace('/(AIza[0-9A-Za-z_-]+|key=[^\s&]+)/i', '[REDACTED]', $message) ?? $message;
        return mb_substr($clean, 0, 180);
    }
}
