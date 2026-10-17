import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { toStorable } from "./storable";

// CF-AR3-REPRODUCIBLE-RUNS-01 — the identity of a run's inputs (frozen spec
// §14.9 AR0-5, §10.6.2 rule 1): "the same fact snapshot, adopted assumption
// sheet, policy version, code version and recorded judgements always produce
// the same verdict." Each part is named by a fingerprint of its own content,
// so two runs can be shown to share the tuple — or not — without anybody
// having remembered to bump a version number.

/** Canonical JSON: object keys sorted, Decimals tagged (storable.ts), functions dropped. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(toStorable(value)));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (typeof v === "function" || v === undefined) continue;
      out[key] = sortKeys(v);
    }
    return out;
  }
  return value;
}

/** `<label>-sha256:<first 16 hex>` of the canonical JSON of `value`. */
export function fingerprint(label: string, value: unknown): string {
  return `${label}-sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex").slice(0, 16)}`;
}

let cachedCodeVersion: string | null = null;

/**
 * The code version this process computes under: `CAL_FINANCE_CODE_VERSION`
 * where the environment sets one, else the checkout's git HEAD, marked
 * `+dirty` when the working tree differs from it (a SHA alone would then
 * misname the code that ran). "UNKNOWN" where neither is available — never a
 * guessed value. Read once per process: the code cannot change under a
 * running process.
 */
export function codeVersion(): string {
  if (cachedCodeVersion !== null) return cachedCodeVersion;
  const fromEnv = process.env.CAL_FINANCE_CODE_VERSION;
  if (fromEnv !== undefined && fromEnv.trim() !== "") {
    cachedCodeVersion = fromEnv.trim();
    return cachedCodeVersion;
  }
  try {
    const git = (args: string[]) =>
      execFileSync("git", args, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).trim();
    const sha = git(["rev-parse", "HEAD"]);
    const dirty = git(["status", "--porcelain", "--untracked-files=no"]) !== "";
    cachedCodeVersion = dirty ? `${sha}+dirty` : sha;
  } catch {
    cachedCodeVersion = "UNKNOWN";
  }
  return cachedCodeVersion;
}
