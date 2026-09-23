<?php

declare(strict_types=1);

/**
 * Scan history via PDO (SQLite by default, MySQL optional).
 */
final class ScanHistory
{
    private AppConfig $config;
    private ?PDO $pdo = null;
    private string $driver = 'sqlite';

    public function __construct(AppConfig $config)
    {
        $this->config = $config;
    }

    public function isEnabled(): bool
    {
        return $this->config->getBool('db_enabled') && $this->getPdo() !== null;
    }

    public function save(ProductResult $result): void
    {
        $pdo = $this->getPdo();
        if ($pdo === null) {
            return;
        }

        $sql = 'INSERT INTO scan_history
            (object_label, product_name, manufacturer, specification, description, confidence, provider, created_at)
            VALUES
            (:object_label, :product_name, :manufacturer, :specification, :description, :confidence, :provider, :created_at)';

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':object_label' => $result->objectLabel,
            ':product_name' => $result->productName,
            ':manufacturer' => $result->manufacturer,
            ':specification' => $result->specification,
            ':description' => $result->description,
            ':confidence' => $result->confidence,
            ':provider' => $result->provider,
            ':created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * @return array{items:list<array<string,mixed>>, total:int, page:int, perPage:int}
     */
    public function list(string $search = '', int $page = 1, int $perPage = 20): array
    {
        $pdo = $this->getPdo();
        if ($pdo === null) {
            return ['items' => [], 'total' => 0, 'page' => 1, 'perPage' => $perPage];
        }

        $page = max(1, $page);
        $perPage = max(5, min(50, $perPage));
        $offset = ($page - 1) * $perPage;
        $search = trim($search);

        $where = '';
        $params = [];
        if ($search !== '') {
            $where = 'WHERE product_name LIKE :q OR manufacturer LIKE :q OR object_label LIKE :q';
            $params[':q'] = '%' . $search . '%';
        }

        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM scan_history {$where}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT id, object_label, product_name, manufacturer, specification, description,
                       confidence, provider, created_at
                FROM scan_history
                {$where}
                ORDER BY id DESC
                LIMIT {$perPage} OFFSET {$offset}";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $items = [];
        foreach ($rows as $row) {
            $items[] = $this->mapRow($row);
        }

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function get(int $id): ?array
    {
        $pdo = $this->getPdo();
        if ($pdo === null || $id < 1) {
            return null;
        }

        $stmt = $pdo->prepare(
            'SELECT id, object_label, product_name, manufacturer, specification, description,
                    confidence, provider, created_at
             FROM scan_history WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $this->mapRow($row) : null;
    }

    public function clear(): int
    {
        $pdo = $this->getPdo();
        if ($pdo === null) {
            return 0;
        }
        return (int) $pdo->exec('DELETE FROM scan_history');
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'objectLabel' => (string) $row['object_label'],
            'productName' => (string) $row['product_name'],
            'manufacturer' => (string) $row['manufacturer'],
            'specification' => (string) $row['specification'],
            'description' => (string) $row['description'],
            'confidence' => (float) $row['confidence'],
            'provider' => (string) $row['provider'],
            'createdAt' => (string) $row['created_at'],
        ];
    }

    private function getPdo(): ?PDO
    {
        if ($this->pdo instanceof PDO) {
            return $this->pdo;
        }

        if (!$this->config->getBool('db_enabled')) {
            return null;
        }

        $driver = strtolower($this->config->getString('db_driver', 'sqlite'));
        if (!in_array($driver, ['sqlite', 'mysql'], true)) {
            $driver = 'sqlite';
        }
        $this->driver = $driver;

        try {
            if ($driver === 'mysql') {
                $this->pdo = $this->connectMysql();
            } else {
                $this->pdo = $this->connectSqlite();
            }
            return $this->pdo;
        } catch (Throwable $e) {
            app_log('Database connection failed: ' . $e->getMessage(), 'ERROR');
            return null;
        }
    }

    private function connectSqlite(): PDO
    {
        $dir = APP_ROOT . '/storage';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $path = $dir . '/scan_history.sqlite';
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS scan_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                object_label TEXT NOT NULL DEFAULT "",
                product_name TEXT NOT NULL DEFAULT "",
                manufacturer TEXT NOT NULL DEFAULT "",
                specification TEXT NOT NULL DEFAULT "",
                description TEXT,
                confidence REAL NOT NULL DEFAULT 0,
                provider TEXT NOT NULL DEFAULT "",
                created_at TEXT NOT NULL
            )'
        );
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_scan_created_at ON scan_history(created_at)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_scan_product_name ON scan_history(product_name)');
        return $pdo;
    }

    private function connectMysql(): PDO
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            $this->config->getString('db_host', '127.0.0.1'),
            $this->config->getInt('db_port', 3306),
            $this->config->getString('db_name', 'ai_ar_scanner')
        );

        $pdo = new PDO(
            $dsn,
            $this->config->getString('db_user', 'root'),
            $this->config->getString('db_pass', ''),
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
        return $pdo;
    }
}