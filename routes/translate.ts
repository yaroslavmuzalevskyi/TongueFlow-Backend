import { Router, Request, Response } from "express";
import { translate, GeminiError } from "../services/gemini.js";

const router = Router();

/**
 * POST /translate
 *
 * Request body:
 *   { text: string, target_language: string, style: string, instruction?: string }
 *
 * Response (200):
 *   { translated_text: string }
 *
 * Response (4xx/5xx):
 *   { error: string }
 */
router.post("/translate", async (req: Request, res: Response) => {
  const { text, target_language, style, instruction } = req.body ?? {};

  // Validation
  if (typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "Missing or empty 'text'" });
  }
  if (typeof target_language !== "string" || target_language.length === 0) {
    return res.status(400).json({ error: "Missing 'target_language'" });
  }
  if (typeof style !== "string" || style.length === 0) {
    return res.status(400).json({ error: "Missing 'style'" });
  }
  if (text.length > 2000) {
    return res.status(400).json({ error: "Text too long (max 2000 chars)" });
  }

  try {
    const translated_text = await translate({
      text: text.trim(),
      target: target_language,
      style,
      instruction: typeof instruction === "string" ? instruction : undefined,
    });
    return res.json({ translated_text });
  } catch (err) {
    if (err instanceof GeminiError) {
      console.error(
        `[translate] GeminiError ${err.statusCode}: ${err.message}`,
      );
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(`[translate] unexpected error:`, err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
