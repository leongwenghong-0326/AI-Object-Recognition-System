<?php

declare(strict_types=1);

/**
 * Optional conservative web product enrichment.
 * Only accepts a more specific name when it clearly matches the AI result.
 */
final class ProductLookup
{
    public function enrich(ProductResult $result): ProductResult
    {
        $query = trim($result->manufacturer . ' ' . $result->productName);
        if ($query === '' || mb_strlen($query) < 3) {
            return $result;
        }

        // Skip if already looks specific (contains digits that may be a model)
        if (preg_match('/\d/', $result->productName) && mb_strlen($result->productName) > 8) {
            return $result;
        }

        $snippet = $this->searchSnippet($query);
        if ($snippet === null) {
            return $result;
        }

        $candidate = $this->extractCandidate($snippet, $result);
        if ($candidate === null) {
            return $result;
        }

        if (!$this->isSaferSpecificName($result->productName, $candidate)) {
            return $result;
        }

        $data = $result->toArray();
        $data['productName'] = $candidate;
        if ($result->specification === '' && isset($snippet['description'])) {
            $data['specification'] = mb_substr((string) $snippet['description'], 0, 200);
        }

        return new ProductResult($data, $result->provider);
    }

    /**
     * @return array{title?:string, description?:string}|null
     */
    private function searchSnippet(string $query): ?array
    {
        $url = 'https://api.duckduckgo.com/?q=' . rawurlencode($query)
            . '&format=json&no_redirect=1&no_html=1&skip_disambig=1';

        $res = HttpClient::get($url, ['Accept' => 'application/json'], 12);
        if ($res['error'] || $res['status'] < 200 || $res['status'] >= 300) {
            return null;
        }

        $json = json_decode($res['body'], true);
        if (!is_array($json)) {
            return null;
        }

        $title = trim((string) ($json['Heading'] ?? ''));
        $desc = trim((string) ($json['AbstractText'] ?? ''));

        if ($title === '' && !empty($json['RelatedTopics'][0]['Text'])) {
            $text = (string) $json['RelatedTopics'][0]['Text'];
            $parts = explode(' - ', $text, 2);
            $title = trim($parts[0]);
            $desc = isset($parts[1]) ? trim($parts[1]) : '';
        }

        if ($title === '') {
            return null;
        }

        return ['title' => $title, 'description' => $desc];
    }

    /**
     * @param array{title?:string, description?:string} $snippet
     */
    private function extractCandidate(array $snippet, ProductResult $result): ?string
    {
        $title = trim((string) ($snippet['title'] ?? ''));
        if ($title === '') {
            return null;
        }

        // Reject unrelated topics
        $hay = mb_strtolower($title . ' ' . (string) ($snippet['description'] ?? ''));
        $needles = array_filter([
            mb_strtolower($result->manufacturer),
            mb_strtolower($result->objectLabel),
        ]);

        $matched = false;
        foreach ($needles as $needle) {
            if ($needle !== '' && str_contains($hay, $needle)) {
                $matched = true;
                break;
            }
        }

        $productTokens = preg_split('/\s+/', mb_strtolower($result->productName)) ?: [];
        foreach ($productTokens as $token) {
            if (mb_strlen($token) >= 4 && str_contains($hay, $token)) {
                $matched = true;
                break;
            }
        }

        if (!$matched) {
            return null;
        }

        return mb_substr($title, 0, 120);
    }

    private function isSaferSpecificName(string $current, string $candidate): bool
    {
        $a = mb_strtolower(trim($current));
        $b = mb_strtolower(trim($candidate));
        if ($a === '' || $b === '' || $a === $b) {
            return false;
        }

        // Candidate should be longer / more specific and share key tokens
        if (mb_strlen($b) <= mb_strlen($a)) {
            return false;
        }

        $tokens = preg_split('/\s+/', $a) ?: [];
        $hits = 0;
        foreach ($tokens as $token) {
            if (mb_strlen($token) >= 3 && str_contains($b, $token)) {
                $hits++;
            }
        }

        return $hits >= 1;
    }
}
