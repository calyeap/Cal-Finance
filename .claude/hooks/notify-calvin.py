#!/usr/bin/env python3
"""Phone alert for Calvin when a cloud build needs him.

Wired in .claude/settings.json to three Claude Code hook events:
  PreToolUse[AskUserQuestion] -> NEEDS INPUT      (the build asks Calvin a question)
  PermissionRequest           -> APPROVAL NEEDED  (human permission required)
  StopFailure                 -> FAILED           (turn ended on an API error)

It posts one message to a Slack incoming webhook (env SLACK_WEBHOOK_URL, set on
the cloud environment) with the repo, the status and a clickable session link.

Rules:
- Cloud sessions only (CLAUDE_CODE_REMOTE=true); anywhere else it does nothing.
- Independent reviewer sessions never alert: they report to the builder
  session, and the builder owns every question to Calvin. A reviewer session is
  one whose first prompt starts with the ship REVIEW BRIEF header line
  ("NATIVE CLOUD V1 ... independent reviewer").
- No alert on a plain Stop. Every real stop asks Calvin a native question
  (standing rule), which alerts as NEEDS INPUT. Plain-Stop alerts were 0 useful
  out of 10 on 20 Oct 2026.
- A PermissionRequest for AskUserQuestion is skipped: the question itself
  already alerted.
- Never blocks the build and never changes a permission decision: it prints
  nothing to stdout. A failure exits 1, which Claude Code shows as a
  non-blocking hook error, so problems stay visible.
- Never prints the webhook URL. Diagnostics go to /tmp/notify-calvin.log.
- Python 3 standard library only.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

TIMEOUT_SECONDS = 5
LOG_PATH = "/tmp/notify-calvin.log"
REVIEWER_HEADER = "native cloud v1"  # the REVIEW BRIEF's first line starts with this...
REVIEWER_MARKER = "independent reviewer"  # ...and names the role

STATUS = {
    "PreToolUse": "NEEDS INPUT",
    "PermissionRequest": "APPROVAL NEEDED",
    "StopFailure": "FAILED",
}


def log(line):
    """Append a diagnostics line (never secrets)."""
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(time.strftime("%Y-%m-%dT%H:%M:%S%z ") + line + "\n")
    except OSError:
        pass


def session_link():
    sid = os.environ.get("CLAUDE_CODE_REMOTE_SESSION_ID", "")
    if sid.startswith("cse_"):
        sid = "session_" + sid[len("cse_"):]
    return f"https://claude.ai/code/{sid}" if sid else ""


def repo_name(payload):
    root = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or ""
    return os.path.basename(root.rstrip("/")) or "repo"


def first_line(text, limit=160):
    text = " ".join(str(text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def text_of(content):
    """Plain text from a transcript message's content (string or block list)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(
            block.get("text", "") for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        )
    return ""


def first_prompt(transcript_path):
    """The session's first user prompt, read from the transcript JSONL."""
    try:
        with open(transcript_path, encoding="utf-8") as fh:
            for raw in fh:
                try:
                    entry = json.loads(raw)
                except ValueError:
                    continue
                if not isinstance(entry, dict) or entry.get("isMeta"):
                    continue
                message = entry.get("message")
                if not isinstance(message, dict) or message.get("role") != "user":
                    continue
                text = text_of(message.get("content"))
                if text.strip():
                    return text
    except (OSError, TypeError):
        pass
    return ""


def is_reviewer_session(payload, key):
    """True for an independent reviewer session. Cached per session in /tmp."""
    cache = f"/tmp/notify-calvin-role-{key}"
    try:
        with open(cache, encoding="utf-8") as fh:
            return fh.read().strip() == "reviewer"
    except OSError:
        pass
    prompt = first_prompt(payload.get("transcript_path") or "")
    if not prompt:
        return False  # unknown yet; don't cache, don't silence
    # Only the brief's own header line counts. A builder's /ship skill text also
    # contains the brief, but never as the session's first prompt line.
    header = prompt.strip().splitlines()[0].lower()
    role = "reviewer" if header.startswith(REVIEWER_HEADER) and REVIEWER_MARKER in header else "builder"
    try:
        with open(cache, "w", encoding="utf-8") as fh:
            fh.write(role)
    except OSError:
        pass
    return role == "reviewer"


def detail(event, payload):
    if event == "PreToolUse":
        questions = (payload.get("tool_input") or {}).get("questions") or []
        if questions and isinstance(questions[0], dict):
            return first_line(questions[0].get("question"))
    if event == "PermissionRequest":
        return first_line(f"Wants to run: {payload.get('tool_name', 'a tool')}")
    if event == "StopFailure":
        err = payload.get("error") or payload.get("error_type") or payload.get("reason")
        return first_line(err if isinstance(err, str) else json.dumps(err)) if err else ""
    return ""


def main():
    if os.environ.get("CLAUDE_CODE_REMOTE") != "true":
        return 0

    try:
        payload = json.load(sys.stdin)
    except ValueError:
        payload = {}

    event = payload.get("hook_event_name", "")
    if event not in STATUS:
        return 0
    if event == "PreToolUse" and payload.get("tool_name") != "AskUserQuestion":
        return 0
    if event == "PermissionRequest" and payload.get("tool_name") == "AskUserQuestion":
        return 0  # the question itself already alerted as NEEDS INPUT

    key = os.environ.get("CLAUDE_CODE_REMOTE_SESSION_ID") or payload.get("session_id") or "unknown"
    if is_reviewer_session(payload, key):
        log(f"event={event} skipped=reviewer-session")
        return 0

    webhook = os.environ.get("SLACK_WEBHOOK_URL", "")
    if not webhook:
        log(f"event={event} error=SLACK_WEBHOOK_URL unset")
        print("notify-calvin: SLACK_WEBHOOK_URL is not set on this environment", file=sys.stderr)
        return 1

    status = STATUS[event]
    link = session_link()
    lines = [f"*{repo_name(payload)}* · *{status}*"]
    info = detail(event, payload)
    if info:
        lines.append(info)
    if link:
        lines.append(f"<{link}|Open session>")
    body = json.dumps({"text": "\n".join(lines)}).encode("utf-8")

    req = urllib.request.Request(
        webhook, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            code = resp.status
    except urllib.error.HTTPError as exc:
        code = exc.code
    except (urllib.error.URLError, OSError) as exc:
        log(f"event={event} error=send failed ({type(exc).__name__})")
        print(f"notify-calvin: Slack send failed ({type(exc).__name__})", file=sys.stderr)
        return 1

    log(f"event={event} status={status} slack_http={code}")
    if code != 200:
        print(f"notify-calvin: Slack returned HTTP {code}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # never let the alert break the build
        log(f"error=unexpected {type(exc).__name__}")
        print(f"notify-calvin: unexpected {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
