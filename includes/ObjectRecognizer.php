<?php

declare(strict_types=1);

/**
 * Orchestrates AI providers (auto / gemini / agnes) and optional web enrichment.
 */
final class ObjectRecognizer
{
    private AppConfig $config;
    private GeminiVision $gemini;
    private AgnesVision $agnes;
    private ProductLookup $lookup;

    public function __construct(AppConfig $config)
    {
        $this->config = $config;
        $this->gemini = new GeminiVision($config);
        $this->agnes = new AgnesVision($config);
        $this->lookup = new ProductLookup();
    }

    /**
     * @return array{ok:bool, result?:ProductResult, error?:string, stage?:string}
     */
    public function recognize(string $imageBinary, string $mime): array
    {
        if (!$this->config->hasAnyApiKey()) {
            return [
                'ok' => false,
                'error' => 'AI provider is not configured.',
                'stage' => 'config',
            ];
        }

        $mode = $this->config->getString('ai_provider', 'auto');
        $errors = [];

        if ($mode === 'gemini') {
            return $this->runSingle($this->gemini, $imageBinary, $mime);
        }

        if ($mode === 'agnes') {
            return $this->runSingle($this->agnes, $imageBinary, $mime);
        }

        // Auto: Gemini first, then Agnes
        if ($this->gemini->isConfigured()) {
            $first = $this->gemini->recognize($imageBinary, $mime);
            if (!empty($first['ok']) && isset($first['result']) && $first['result'] instanceof ProductResult) {
                return $this->withLookup($first['result']);
            }
            $errors[] = $first['error'] ?? 'Gemini failed.';
        } else {
            $errors[] = 'Gemini not configured.';
        }

        if ($this->agnes->isConfigured()) {
            $second = $this->agnes->recognize($imageBinary, $mime);
            if (!empty($second['ok']) && isset($second['result']) && $second['result'] instanceof ProductResult) {
                return $this->withLookup($second['result']);
            }
            $errors[] = $second['error'] ?? 'Agnes failed.';
        } else {
            $errors[] = 'Agnes not configured.';
        }

        return [
            'ok' => false,
            'error' => 'Unable to identify the object.',
            'stage' => 'ai',
            'details' => implode(' | ', $errors),
        ];
    }

    /**
     * @return array{gemini:array{ok:bool,message:string}, agnes:array{ok:bool,message:string}}
     */
    public function testConnections(): array
    {
        return [
            'gemini' => $this->gemini->testConnection(),
            'agnes' => $this->agnes->testConnection(),
        ];
    }

    /**
     * @return array{ok:bool, result?:ProductResult, error?:string, stage?:string}
     */
    private function runSingle(AIProvider $provider, string $imageBinary, string $mime): array
    {
        if (!$provider->isConfigured()) {
            return [
                'ok' => false,
                'error' => ucfirst($provider->getName()) . ' API key is not configured.',
                'stage' => 'config',
            ];
        }

        $response = $provider->recognize($imageBinary, $mime);
        if (empty($response['ok']) || !isset($response['result']) || !($response['result'] instanceof ProductResult)) {
            return [
                'ok' => false,
                'error' => $response['error'] ?? 'Unable to identify the object.',
                'stage' => 'ai',
            ];
        }

        return $this->withLookup($response['result']);
    }

    /**
     * @return array{ok:bool, result:ProductResult, stage:string}
     */
    private function withLookup(ProductResult $result): array
    {
        try {
            $enriched = $this->lookup->enrich($result);
            return ['ok' => true, 'result' => $enriched, 'stage' => 'done'];
        } catch (Throwable $e) {
            app_log('Product lookup skipped: ' . $e->getMessage(), 'WARN');
            return ['ok' => true, 'result' => $result, 'stage' => 'done'];
        }
    }
}
