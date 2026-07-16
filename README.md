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

## Sample `curl -i` output

<!-- Paste one real curl -i output here, e.g.: -->
```
curl -i http://localhost:3000/tasks/1

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"id":1,"title":"Buy milk","done":false}
```

## Swagger screenshot

<!-- Paste a screenshot of http://localhost:3000/docs here -->

## The mortality experiment

<!-- Create a task, restart the server (Ctrl+C, then node app.js again),
     GET /tasks. Write 2 sentences here about what happened and why. -->
