<?php

declare(strict_types=1);

/**
 * Agnes Vision provider (OpenAI-compatible chat completions).
 */
final class AgnesVision implements AIProvider
{
    private AppConfig $config;

    public function __construct(AppConfig $config)
    {
        $this->config = $config;
    }

    public function getName(): string
    {
        return 'agnes';
    }

    public function isConfigured(): bool
    {
        return $this->config->getString('agnes_api_key') !== '';
    }

    public function recognize(string $imageBinary, string $mime): array
    {
        if (!$this->isConfigured()) {
            return ['ok' => false, 'error' => 'Agnes API key is not configured.'];
        }

        $models = $this->config->agnesModels();
        if ($models === []) {
            return ['ok' => false, 'error' => 'No Agnes model configured.'];
        }

        $lastError = 'Agnes recognition failed.';
        foreach ($models as $model) {
            $response = $this->callModel($model, $imageBinary, $mime);
            if ($response['ok']) {
                return $response;
            }
            $lastError = $response['error'] ?? $lastError;
            app_log('Agnes model failed: ' . $model . ' — ' . $lastError, 'WARN');
        }

        return ['ok' => false, 'error' => $lastError];
    }

    public function testConnection(): array
    {
        if (!$this->isConfigured()) {
            return ['ok' => false, 'message' => 'API key not configured'];
        }

        $base = rtrim($this->config->getString('agnes_base_url', 'https://apihub.agnes-ai.com/v1'), '/');
        $url = $base . '/models';
        $res = HttpClient::get(
            $url,
            ['Authorization' => 'Bearer ' . $this->config->getString('agnes_api_key')],
            min(20, $this->config->getInt('request_timeout', 45))
        );

        if ($res['error']) {
            // Fallback: tiny chat probe
            return $this->probeChat();
        }

        if ($res['status'] >= 200 && $res['status'] < 300) {
            return ['ok' => true, 'message' => 'Connected'];
        }

        if ($res['status'] === 401 || $res['status'] === 403) {
            return ['ok' => false, 'message' => 'Connection failed: invalid API key'];
        }

        return $this->probeChat();
    }

    /**
     * @return array{ok:bool, message:string}
     */
    private function probeChat(): array
    {
        $base = rtrim($this->config->getString('agnes_base_url', 'https://apihub.agnes-ai.com/v1'), '/');
        $model = $this->config->getString('agnes_model', 'agnes-2.5-flash');
        $payload = [
            'model' => $model,
            'messages' => [
                ['role' => 'user', 'content' => 'Reply with OK only.'],
            ],
            'max_tokens' => 8,
            'temperature' => 0,
        ];

        $res = HttpClient::postJson(
            $base . '/chat/completions',
            $payload,
            ['Authorization' => 'Bearer ' . $this->config->getString('agnes_api_key')],
            min(25, $this->config->getInt('request_timeout', 45))
        );

        if ($res['error']) {
            return ['ok' => false, 'message' => 'Connection failed: network error'];
        }

        if ($res['status'] >= 200 && $res['status'] < 300) {
            return ['ok' => true, 'message' => 'Connected'];
        }

        if ($res['status'] === 401 || $res['status'] === 403) {
            return ['ok' => false, 'message' => 'Connection failed: invalid API key'];
        }

        $detail = self::extractApiError($res['body']);
        return ['ok' => false, 'message' => 'Connection failed' . ($detail ? ': ' . $detail : '')];
    }

    /**
     * @return array{ok:bool, result?:ProductResult, error?:string}
     */
    private function callModel(string $model, string $imageBinary, string $mime): array
    {
        $base = rtrim($this->config->getString('agnes_base_url', 'https://apihub.agnes-ai.com/v1'), '/');
        $timeout = $this->config->getInt('request_timeout', 45);
        $dataUrl = 'data:' . $mime . ';base64,' . base64_encode($imageBinary);

        $payload = [
            'model' => $model,
            'temperature' => 0.2,
            'max_tokens' => 1024,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => VisionPrompt::systemInstruction(),
                ],
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'text',
                            'text' => VisionPrompt::userText(),
                        ],
                        [
                            'type' => 'image_url',
                            'image_url' => [
                                'url' => $dataUrl,
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $res = HttpClient::postJson(
            $base . '/chat/completions',
            $payload,
            ['Authorization' => 'Bearer ' . $this->config->getString('agnes_api_key')],
            $timeout
        );

        if ($res['error']) {
            return ['ok' => false, 'error' => 'Agnes request timed out or failed.'];
        }

        if ($res['status'] < 200 || $res['status'] >= 300) {
            $detail = self::extractApiError($res['body']);
            return ['ok' => false, 'error' => 'Agnes API error' . ($detail ? ': ' . $detail : '.')];
        }

        $json = json_decode($res['body'], true);
        if (!is_array($json)) {
            return ['ok' => false, 'error' => 'Invalid Agnes response.'];
        }

        $text = '';
        if (isset($json['choices'][0]['message']['content'])) {
            $content = $json['choices'][0]['message']['content'];
            if (is_string($content)) {
                $text = $content;
            } elseif (is_array($content)) {
                foreach ($content as $block) {
                    if (is_array($block) && isset($block['text'])) {
                        $text .= (string) $block['text'];
                    }
                }
            }
        }

        $parsed = ProductResult::parseModelJson($text);
        if ($parsed === null) {
            return ['ok' => false, 'error' => 'Agnes returned invalid JSON.'];
        }

        $result = new ProductResult($parsed, 'agnes');
        if (!$result->isComplete()) {
            return ['ok' => false, 'error' => 'Agnes returned an incomplete result.'];
        }

        return ['ok' => true, 'result' => $result];
    }

    private static function extractApiError(string $body): string
    {
        $json = json_decode($body, true);
        if (!is_array($json)) {
            return '';
        }
        $msg = '';
        if (isset($json['error']['message'])) {
            $msg = (string) $json['error']['message'];
        } elseif (isset($json['error']) && is_string($json['error'])) {
            $msg = $json['error'];
        } elseif (isset($json['message'])) {
            $msg = (string) $json['message'];
        }
        $clean = preg_replace('/(Bearer\s+\S+|sk-[A-Za-z0-9_-]+)/i', '[REDACTED]', $msg) ?? $msg;
        return mb_substr($clean, 0, 180);
    }
}
