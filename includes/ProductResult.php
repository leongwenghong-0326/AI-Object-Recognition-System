<?php

declare(strict_types=1);

/**
 * Normalized AI recognition result.
 */
final class ProductResult
{
    public string $objectLabel;
    public string $productName;
    public string $manufacturer;
    public string $specification;
    public string $description;
    public string $objectLabelZh;
    public string $productNameZh;
    public string $manufacturerZh;
    public string $specificationZh;
    public string $descriptionZh;
    /** @var array{ymin:int,xmin:int,ymax:int,xmax:int} */
    public array $boundingBox;
    public float $confidence;
    public string $provider;

    /**
     * @param array<string, mixed> $raw
     */
    public function __construct(array $raw, string $provider = 'unknown')
    {
        $this->objectLabel = self::cleanText($raw['objectLabel'] ?? $raw['object_label'] ?? '');
        $this->productName = self::cleanText($raw['productName'] ?? $raw['product_name'] ?? '');
        $this->manufacturer = self::cleanText($raw['manufacturer'] ?? '');
        $this->specification = self::cleanText($raw['specification'] ?? '');
        $this->description = self::cleanText($raw['description'] ?? '');
        $this->objectLabelZh = self::cleanText($raw['objectLabelZh'] ?? $raw['object_label_zh'] ?? '');
        $this->productNameZh = self::cleanText($raw['productNameZh'] ?? $raw['product_name_zh'] ?? '');
        $this->manufacturerZh = self::cleanText($raw['manufacturerZh'] ?? $raw['manufacturer_zh'] ?? '');
        $this->specificationZh = self::cleanText($raw['specificationZh'] ?? $raw['specification_zh'] ?? '');
        $this->descriptionZh = self::cleanText($raw['descriptionZh'] ?? $raw['description_zh'] ?? '');
        $this->boundingBox = self::normalizeBox($raw['boundingBox'] ?? $raw['bounding_box'] ?? null);
        $this->confidence = self::normalizeConfidence($raw['confidence'] ?? 0);
        $this->provider = strtolower(trim($provider));
    }

    public function isComplete(): bool
    {
        return $this->objectLabel !== '' && $this->productName !== '';
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'objectLabel' => $this->objectLabel,
            'productName' => $this->productName,
            'manufacturer' => $this->manufacturer,
            'specification' => $this->specification,
            'description' => $this->description,
            'objectLabelZh' => $this->objectLabelZh,
            'productNameZh' => $this->productNameZh,
            'manufacturerZh' => $this->manufacturerZh,
            'specificationZh' => $this->specificationZh,
            'descriptionZh' => $this->descriptionZh,
            'boundingBox' => $this->boundingBox,
            'confidence' => $this->confidence,
            'provider' => $this->provider,
        ];
    }

    private static function cleanText(mixed $value): string
    {
        if (!is_scalar($value)) {
            return '';
        }
        $text = trim((string) $value);
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        return mb_substr($text, 0, 500);
    }

    /**
     * @return array{ymin:int,xmin:int,ymax:int,xmax:int}
     */
    private static function normalizeBox(mixed $box): array
    {
        $defaults = ['ymin' => 200, 'xmin' => 200, 'ymax' => 800, 'xmax' => 800];
        if (!is_array($box)) {
            return $defaults;
        }

        $ymin = self::coord($box['ymin'] ?? $box['y_min'] ?? null, $defaults['ymin']);
        $xmin = self::coord($box['xmin'] ?? $box['x_min'] ?? null, $defaults['xmin']);
        $ymax = self::coord($box['ymax'] ?? $box['y_max'] ?? null, $defaults['ymax']);
        $xmax = self::coord($box['xmax'] ?? $box['x_max'] ?? null, $defaults['xmax']);

        if ($ymax < $ymin) {
            [$ymin, $ymax] = [$ymax, $ymin];
        }
        if ($xmax < $xmin) {
            [$xmin, $xmax] = [$xmax, $xmin];
        }

        // Ensure a minimum visible box
        if (($ymax - $ymin) < 40) {
            $ymax = min(1000, $ymin + 40);
        }
        if (($xmax - $xmin) < 40) {
            $xmax = min(1000, $xmin + 40);
        }

        return [
            'ymin' => $ymin,
            'xmin' => $xmin,
            'ymax' => $ymax,
            'xmax' => $xmax,
        ];
    }

    private static function coord(mixed $value, int $fallback): int
    {
        if (!is_numeric($value)) {
            return $fallback;
        }
        $n = (float) $value;
        // Accept 0–1 floats and convert to 0–1000
        if ($n >= 0 && $n <= 1) {
            $n = $n * 1000;
        }
        $n = (int) round($n);
        return max(0, min(1000, $n));
    }

    private static function normalizeConfidence(mixed $value): float
    {
        if (!is_numeric($value)) {
            return 0.5;
        }
        $c = (float) $value;
        if ($c > 1 && $c <= 100) {
            $c = $c / 100;
        }
        return max(0.0, min(1.0, $c));
    }

    /**
     * Extract JSON object from messy model text.
     *
     * @return array<string, mixed>|null
     */
    public static function parseModelJson(string $text): ?array
    {
        $text = trim($text);
        if ($text === '') {
            return null;
        }

        // Strip markdown fences
        if (preg_match('/```(?:json)?\s*([\s\S]*?)```/i', $text, $m)) {
            $text = trim($m[1]);
        }

        $decoded = json_decode($text, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        $start = strpos($text, '{');
        $end = strrpos($text, '}');
        if ($start !== false && $end !== false && $end > $start) {
            $slice = substr($text, $start, $end - $start + 1);
            $decoded = json_decode($slice, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }
}
