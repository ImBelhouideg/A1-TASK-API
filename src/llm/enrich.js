const fs = require("fs");
const path = require("path");
const { client } = require("./client");
const { extractJsonText, tryParseJson } = require("./parse");
const { EnrichOutputSchema } = require("./schema");
const { logToQuarantine } = require("./quarantine");

const PROMPT_VERSION = "enrich-task-v1";
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "../../prompts/enrich-task-v1.md"),
  "utf-8"
);

async function callModelForEnrich(title) {
  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ title }) },
    ],
  });

  return response.choices[0].message.content;
}

async function callModelForRepair(title, brokenOutput, errorMessage) {
  const response = await client.chat.completions.create({
    model: process.env.LLM_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ title }) },
      { role: "assistant", content: brokenOutput || "" },
      {
        role: "user",
        content: `Your previous answer was rejected for this reason: ${errorMessage}. Return only corrected JSON matching the schema.`,
      },
    ],
  });

  return response.choices[0].message.content;
}

function parseAndValidate(rawText) {
  const jsonText = extractJsonText(rawText);
  if (!jsonText) {
    return { success: false, error: "No JSON object found in model output" };
  }

  const parsed = tryParseJson(jsonText);
  if (!parsed.ok) {
    return { success: false, error: `Invalid JSON: ${parsed.error}` };
  }

  const validated = EnrichOutputSchema.safeParse(parsed.value);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    return {
      success: false,
      error: `Schema validation failed: ${issue.path.join(".")} - ${issue.message}`,
    };
  }

  return { success: true, data: validated.data };
}

async function enrichTask(title) {
  const firstRaw = await callModelForEnrich(title);
  const firstResult = parseAndValidate(firstRaw);

  if (firstResult.success) {
    return { success: true, data: firstResult.data, repaired: false };
  }

  const repairRaw = await callModelForRepair(title, firstRaw, firstResult.error);
  const repairResult = parseAndValidate(repairRaw);

  if (repairResult.success) {
    return { success: true, data: repairResult.data, repaired: true };
  }

  logToQuarantine({
    timestamp: new Date().toISOString(),
    input: { title },
    promptVersion: PROMPT_VERSION,
    firstRaw,
    firstError: firstResult.error,
    repairRaw,
    repairError: repairResult.error,
  });

  return { success: false, error: repairResult.error };
}

module.exports = { callModelForEnrich, callModelForRepair, parseAndValidate, enrichTask, PROMPT_VERSION };