const fs = require("fs");
const path = require("path");

const QUARANTINE_PATH = path.join(__dirname, "../../logs/quarantine.jsonl");

// Bad output is set aside with the reason, never silently dropped and
// never allowed to crash the request.
function logToQuarantine(entry) {
  fs.mkdirSync(path.dirname(QUARANTINE_PATH), { recursive: true });
  fs.appendFileSync(QUARANTINE_PATH, JSON.stringify(entry) + "\n");
}

module.exports = { logToQuarantine, QUARANTINE_PATH };