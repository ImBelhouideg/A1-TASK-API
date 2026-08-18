// Stage 1: stub mode. When LLM_STUB=1, the route calls this instead of
// the real model. Not a toy — this is how every stage from here gets
// built and restarted fifty times without touching your daily quota.
function stubEnrichResponse() {
  return {
    category: "other",
    priority: "medium",
    confidence: 0.42,
    reason: "Stub mode — no model was called.",
  };
}

module.exports = { stubEnrichResponse };