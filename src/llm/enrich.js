const fs = require("fs");
const path = require("path");
const { client } = require("./client");
const { extractJsonText, tryParseJson } = require("./parse");
const { EnrichOutputSchema } = require("./schema");
const { logToQuarantine } = require("./quarantine");
const { withRetry, isTimeoutError } = require("./retry");
const { logCost } = require("./costLog");

const PROMPT_VERSION = "enrich-task-v1";
const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "../../prompts/enrich-task-v1.md"),
  "utf-8"
);

async function callModelForEnrich(title) {
  const start = Date.now();
  const response = await withRetry(() =>
    client.chat.completions.create({
      model: process.env.LLM_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify({ title }) },
      ],
    })
  );
  const durationMs = Date.now() - start;

  logCost({
    promptVersion: PROMPT_VERSION,
    model: process.env.LLM_MODEL,
    inputTokens: response.usage?.prompt_tokens ?? null,
    outputTokens: response.usage?.completion_tokens ?? null,
    durationMs,
    repaired: false,
  });

  return response.choices[0].message.content;
}

async function callModelForRepair(title, brokenOutput, errorMessage) {
  const start = Date.now();
  const response = await withRetry(() =>
    client.chat.completions.create({
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
    })
  );
  const durationMs = Date.now() - start;

  logCost({
    promptVersion: PROMPT_VERSION,
    model: process.env.LLM_MODEL,
    inputTokens: response.usage?.prompt_tokens ?? null,
    outputTokens: response.usage?.completion_tokens ?? null,
    durationMs,
    repaired: true,
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
  let firstRaw;
  try {
    firstRaw = await callModelForEnrich(title);
  } catch (err) {
    if (isTimeoutError(err)) {
      const timeoutErr = new Error("Model call timed out");
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  }

  const firstResult = parseAndValidate(firstRaw);
  if (firstResult.success) {
    return { success: true, data: firstResult.data, repaired: false };
  }

  let repairRaw;
  try {
    repairRaw = await callModelForRepair(title, firstRaw, firstResult.error);
  } catch (err) {
    if (isTimeoutError(err)) {
      const timeoutErr = new Error("Model call timed out during repair");
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  }

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