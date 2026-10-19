#!/usr/bin/env node
// CF-LEG2-PREFLIGHT-01 (issue #475)
//
// Test helper: evaluates one job's live `if:` expression from a workflow
// file against a supplied event context, so the wiring tests prove what a
// guard actually does instead of only that its text is present. No
// dependencies (the runtime tests run before `npm ci`).
//
// Usage: node workflow-if-eval.js <workflow.yml> <job> '<github context JSON>'
// Prints `true` or `false`. Supports the expression subset these workflows
// use: string/boolean/null/number literals, property paths with `.*`
// object filters, `!`, `==`, `!=`, `&&`, `||`, parentheses, `contains()`
// and `startsWith()`, with GitHub's case-insensitive string comparison.

'use strict';
const fs = require('fs');

function extractIf(text, job) {
  const lines = text.split('\n');
  const start = lines.indexOf(`  ${job}:`);
  if (start < 0) throw new Error(`job not found: ${job}`);
  for (let i = start + 1; i < lines.length && !/^  \S/.test(lines[i]); i++) {
    const m = lines[i].match(/^    if:\s*(.*)$/);
    if (!m) continue;
    if (m[1] !== '>-' && m[1] !== '>' && m[1] !== '|') return m[1];
    const body = [];
    for (let j = i + 1; j < lines.length && (/^      /.test(lines[j]) || lines[j].trim() === ''); j++) {
      body.push(lines[j].trim());
    }
    return body.join(' ');
  }
  throw new Error(`job has no if: ${job}`);
}

function tokenize(src) {
  const re = /\s*(?:('(?:[^']|'')*')|(&&|\|\||==|!=|[!(),])|([A-Za-z_][\w-]*(?:\.(?:\*|[A-Za-z_][\w-]*))*)|(\d+(?:\.\d+)?))/y;
  const out = [];
  let m;
  re.lastIndex = 0;
  while (re.lastIndex < src.length) {
    if (/^\s*$/.test(src.slice(re.lastIndex))) break;
    const at = re.lastIndex;
    m = re.exec(src);
    if (!m || m.index !== at) throw new Error(`cannot tokenize at: ${src.slice(at, at + 30)}`);
    if (m[1] !== undefined) out.push({ t: 'str', v: m[1].slice(1, -1).replace(/''/g, "'") });
    else if (m[2] !== undefined) out.push({ t: 'op', v: m[2] });
    else if (m[3] !== undefined) out.push({ t: 'id', v: m[3] });
    else out.push({ t: 'num', v: Number(m[4]) });
  }
  return out;
}

function lookup(ctx, path) {
  if (path === 'true') return true;
  if (path === 'false') return false;
  if (path === 'null') return null;
  let vals = [ctx];
  let filtered = false;
  for (const part of path.split('.')) {
    if (part === '*') {
      filtered = true;
      vals = vals.flatMap((v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []));
    } else {
      vals = vals.map((v) => (v && typeof v === 'object' && part in v ? v[part] : null));
      if (filtered) vals = vals.filter((v) => v !== null);
    }
  }
  return filtered ? vals : vals[0];
}

const truthy = (v) => !(v === false || v === null || v === 0 || v === '' || Number.isNaN(v));

function looseEq(a, b) {
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  if (typeof a === typeof b) return a === b;
  const na = Number(a), nb = Number(b);
  return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb;
}

function call(name, args) {
  const [a, b] = args;
  if (name === 'contains') {
    if (Array.isArray(a)) return a.some((x) => looseEq(x, b));
    return String(a ?? '').toLowerCase().includes(String(b ?? '').toLowerCase());
  }
  if (name === 'startsWith') return String(a ?? '').toLowerCase().startsWith(String(b ?? '').toLowerCase());
  throw new Error(`unsupported function: ${name}`);
}

function evaluate(src, ctx) {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const take = (v) => {
    const t = toks[i];
    if (!t || (v !== undefined && t.v !== v)) throw new Error(`expected ${v} at token ${i}`);
    i++;
    return t;
  };
  function primary() {
    const t = take();
    if (t.t === 'op' && t.v === '(') { const v = or(); take(')'); return v; }
    if (t.t === 'op' && t.v === '!') return !truthy(primary());
    if (t.t === 'str' || t.t === 'num') return t.v;
    if (t.t === 'id') {
      if (peek() && peek().v === '(') {
        take('(');
        const args = [];
        if (peek().v !== ')') { args.push(or()); while (peek().v === ',') { take(','); args.push(or()); } }
        take(')');
        return call(t.v, args);
      }
      return lookup(ctx, t.v);
    }
    throw new Error(`unexpected token ${JSON.stringify(t)}`);
  }
  function eq() {
    let v = primary();
    while (peek() && (peek().v === '==' || peek().v === '!=')) {
      const op = take().v;
      const r = primary();
      v = op === '==' ? looseEq(v, r) : !looseEq(v, r);
    }
    return v;
  }
  function and() { let v = eq(); while (peek() && peek().v === '&&') { take(); const r = eq(); v = truthy(v) ? r : v; } return v; }
  function or() { let v = and(); while (peek() && peek().v === '||') { take(); const r = and(); v = truthy(v) ? v : r; } return v; }
  const v = or();
  if (i !== toks.length) throw new Error(`trailing tokens at ${i}`);
  return truthy(v);
}

if (require.main === module) {
  const [file, job, ctxJson] = process.argv.slice(2);
  const expr = extractIf(fs.readFileSync(file, 'utf8'), job);
  process.stdout.write(String(evaluate(expr, { github: JSON.parse(ctxJson) })) + '\n');
}

module.exports = { extractIf, evaluate };
