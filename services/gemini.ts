/**
 * Gemini service — calls Google's generateContent endpoint
 * and returns clean translated text.
 */

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  de: "German",
  ru: "Russian",
  lb: "Luxembourgish",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  uk: "Ukrainian",
  tr: "Turkish",
  ar: "Arabic",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  hi: "Hindi",
};

export interface TranslateInput {
  text: string;
  target: string; // language code, e.g. "fr"
  style: string; // tone, e.g. "formal"
  instruction?: string; // optional preset instruction, e.g. "Make shorter"
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export async function translate(input: TranslateInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY not configured on server", 500);
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const targetName = LANGUAGE_NAMES[input.target] || input.target;
  const prompt = buildPrompt(
    input.text,
    targetName,
    input.style,
    input.instruction,
  );

  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  };

  // Retry on transient 429/503 (Gemini "high demand") with backoff.
  const maxAttempts = 3;
  const retryDelaysMs = [600, 1500];
  let response: Response | undefined;
  let lastErrorText = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        throw new GeminiError("Translation timed out", 504);
      }
      throw new GeminiError(`Network error: ${err.message}`, 502);
    }
    clearTimeout(timeout);

    if (response.ok) break;

    const retriable = response.status === 503 || response.status === 429;
    if (retriable && attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, retryDelaysMs[attempt - 1]));
      continue;
    }

    lastErrorText = await response.text().catch(() => "");
    if (response.status === 400) {
      throw new GeminiError("Invalid request to Gemini", 502);
    }
    if (response.status === 429) {
      throw new GeminiError("Rate limited by Gemini", 429);
    }
    if (response.status === 503) {
      throw new GeminiError("Gemini temporarily unavailable", 503);
    }
    throw new GeminiError(
      `Gemini error ${response.status}: ${lastErrorText.slice(0, 200)}`,
      502,
    );
  }

  const data = (await response!.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== "string") {
    throw new GeminiError("Empty response from Gemini", 502);
  }

  return cleanResponse(text);
}

function buildPrompt(
  text: string,
  targetLang: string,
  style: string,
  instruction?: string,
): string {
  if (instruction) {
    return `You are a professional translator and writing assistant.

${instruction} and translate to ${targetLang}.
Use a ${style} tone.

IMPORTANT RULES:
- Return ONLY the final translated/rewritten text
- Do NOT include any explanations, notes, or alternatives
- Do NOT wrap the result in quotes
- Preserve the original meaning
- Make it sound natural in ${targetLang}

Text: ${text}`;
  }

  return `You are a professional translator.

Translate the following text to ${targetLang}.
Use a ${style} tone and style.

IMPORTANT RULES:
- Return ONLY the translated text
- Do NOT include any explanations, notes, alternatives, or the original text
- Do NOT wrap the result in quotes
- Preserve the original meaning
- Make it sound natural and fluent in ${targetLang}
- Adapt idioms and expressions appropriately

Text: ${text}`;
}

function cleanResponse(text: string): string {
  let result = text.trim();

  // Strip wrapping quotes
  if (
    (result.startsWith('"') && result.endsWith('"')) ||
    (result.startsWith("'") && result.endsWith("'"))
  ) {
    result = result.slice(1, -1).trim();
  }

  // Strip "Translation:" / "Result:" / etc. prefixes
  const prefixes = [
    "Translation:",
    "Translated text:",
    "Result:",
    "Here is the translation:",
  ];
  for (const prefix of prefixes) {
    if (result.toLowerCase().startsWith(prefix.toLowerCase())) {
      result = result.slice(prefix.length).trim();
    }
  }

  return result;
}
