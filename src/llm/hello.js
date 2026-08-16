// Stage 0 throwaway script. Proves we can get one word out of a model
// from this machine, before building anything real on top of it.
//
// Run with:  node --env-file=.env src/llm/hello.js
//
// Notice: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL are the *only* three
// values that separate a model running on your laptop (Ollama) from one
// running in a datacenter (OpenRouter). That's the whole reason nobody
// should ever hard-code a provider.

const OpenAI = require("openai");

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL,
  apiKey: process.env.LLM_API_KEY,
});

async function main() {
  const res = await client.chat.completions.create({
    model: process.env.LLM_MODEL,
    messages: [{ role: "user", content: "Reply with exactly the word: ready" }],
  });

  console.log(res.choices[0].message.content);
}

main();