const fs = require("fs");
const path = require("path");
const { client } = require("./client");

const PROMPT_VERSION = "enrich-task-v1";
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "../../prompts/enrich-task-v1.md"),
  "utf-8"
);

// Stage 2: the user's data goes in its own "user" message, JSON-encoded —
// never glued into the system prompt. This keeps a wall between our
// instructions and their content, which matters the moment "title" comes
// from somewhere untrusted (e.g. a scraped record).
async function callModelForEnrich(title) {
  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL,
    temperature: 0.2, // low: we want the same answer for the same input, not creativity
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ title }) },
    ],
  });

  return response.choices[0].message.content;
}

module.exports = { callModelForEnrich, PROMPT_VERSION };