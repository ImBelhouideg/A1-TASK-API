# Task API — A1

A small in-memory CRUD API for managing tasks. Built with Node.js + Express.

## Run it

```powershell
npm install
node app.js
```

Server runs on **http://localhost:3000**. Interactive docs (Swagger UI) at
**http://localhost:3000/docs**.

## Endpoints

| Method | Path | Description | Status codes |
|---|---|---|---|
| GET | `/` | API info | 200 |
| GET | `/health` | Health check | 200 |
| GET | `/tasks` | List all tasks | 200 |
| GET | `/tasks/:id` | Get one task | 200, 404 |
| POST | `/tasks` | Create a task (`{"title": "..."}`) | 201, 400 |
| PUT | `/tasks/:id` | Update a task (`title` and/or `done`) | 200, 400, 404 |
| DELETE | `/tasks/:id` | Delete a task | 204, 404 |

## Try it (PowerShell)

```powershell
Invoke-RestMethod -Uri http://localhost:3000/tasks

Invoke-RestMethod -Uri http://localhost:3000/tasks -Method Post `
  -Body (@{title="Buy milk"} | ConvertTo-Json) -ContentType "application/json"

Invoke-RestMethod -Uri http://localhost:3000/tasks/1 -Method Put `
  -Body (@{done=$true} | ConvertTo-Json) -ContentType "application/json"

Invoke-RestMethod -Uri http://localhost:3000/tasks/1 -Method Delete
```

## Sample `curl -i` output — POST /enrich

Valid input:
curl -i -X POST http://localhost:3000/enrich -H "Content-Type: application/json" -d '{"title":"Fix login crash on iOS"}'

HTTP/1.1 200 OK
{"category":"other","priority":"medium","confidence":0.42,"reason":"Stub mode — no model was called."}

Invalid input (missing title):
curl -i -X POST http://localhost:3000/enrich -H "Content-Type: application/json" -d '{}'

400
{"error":"title: title is required"}

## Sample `curl -i` output — GET /tasks/1 (from A1)
curl -i http://localhost:3000/tasks/1

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Buy milk","done":false}

## What surprised me (Stage 2)

Testing 3 titles, one response ("Update README with setup instructions")
came back as raw text ("User Safety: safe") instead of the expected JSON
object — the free model didn't follow the schema every time, even with a
detailed prompt. This is exactly why Stage 3's parse/validate/repair loop
exists. 

## POST /enrich

Suggests a category and priority for a task, from its title alone. Send a
title, get back a category (bug/feature/chore/docs/other), a priority
(low/medium/high), a confidence score, and a one-sentence reason — all as
clean JSON, never raw model text.

### Example

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

### Job card

See [JOB-CARD.md](./JOB-CARD.md) for the full contract, including the
"must never" rules and the when-unsure behavior.

### Provider

- **Provider:** OpenRouter
- **Model:** `openrouter/free`
- **Swap to a different provider/model:** change `LLM_BASE_URL`,
  `LLM_API_KEY`, `LLM_MODEL` in `.env` — nothing else in the code changes.


### Eval result

**8/8** on the category field (prompt version `enrich-task-v1`), run on
2026-08-21.

```powershell
node scripts/run-eval.js
```

### Cost

One real call:
```json
{"type":"llm_call","timestamp":"2026-08-21T12:29:24.439Z","promptVersion":"enrich-task-v1","model":"openrouter/free","inputTokens":495,"outputTokens":91,"durationMs":3335,"repaired":false}
```

Across the 9 calls in this eval run (8 cases + 1 repair), input tokens
ranged 418–501 (avg ~464) and output tokens ranged 91–689 (avg ~350) —
one case (#5) needed a repair retry, roughly an 11% repair rate on this
run. On `openrouter/free` this costs $0. Estimated on a paid
GPT-4o-mini-class model (~$0.15/1M input + $0.60/1M output tokens):

`10,000 × (464 × $0.00000015 + 350 × $0.0000006)` ≈ **$2.80/day**

### What I'd fix with another day

Output token count varies wildly between calls (91 to 689 tokens for the same schema) and one case needed a repair — with more time I'd try
`response_format` for schema-constrained output (Stretch goal) to make
both the cost and the repair rate more predictable.