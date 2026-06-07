#!/usr/bin/env node
/**
 * CI security gate.
 *
 * Reads a JSON security scan report and exits non-zero if any finding
 * has level "critical" or "error" (case-insensitive). Lower-severity
 * findings (warn/info) are reported but do not fail the build.
 *
 * Usage:
 *   node scripts/security-gate.mjs path/to/scan.json
 *
 * The CI pipeline is responsible for producing the scan.json artifact
 * (e.g. via the Lovable security scanner or `supabase db lint --output json`).
 * If the file does not exist, the gate is a no-op so local dev is unaffected.
 */
import fs from "node:fs";

const path = process.argv[2] || "security-scan.json";

if (!fs.existsSync(path)) {
  console.log(`[security-gate] No scan report at ${path} — skipping.`);
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(path, "utf8"));
const findings = Array.isArray(report.findings) ? report.findings : [];

const blocking = findings.filter((f) => {
  const lvl = String(f.level || f.severity || "").toLowerCase();
  return lvl === "critical" || lvl === "error" || lvl === "high";
});

console.log(
  `[security-gate] ${findings.length} total findings, ${blocking.length} blocking (critical/error/high).`,
);

if (blocking.length > 0) {
  for (const f of blocking) {
    console.error(`  ✗ [${f.level || f.severity}] ${f.name || f.id}: ${f.description || ""}`);
  }
  process.exit(1);
}

process.exit(0);