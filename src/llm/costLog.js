// Stage 4: "you cannot manage what you do not measure." One structured
// line per model call, to stdout — the environment routes logs, this
// file doesn't invent a log file (Twelve-Factor App, Logs).
function logCost({ promptVersion, model, inputTokens, outputTokens, durationMs, repaired }) {
  console.log(
    JSON.stringify({
      type: "llm_call",
      timestamp: new Date().toISOString(),
      promptVersion,
      model,
      inputTokens,
      outputTokens,
      durationMs,
      repaired,
    })
  );
}

module.exports = { logCost };