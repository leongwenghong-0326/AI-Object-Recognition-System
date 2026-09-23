<?php

declare(strict_types=1);

/**
 * Load and persist application configuration securely.
 */
final class AppConfig
{
    private const DEFAULTS = [
        'ai_provider' => 'auto',
        'gemini_api_key' => '',
        'gemini_model' => 'gemini-2.5-flash',
        'gemini_fallback_models' => "gemini-3.6-flash\ngemini-3.5-flash\ngemini-2.5-flash-lite",
        'agnes_api_key' => '',
        'agnes_model' => 'agnes-2.5-flash',
        'agnes_fallback_models' => 'agnes-2.0-flash',
        'agnes_base_url' => 'https://apihub.agnes-ai.com/v1',
        'request_timeout' => 45,
        'db_driver' => 'sqlite',
        'db_host' => '127.0.0.1',
        'db_port' => 3306,
        'db_name' => 'ai_ar_scanner',
        'db_user' => 'root',
        'db_pass' => '',
        'db_enabled' => true,
        'settings_pin' => '',
    ];

    /** @var array<string, mixed> */
    private array $values;

    private string $configPath;
    private string $localPath;

    public function __construct(?string $root = null)
    {
        $root = $root ?? APP_ROOT;
        $this->configPath = $root . '/config/config.php';
        $this->localPath = $root . '/config/settings.local.php';
        $this->values = self::DEFAULTS;

        $example = $root . '/config/config.example.php';
        if (!is_file($this->configPath) && is_file($example)) {
            @copy($example, $this->configPath);
        }

        if (is_file($this->configPath)) {
            $loaded = include $this->configPath;
            if (is_array($loaded)) {
                $this->values = array_merge($this->values, $loaded);
            }
        }

        if (is_file($this->localPath)) {
            $local = include $this->localPath;
            if (is_array($local)) {
                $this->values = array_merge($this->values, $local);
            }
        }

        $this->values['request_timeout'] = max(10, min(120, (int) $this->values['request_timeout']));
        $provider = strtolower((string) $this->values['ai_provider']);
        if (!in_array($provider, ['auto', 'gemini', 'agnes'], true)) {
            $provider = 'auto';
        }
        $this->values['ai_provider'] = $provider;

        $driver = strtolower((string) ($this->values['db_driver'] ?? 'sqlite'));
        if (!in_array($driver, ['sqlite', 'mysql'], true)) {
            $driver = 'sqlite';
        }
        $this->values['db_driver'] = $driver;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->values[$key] ?? $default;
    }

    public function getString(string $key, string $default = ''): string
    {
        $v = $this->get($key, $default);
        return is_scalar($v) ? (string) $v : $default;
    }

    public function getInt(string $key, int $default = 0): int
    {
        return (int) $this->get($key, $default);
    }

    public function getBool(string $key, bool $default = false): bool
    {
        $v = $this->get($key, $default);
        if (is_bool($v)) {
            return $v;
        }
        return filter_var($v, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * Public-safe settings (no secrets).
     *
     * @return array<string, mixed>
     */
    public function publicSettings(): array
    {
        return [
            'ai_provider' => $this->getString('ai_provider', 'auto'),
            'gemini_model' => $this->getString('gemini_model'),
            'gemini_fallback_models' => $this->getString('gemini_fallback_models'),
            'agnes_model' => $this->getString('agnes_model'),
            'agnes_fallback_models' => $this->getString('agnes_fallback_models'),
            'agnes_base_url' => $this->getString('agnes_base_url'),
            'request_timeout' => $this->getInt('request_timeout', 45),
            'db_enabled' => $this->getBool('db_enabled'),
            'db_driver' => $this->getString('db_driver', 'sqlite'),
            'gemini_key_status' => $this->getString('gemini_api_key') !== '' ? 'saved' : 'missing',
            'agnes_key_status' => $this->getString('agnes_api_key') !== '' ? 'saved' : 'missing',
            'has_settings_pin' => $this->getString('settings_pin') !== '',
        ];
    }

    /**
     * Persist editable settings. Empty API key fields keep existing keys.
     *
     * @param array<string, mixed> $input
     */
    public function save(array $input): void
    {
        $provider = strtolower(trim((string) ($input['ai_provider'] ?? $this->getString('ai_provider'))));
        if (!in_array($provider, ['auto', 'gemini', 'agnes'], true)) {
            $provider = 'auto';
        }

        $timeout = (int) ($input['request_timeout'] ?? $this->getInt('request_timeout', 45));
        $timeout = max(10, min(120, $timeout));

        $geminiKey = $this->getString('gemini_api_key');
        if (isset($input['gemini_api_key']) && trim((string) $input['gemini_api_key']) !== '') {
            $geminiKey = trim((string) $input['gemini_api_key']);
        }

        $agnesKey = $this->getString('agnes_api_key');
        if (isset($input['agnes_api_key']) && trim((string) $input['agnes_api_key']) !== '') {
            $agnesKey = trim((string) $input['agnes_api_key']);
        }

        $data = [
            'ai_provider' => $provider,
            'gemini_api_key' => $geminiKey,
            'gemini_model' => trim((string) ($input['gemini_model'] ?? $this->getString('gemini_model'))),
            'gemini_fallback_models' => (string) ($input['gemini_fallback_models'] ?? $this->getString('gemini_fallback_models')),
            'agnes_api_key' => $agnesKey,
            'agnes_model' => trim((string) ($input['agnes_model'] ?? $this->getString('agnes_model'))),
            'agnes_fallback_models' => (string) ($input['agnes_fallback_models'] ?? $this->getString('agnes_fallback_models')),
            'agnes_base_url' => rtrim(trim((string) ($input['agnes_base_url'] ?? $this->getString('agnes_base_url'))), '/'),
            'request_timeout' => $timeout,
            'db_driver' => $this->getString('db_driver', 'sqlite'),
            'db_host' => $this->getString('db_host'),
            'db_port' => $this->getInt('db_port', 3306),
            'db_name' => $this->getString('db_name'),
            'db_user' => $this->getString('db_user'),
            'db_pass' => $this->getString('db_pass'),
            'db_enabled' => $this->getBool('db_enabled'),
            'settings_pin' => $this->getString('settings_pin'),
        ];

        if (isset($input['db_enabled'])) {
            $data['db_enabled'] = filter_var($input['db_enabled'], FILTER_VALIDATE_BOOLEAN);
        }

        $export = "<?php\n\ndeclare(strict_types=1);\n\nreturn " . var_export($data, true) . ";\n";
        if (@file_put_contents($this->localPath, $export, LOCK_EX) === false) {
            throw new RuntimeException('Unable to save settings. Check write permissions on config/.');
        }

        $this->values = array_merge($this->values, $data);
    }

    public function hasAnyApiKey(): bool
    {
        return $this->getString('gemini_api_key') !== '' || $this->getString('agnes_api_key') !== '';
    }

    /**
     * @return list<string>
     */
    public function geminiModels(): array
    {
        $list = [$this->getString('gemini_model')];
        $list = array_merge($list, parse_model_list($this->getString('gemini_fallback_models')));
        return array_values(array_unique(array_filter($list)));
    }

    /**
     * @return list<string>
     */
    public function agnesModels(): array
    {
        $list = [$this->getString('agnes_model')];
        $list = array_merge($list, parse_model_list($this->getString('agnes_fallback_models')));
        return array_values(array_unique(array_filter($list)));
    }
}