<?php

declare(strict_types=1);

/**
 * Translates scan fields into the selected voice language.
 */
final class TextTranslator
{
    private AppConfig $config;

    public function __construct(AppConfig $config)
    {
        $this->config = $config;
    }

    /**
     * @param array{productName:string,manufacturer:string,specification:string,description:string} $fields
     * @return array{ok:bool, fields?:array<string,string>, error?:string}
     */
    public function translate(array $fields, string $lang): array
    {
        $lang = $this->normalizeLang($lang);
        $prompt = $this->prompt($fields, $lang);

        if ($this->config->getString('gemini_api_key') !== '') {
            foreach ($this->config->geminiModels() as $model) {
                $text = $this->gemini($model, $prompt);
                $parsed = $this->parse($text);
                if ($parsed !== null) {
                    return ['ok' => true, 'fields' => $parsed];
                }
            }
        }

        if ($this->config->getString('agnes_api_key') !== '') {
            foreach ($this->config->agnesModels() as $model) {
                $text = $this->agnes($model, $prompt);
                $parsed = $this->parse($text);
                if ($parsed !== null) {
                    return ['ok' => true, 'fields' => $parsed];
                }
            }
        }

        return ['ok' => false, 'error' => 'Unable to translate the scan result.'];
    }

    public function normalizeLang(string $lang): string
    {
        $code = strtolower(str_replace('_', '-', trim($lang)));
        $allowed = [
            'en', 'zh-cn', 'zh-tw', 'zh-hk', 'it', 'es', 'fr', 'de', 'ja', 'ko', 'pt',
            'nl', 'pl', 'ru', 'hi', 'id', 'th', 'vi', 'tr', 'ar',
        ];
        if (str_starts_with($code, 'zh')) {
            if (str_contains($code, 'tw')) {
                return 'zh-TW';
            }
            if (str_contains($code, 'hk') || str_contains($code, 'yue')) {
                return 'zh-HK';
            }
            return 'zh-CN';
        }
        $base = explode('-', $code)[0] ?? 'en';
        return in_array($base, $allowed, true) ? $base : 'en';
    }

    /**
     * @param array{productName:string,manufacturer:string,specification:string,description:string} $fields
     */
    private function prompt(array $fields, string $lang): string
    {
        $names = [
            'en' => 'English',
            'zh-CN' => 'Simplified Chinese',
            'zh-TW' => 'Traditional Chinese',
            'zh-HK' => 'Cantonese Chinese',
            'it' => 'Italian',
            'es' => 'Spanish',
            'fr' => 'French',
            'de' => 'German',
            'ja' => 'Japanese',
            'ko' => 'Korean',
            'pt' => 'Portuguese',
            'nl' => 'Dutch',
            'pl' => 'Polish',
            'ru' => 'Russian',
            'hi' => 'Hindi',
            'id' => 'Indonesian',
            'th' => 'Thai',
            'vi' => 'Vietnamese',
            'tr' => 'Turkish',
            'ar' => 'Arabic',
        ];
        $name = $names[$lang] ?? 'English';
        $payload = json_encode($fields, JSON_UNESCAPED_UNICODE);
        return "Translate every value into {$name}. Keep brand names unchanged. Do not add facts. "
            . "Return JSON only with keys productName, manufacturer, specification, description.\n"
            . $payload;
    }

    private function gemini(string $model, string $prompt): string
    {
        $key = $this->config->getString('gemini_api_key');
        $url = sprintf(
            'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s',
            rawurlencode($model),
            rawurlencode($key)
        );
        $res = HttpClient::postJson($url, [
            'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
            'generationConfig' => [
                'temperature' => 0.2,
                'maxOutputTokens' => 800,
                'responseMimeType' => 'application/json',
            ],
        ], [], $this->config->getInt('request_timeout', 45));
        if ($res['error'] || $res['status'] < 200 || $res['status'] >= 300) {
            return '';
        }
        $json = json_decode($res['body'], true);
        $text = '';
        $parts = $json['candidates'][0]['content']['parts'] ?? [];
        if (is_array($parts)) {
            foreach ($parts as $part) {
                if (isset($part['text'])) {
                    $text .= (string) $part['text'];
                }
            }
        }
        return $text;
    }

    private function agnes(string $model, string $prompt): string
    {
        $base = rtrim($this->config->getString('agnes_base_url', 'https://apihub.agnes-ai.com/v1'), '/');
        $res = HttpClient::postJson(
            $base . '/chat/completions',
            [
                'model' => $model,
                'messages' => [['role' => 'user', 'content' => $prompt]],
                'temperature' => 0.2,
                'max_tokens' => 800,
            ],
            ['Authorization' => 'Bearer ' . $this->config->getString('agnes_api_key')],
            $this->config->getInt('request_timeout', 45)
        );
        if ($res['error'] || $res['status'] < 200 || $res['status'] >= 300) {
            return '';
        }
        $json = json_decode($res['body'], true);
        return (string) ($json['choices'][0]['message']['content'] ?? '');
    }

    /**
     * @return array{productName:string,manufacturer:string,specification:string,description:string}|null
     */
    private function parse(string $text): ?array
    {
        $text = trim($text);
        if ($text === '') {
            return null;
        }
        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        if ($start === false || $end === false || $end <= $start) {
            return null;
        }
        $json = json_decode(substr($text, $start, $end - $start + 1), true);
        if (!is_array($json)) {
            return null;
        }
        $out = [];
        foreach (['productName', 'manufacturer', 'specification', 'description'] as $key) {
            $out[$key] = mb_substr(trim((string) ($json[$key] ?? '')), 0, 500);
        }
        if ($out['productName'] === '' && $out['description'] === '') {
            return null;
        }
        return $out;
    }
}