const express = require('express');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./openapi.json');
const { EnrichInputSchema } = require('./src/llm/schema');
const { stubEnrichResponse } = require('./src/llm/stub');
const { enrichTask } = require('./src/llm/enrich');
const app = express();
app.use(express.json());

// --- Stage 2: in-memory "database" ---
let tasks = [
  { id: 1, title: 'Buy milk', done: false },
  { id: 2, title: 'Write report', done: false },
  { id: 3, title: 'Walk the dog', done: true },
];
let nextId = 4;

// --- Stage 1: root and health ---
app.get('/', (req, res) => {
  res.json({ name: 'Task API', version: '1.0', endpoints: ['/tasks'] });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// --- Stage 2: read ---
app.get('/tasks', (req, res) => {
  res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  res.json(task);
});

// --- Stage 3: create ---
app.post('/tasks', (req, res) => {
  const { title } = req.body || {};
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title is required and must be a non-empty string' });
  }
  const task = { id: nextId++, title, done: false };
  tasks.push(task);
  res.status(201).json(task);
});

// --- Stage 4: update ---
app.put('/tasks/:id', (req, res) => {
  const task = tasks.find((t) => t.id === Number(req.params.id));
  if (!task) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  const { title, done } = req.body || {};
  if (title !== undefined && (!title || typeof title !== 'string')) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }
  if (title !== undefined) task.title = title;
  if (done !== undefined) task.done = done;
  res.json(task);
});

// --- Stage 4: delete ---
app.delete('/tasks/:id', (req, res) => {
  const index = tasks.findIndex((t) => t.id === Number(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  tasks.splice(index, 1);
  res.status(204).end();
});


app.post('/enrich', async (req, res) => {
  const parseResult = EnrichInputSchema.safeParse(req.body || {});
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0];
    return res.status(400).json({ error: `${issue.path.join('.')}: ${issue.message}` });
  }
  const { title } = parseResult.data;

  if (process.env.LLM_STUB === '1') {
    return res.status(200).json(stubEnrichResponse(title));
  }

  const result = await enrichTask(title);
  if (!result.success) {
    return res.status(422).json({ error: result.error });
  }
  return res.status(200).json(result.data);
});
// --- Stage 5: Swagger UI ---
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Swagger UI at http://localhost:${PORT}/docs`);
});
