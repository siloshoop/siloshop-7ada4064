#!/usr/bin/env node
/**
 * Compare the current security scan against the previous snapshot and report
 * new or newly-elevated findings. Writes a GitHub job summary and sets
 * `has_blocking=true` when any error/critical finding is new.
 *
 * Usage: node scripts/security-diff.mjs <current.json> <previous.json>
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";

const [currentPath, previousPath] = process.argv.slice(2);
if (!currentPath) {
  console.error("Usage: security-diff.mjs <current.json> [previous.json]");
  process.exit(2);
}

const LEVEL_RANK = { info: 0, warn: 1, warning: 1, error: 2, critical: 3 };
const blockingLevels = new Set(["error", "critical"]);

const readScan = (path) => {
  if (!path || !existsSync(path)) return { findings: [] };
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`Failed to parse ${path}:`, err.message);
    return { findings: [] };
  }
};

const normalise = (scan) => {
  const list = Array.isArray(scan) ? scan : scan.findings ?? [];
  return new Map(
    list.map((f) => {
      const key = f.internal_id ?? `${f.id ?? f.name}:${f.description ?? ""}`.slice(0, 200);
      return [key, { key, level: (f.level ?? "info").toLowerCase(), name: f.name ?? f.id ?? key }];
    }),
  );
};

const current = normalise(readScan(currentPath));
const previous = normalise(readScan(previousPath));

const added = [];
const elevated = [];
for (const [key, cur] of current) {
  const prev = previous.get(key);
  if (!prev) {
    added.push(cur);
  } else if ((LEVEL_RANK[cur.level] ?? 0) > (LEVEL_RANK[prev.level] ?? 0)) {
    elevated.push({ ...cur, previousLevel: prev.level });
  }
}

const blocking = [...added, ...elevated].some((f) => blockingLevels.has(f.level));

const summary = [
  "# Security scan diff",
  "",
  `- Current findings: **${current.size}**`,
  `- Previous findings: **${previous.size}**`,
  `- New: **${added.length}**`,
  `- Elevated: **${elevated.length}**`,
  "",
];

const renderRow = (f) => `| ${f.level.toUpperCase()} | ${f.name} | ${f.key} |`;
if (added.length) {
  summary.push("## New findings", "| Level | Name | Id |", "| --- | --- | --- |");
  added.forEach((f) => summary.push(renderRow(f)));
  summary.push("");
}
if (elevated.length) {
  summary.push("## Elevated findings", "| Level | Name | Id | Previous |", "| --- | --- | --- | --- |");
  elevated.forEach((f) => summary.push(`${renderRow(f)} ${f.previousLevel}`));
  summary.push("");
}
if (!added.length && !elevated.length) {
  summary.push("_No new or elevated findings._");
}

const summaryText = summary.join("\n");
console.log(summaryText);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryText + "\n");
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `has_blocking=${blocking}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `new_count=${added.length}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `elevated_count=${elevated.length}\n`);
}

// Refresh the baseline snapshot in-place so subsequent diffs compare against
// this run. CI persists it as an artifact.
if (previousPath) {
  try {
    writeFileSync(previousPath, readFileSync(currentPath));
  } catch (err) {
    console.warn("Could not update snapshot:", err.message);
  }
}

process.exit(0);