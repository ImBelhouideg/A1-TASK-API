const OpenAI = require("openai");

// Stage 4: the SDK defaults to a 10-minute timeout and 2 silent retries —
// both wrong for an HTTP endpoint. We set our own explicit timeout and
// turn off the SDK's own retries (maxRetries: 0) because we implement our
// own retry policy in retry.js, and don't want two retry loops stacking.
const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
  timeout: 30000, // 30s — anything slower gets a 504, not a hung connection
  maxRetries: 0,
});

module.exports = { client };