# TongueFlow Backend

Node.js + TypeScript backend that proxies translation requests from the iOS app
to Google's Gemini API. The Gemini API key lives **only on this server** — never
in the iOS app.

## Architecture

```
iOS keyboard  →  POST /translate  →  YOUR SERVER  →  Gemini API
                                     (.env file)
                                  ↑ API key lives here
```

## 📍 Where to put your Gemini API key

**In the file called `.env`** at the root of this folder (same directory as
`package.json`). The file does NOT exist yet — you need to create it.

### Step 1 — get a free Gemini API key

1. Go to https://aistudio.google.com/apikey
2. Click **Create API key**
3. Copy the key (looks like `AIzaSy...`)

### Step 2 — create the `.env` file

In this folder, copy the example file and fill it in:

```bash
cp .env.example .env
```

Then open `.env` and replace `paste_your_gemini_key_here` with your real key:

```env
GEMINI_API_KEY=AIzaSyABC123_your_real_key_here
PORT=3000
ALLOWED_ORIGINS=*
GEMINI_MODEL=gemini-2.0-flash
```

**Important:** `.env` is in `.gitignore` — it will never be committed to git.
Each environment (your laptop, Railway, production) has its own `.env`.

---

## Run locally

```bash
# 1. Install dependencies
npm install

# 2. Make sure .env exists (see above)

# 3. Start in dev mode (auto-reloads on changes)
npm run dev
```

Server runs at `http://localhost:3000`.

### Test it

```bash
curl -X POST http://localhost:3000/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, how are you?",
    "target_language": "fr",
    "style": "formal"
  }'
```

You should see:

```json
{ "translated_text": "Bonjour, comment allez-vous ?" }
```

Check the server has loaded your key:

```bash
curl http://localhost:3000/health
```

---

## Deploy to Railway (free tier)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial backend"
git branch -M main
git remote add origin https://github.com/yourusername/tongueflow-backend.git
git push -u origin main
```

### 2. Deploy on Railway

1. Go to https://railway.app and sign in
2. Click **New Project** → **Deploy from GitHub repo**
3. Pick your `tongueflow-backend` repo
4. Railway auto-detects Node.js and builds it

### 3. Add the Gemini key as an environment variable

On the Railway project page:

1. Click your service → **Variables** tab
2. Click **+ New Variable**
3. Name: `GEMINI_API_KEY`
4. Value: your Gemini key
5. Optionally also add `GEMINI_MODEL=gemini-2.0-flash`
6. Railway redeploys automatically

### 4. Get your public URL

In the Railway dashboard → **Settings** → **Networking** → **Generate Domain**.
You'll get something like `https://tongueflow-backend-production.up.railway.app`.

### 5. Update the iOS app

In `TongueFlow/Services/TranslationService.swift`, set:

```swift
private let baseURL = "https://tongueflow-backend-production.up.railway.app"
```

That's it — the keyboard now uses your backend.

---

## API

### `POST /translate`

**Request:**

```json
{
  "text": "Hello world",
  "target_language": "fr",
  "style": "formal",
  "instruction": "Make it more polite" // optional, for presets
}
```

**Response (200):**

```json
{ "translated_text": "Bonjour le monde" }
```

**Errors:**

- `400` — invalid input
- `429` — rate limited (60 req/min per IP)
- `502` — Gemini API error
- `504` — timeout

### `GET /health`

Returns server status and whether the API key is loaded.

### `GET /`

Returns `{ name, status }` — useful as a Railway healthcheck.

---

## File structure

```
tongueflow-backend/
├── src/
│   ├── server.ts                ← entry point
│   ├── routes/
│   │   └── translate.ts         ← POST /translate handler
│   └── services/
│       └── gemini.ts            ← Gemini API call + prompt building
├── .env.example                 ← template (committed)
├── .env                         ← YOUR KEY GOES HERE (git-ignored)
├── .gitignore
├── package.json
├── tsconfig.json
├── railway.toml                 ← Railway deploy config
└── README.md
```

---

## Costs

Gemini 2.0 Flash free tier:

- 15 requests / minute
- 1,500 requests / day
- 1 million tokens / day

For an MVP with even hundreds of users this should cost $0.
If you exceed it, paid tier is ~$0.10 per 1M tokens output.
