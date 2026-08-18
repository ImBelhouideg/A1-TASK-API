const OpenAI = require("openai");

// The only file that knows a provider exists. Everything else just calls
// client.chat.completions.create(...) — swapping OpenRouter for Ollama
// (or anything else "OpenAI-compatible") means changing three env vars,
// never this file's callers.
const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
});

module.exports = { client };