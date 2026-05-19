import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import translateRouter from "./routes/translate.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ── Middleware ────────────────────────────────────────────────────

// JSON body parsing (keep limit low for translation API)
app.use(express.json({ limit: "32kb" }));

// CORS — mobile apps don't need this strictly, but useful for web testing
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins.includes("*") ? "*" : allowedOrigins,
  }),
);

// Rate limiting — protect against abuse (60 requests / minute per IP)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down" },
});
app.use("/translate", limiter);

// ── Routes ────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
  res.json({ name: "tongueflow-backend", status: "ok" });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    has_gemini_key: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  });
});

app.use("/", translateRouter);

// ── Start ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✓ TongueFlow backend listening on port ${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  GEMINI_API_KEY is NOT set — /translate will fail");
  } else {
    console.log("✓ Gemini API key loaded");
  }
});
