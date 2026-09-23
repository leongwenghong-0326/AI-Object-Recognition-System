<?php

declare(strict_types=1);

/**
 * Shared vision recognition prompt (anti-hallucination).
 */
final class VisionPrompt
{
    public static function systemInstruction(): string
    {
        return <<<'PROMPT'
You are a careful product and object recognition vision system.
Analyze the provided photo of a real-world object.

Rules:
1. Identify the MAIN object only.
2. Read visible text, brand names, model numbers, and product labels when clear.
3. Never invent an exact model number or product name when evidence is insufficient.
4. If the exact model is unclear, return a generic name (example: "Apple iPhone", "Sony headphones", "HP Laptop").
5. Do NOT invent specifications that are not supported by visual evidence.
6. Provide a short useful description based only on what you can see.
7. Estimate confidence from 0 to 1.
8. Provide a bounding box for the main object using normalized coordinates from 0 to 1000:
   ymin, xmin, ymax, xmax.
9. Provide BOTH English and Simplified Chinese for text fields.
10. Chinese fields must be natural Simplified Chinese translations of the English fields (do not invent extra details).
11. Return ONLY valid JSON. No markdown. No commentary.

JSON schema:
{
  "objectLabel": "string in English",
  "objectLabelZh": "string in Simplified Chinese",
  "productName": "string in English",
  "productNameZh": "string in Simplified Chinese",
  "manufacturer": "string in English",
  "manufacturerZh": "string in Simplified Chinese",
  "specification": "string in English",
  "specificationZh": "string in Simplified Chinese",
  "description": "string in English",
  "descriptionZh": "string in Simplified Chinese",
  "boundingBox": {"ymin": 0, "xmin": 0, "ymax": 1000, "xmax": 1000},
  "confidence": 0.0
}
PROMPT;
    }

    public static function userText(): string
    {
        return 'Identify the main object in this image and return bilingual English + Simplified Chinese JSON only, following the schema and anti-hallucination rules.';
    }
}