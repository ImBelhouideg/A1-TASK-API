# Task API — A1 + A17

A small in-memory CRUD API for managing tasks, extended with an LLM-backed
endpoint that suggests a category and priority for a task from its title.
Built with Node.js + Express.

## Run it

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` and add your real OpenRouter key (see [Provider](#provider)
below). Then:

```powershell
node --env-file=.env app.js
```

Server runs on **http://localhost:3000**. Interactive docs (Swagger UI) at
**http://localhost:3000/docs**.

---

## Part 1 — Task CRUD (A1)

### Endpoints

| Method | Path | Description | Status codes |
|---|---|---|---|
| GET | `/` | API info | 200 |
| GET | `/health` | Health check | 200 |
| GET | `/tasks` | List all tasks | 200 |
| GET | `/tasks/:id` | Get one task | 200, 404 |
| POST | `/tasks` | Create a task (`{"title": "..."}`) | 201, 400 |
| PUT | `/tasks/:id` | Update a task (`title` and/or `done`) | 200, 400, 404 |
| DELETE | `/tasks/:id` | Delete a task | 204, 404 |

### Try it (PowerShell)

```powershell
Invoke-RestMethod -Uri http://localhost:3000/tasks

Invoke-RestMethod -Uri http://localhost:3000/tasks -Method Post `
  -Body (@{title="Buy milk"} | ConvertTo-Json) -ContentType "application/json"

Invoke-RestMethod -Uri http://localhost:3000/tasks/1 -Method Put `
  -Body (@{done=$true} | ConvertTo-Json) -ContentType "application/json"

Invoke-RestMethod -Uri http://localhost:3000/tasks/1 -Method Delete
```

### Sample output — `GET /tasks/1`

```
curl -i http://localhost:3000/tasks/1

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Buy milk","done":false}
```

---

## Part 2 — POST /enrich (A17)

Suggests a category and priority for a task, from its title alone. Send a
title, get back a category (bug/feature/chore/docs/other), a priority
(low/medium/high), a confidence score, and a one-sentence reason — all as
clean, schema-validated JSON. The endpoint never returns raw model text,
even when the model's own answer comes back malformed.

### Example — real model call

```powershell
Invoke-RestMethod -Uri http://localhost:3000/enrich -Method Post `
  -Body (@{title="Fix login crash on iOS"} | ConvertTo-Json) -ContentType "application/json"
```

Response:
```json
{
  "category": "bug",
  "priority": "high",
  "confidence": 0.9,
  "reason": "A crash on login blocks a core user flow and should be fixed urgently."
}
```

Invalid input (missing title) — rejected before any model call is made:
```powershell
Invoke-RestMethod -Uri http://localhost:3000/enrich -Method Post `
  -Body (@{} | ConvertTo-Json) -ContentType "application/json"

# 400
# {"error":"title: title is required"}
```

### Job card

See [JOB-CARD.md](./JOB-CARD.md) for the full contract: input, output
shape, the closed category/priority lists, the "must never" rules, and
the when-unsure behavior.

### Provider

- **Provider:** OpenRouter
- **Model:** `openrouter/free`
- **The 3 env vars to swap provider/model:** `LLM_BASE_URL`,
  `LLM_API_KEY`, `LLM_MODEL` in `.env` — nothing else in the code changes.
  These three values are the only difference between a model running on
  a laptop (Ollama) and one running in a datacenter (OpenRouter).

### Reliability

- **Stub mode** (`LLM_STUB=1`): skips the model entirely, returns a fixed
  schema-valid response — used for developing the endpoint itself without
  spending any quota.
- **Prompt** lives in [`prompts/enrich-task-v1.md`](./prompts/enrich-task-v1.md),
  versioned as a file, not a string in the route.
- **Parse → validate → repair once → quarantine**: a malformed model
  response gets one repair attempt (the model is shown its own error);
  if that also fails, the request returns `422` and the failure is logged
  to `logs/quarantine.jsonl` — the process never crashes.
- **Timeout:** 30s on the client (SDK default is 10 minutes).
- **Retries:** only on timeouts, `429`, and `5xx`, with backoff + jitter.
  Never retried: `400`, `401`, `403` — a bad key stays a bad key.
- **Kill switch** (`LLM_ENABLED=false`): skips the model, returns `503`
  immediately, zero model calls made.
- **Cost log:** one structured JSON line per model call (prompt version,
  model, token counts, duration, whether it needed a repair) — see below.

### What surprised me (Stage 2)

Testing 3 titles with the very first, un-validated version of the
endpoint, one response ("Update README with setup instructions") came
back as raw text ("User Safety: safe") instead of a JSON object — the
free model didn't follow the schema every time, even with a detailed
prompt. That's exactly why Stage 3's parse/validate/repair loop exists,
and it's since caught and repaired at least one similar case for real
(see the eval run below).

### Eval result

**8/8** on the category field (prompt version `enrich-task-v1`), run on
**2026-08-21**.

```powershell
node scripts/run-eval.js
```

One of the 8 cases needed a repair retry (its first answer failed
schema validation) and still passed after repair — proof the Stage 3
loop works on a real failure, not just in theory.

### Cost

One real call, taken from the structured log:
```json
{"type":"llm_call","timestamp":"2026-08-21T12:29:24.439Z","promptVersion":"enrich-task-v1","model":"openrouter/free","inputTokens":495,"outputTokens":91,"durationMs":3335,"repaired":false}
```

Across the 9 calls in this eval run (8 cases + 1 repair), input tokens
ranged 418–501 (avg ~464) and output tokens ranged 91–689 (avg ~350) —
1 repair out of 8 cases, roughly an 11% repair rate on this run. On
`openrouter/free` this costs $0. Estimated on a paid GPT-4o-mini-class
model (~$0.15/1M input + $0.60/1M output tokens):

`10,000 × (464 × $0.00000015 + 350 × $0.0000006)` ≈ **$2.80/day**

### What I'd fix with another day

Output token count varies wildly between calls (91 to 689 tokens for the
same schema) and one case needed a repair — with more time I'd try
`response_format` for schema-constrained output (stretch goal) to make
both the cost and the repair rate more predictable.

---

## Environment variables (`.env.example`)

| Variable | Meaning |
|---|---|
| `LLM_BASE_URL` | Provider's API base URL (OpenRouter or Ollama) |
| `LLM_API_KEY` | API key (OpenRouter) or the literal string `ollama` |
| `LLM_MODEL` | Model ID, e.g. `openrouter/free` |
| `LLM_STUB` | `1` to skip the model and return a fixed fake answer |
| `LLM_ENABLED` | `false` to disable `/enrich` entirely (kill switch) |

## Project structure

```
app.js                      # routes: /tasks (A1) and /enrich (A17)
JOB-CARD.md                  # the /enrich contract, written before any code
prompts/
└── enrich-task-v1.md         # versioned system prompt
src/llm/
├── client.js                  # OpenAI-compatible client, timeout + retries off (custom policy)
├── schema.js                   # Zod input/output schemas, closed lists
├── stub.js                      # stub mode response
├── parse.js                      # strips code fences, extracts JSON
├── retry.js                       # retry policy: timeouts/429/5xx only, backoff+jitter
├── costLog.js                      # structured per-call cost log
├── quarantine.js                    # logs failed records to logs/quarantine.jsonl
└── enrich.js                         # orchestrates call -> parse -> validate -> repair
evals/
└── cases.json                 # 8 hand-labeled test cases
scripts/
└── run-eval.js                 # runs the 8 cases, scores the category field
logs/
└── quarantine.jsonl             # records that failed validation twice
```