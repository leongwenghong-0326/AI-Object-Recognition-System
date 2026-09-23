<?php

declare(strict_types=1);

/**
 * Contract for AI vision providers.
 */
interface AIProvider
{
    public function getName(): string;

    public function isConfigured(): bool;

    /**
     * @return array{ok:bool, result?:ProductResult, error?:string}
     */
    public function recognize(string $imageBinary, string $mime): array;

    /**
     * Lightweight connectivity check (no secrets returned).
     *
     * @return array{ok:bool, message:string}
     */
    public function testConnection(): array;
}
