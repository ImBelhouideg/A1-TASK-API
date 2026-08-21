// Models like to wrap JSON in a code fence, or add "Sure! Here's the
// JSON:" in front. This strips both, so we're left with just the object.

function extractJsonText(rawText) {
  if (!rawText) return null;

  const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1] : rawText;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  return candidate.slice(start, end + 1);
}

function tryParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { extractJsonText, tryParseJson };