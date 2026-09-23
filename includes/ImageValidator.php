<?php

declare(strict_types=1);

/**
 * Validate and decode Base64 camera images.
 */
final class ImageValidator
{
    private const MAX_BYTES = 8_000_000; // decoded size limit
    private const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    /**
     * @return array{ok:bool, error?:string, binary?:string, mime?:string, width?:int, height?:int}
     */
    public function validateBase64(string $input): array
    {
        $raw = trim($input);
        if ($raw === '') {
            return ['ok' => false, 'error' => 'Empty image data.'];
        }

        $mime = 'image/jpeg';
        if (preg_match('#^data:(image/[a-zA-Z0-9.+-]+);base64,#i', $raw, $m)) {
            $mime = strtolower($m[1]);
            $raw = substr($raw, strlen($m[0]));
        }

        $raw = preg_replace('/\s+/', '', $raw) ?? '';
        if ($raw === '' || !preg_match('#^[A-Za-z0-9+/]+={0,2}$#', $raw)) {
            return ['ok' => false, 'error' => 'Invalid Base64 image data.'];
        }

        $binary = base64_decode($raw, true);
        if ($binary === false || $binary === '') {
            return ['ok' => false, 'error' => 'Unable to decode image data.'];
        }

        if (strlen($binary) > self::MAX_BYTES) {
            return ['ok' => false, 'error' => 'Image is too large.'];
        }

        $info = @getimagesizefromstring($binary);
        if ($info === false || empty($info['mime'])) {
            return ['ok' => false, 'error' => 'File is not a valid image.'];
        }

        $detected = strtolower((string) $info['mime']);
        if (!in_array($detected, self::ALLOWED_MIMES, true)) {
            return ['ok' => false, 'error' => 'Unsupported image type. Use JPEG, PNG, or WebP.'];
        }

        // Prefer detected MIME over data-URI claim
        $mime = $detected === 'image/jpg' ? 'image/jpeg' : $detected;

        $width = (int) ($info[0] ?? 0);
        $height = (int) ($info[1] ?? 0);
        if ($width < 16 || $height < 16) {
            return ['ok' => false, 'error' => 'Image is too small to analyze.'];
        }

        return [
            'ok' => true,
            'binary' => $binary,
            'mime' => $mime,
            'width' => $width,
            'height' => $height,
        ];
    }
}
