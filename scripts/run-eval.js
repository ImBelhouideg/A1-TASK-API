// Runs every case in evals/cases.json against a running server and
// scores the key field (category). Requires Node 20+ (built-in fetch).
//
// Run with (server must already be running, LLM_STUB unset):
//   node scripts/run-eval.js

const fs = require("fs");
const path = require("path");

const casesPath = path.join(__dirname, "../evals/cases.json");
const cases = JSON.parse(fs.readFileSync(casesPath, "utf-8"));

const BASE_URL = process.env.EVAL_BASE_URL || "http://localhost:3000";

async function runEval() {
  let passed = 0;
  const failures = [];

  for (const testCase of cases) {
    try {
      const res = await fetch(`${BASE_URL}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: testCase.title }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        failures.push({
          id: testCase.id,
          title: testCase.title,
          reason: `HTTP ${res.status}: ${body.error || "unknown error"}`,
        });
        continue;
      }

      const data = await res.json();
      const match = data.category === testCase.expected_category;

      if (match) {
        passed += 1;
        console.log(`PASS  #${testCase.id}  "${testCase.title}"  -> ${data.category}`);
      } else {
        failures.push({
          id: testCase.id,
          title: testCase.title,
          expected: testCase.expected_category,
          actual: data.category,
        });
        console.log(
          `FAIL  #${testCase.id}  "${testCase.title}"  -> got "${data.category}", expected "${testCase.expected_category}"`
        );
      }
    } catch (err) {
      failures.push({ id: testCase.id, title: testCase.title, reason: err.message });
      console.log(`ERROR #${testCase.id}  "${testCase.title}"  -> ${err.message}`);
    }
  }

  console.log(`\nScore: ${passed}/${cases.length} on category (key field)`);

  if (failures.length > 0) {
    console.log("\nFailed / errored cases:");
    failures.forEach((f) => console.log(`  #${f.id} "${f.title}":`, f.reason || `expected "${f.expected}", got "${f.actual}"`));
  }
}

runEval();