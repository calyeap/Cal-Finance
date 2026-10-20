#!/usr/bin/env python3
"""Phone alert for Calvin when a cloud build stops or needs him.

Wired in .claude/settings.json to four Claude Code hook events:
  Stop                        -> STOPPED          (main agent finished responding)
  PreToolUse[AskUserQuestion] -> NEEDS INPUT      (native question raised)
  PermissionRequest           -> APPROVAL NEEDED  (human permission required)
  StopFailure                 -> FAILED           (turn ended on an API error)

It posts one message to a Slack incoming webhook (env SLACK_WEBHOOK_URL, set on
the cloud environment) with the repo, the status and a clickable session link.

Rules:
- Cloud sessions only (CLAUDE_CODE_REMOTE=true); anywhere else it does nothing.
- Never blocks the build and never changes a permission decision: it prints
  nothing to stdout. A failure exits 1, which Claude Code shows as a
  non-blocking hook error, so problems stay visible.
- Never prints the webhook URL.
- One alert per stop: a Stop that lands within DEDUPE_SECONDS of another alert
  in the same session is skipped (e.g. question raised, then the turn ends).
- A Stop whose last message only says it is waiting on its own work (background
  jobs, CI, a reviewer, a check-in) is skipped; one that says it needs Calvin
  still alerts.
- PostToolUse[AskUserQuestion] sends nothing; it records when Calvin answered.
  A Stop within ANSWERED_SECONDS of his answer is skipped: he is at the screen.
- Python 3 standard library only.
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

DEDUPE_SECONDS = 30
ANSWERED_SECONDS = 120
TIMEOUT_SECONDS = 5
LOG_PATH = "/tmp/notify-calvin.log"

# A Stop whose last message says the session is only waiting on its own work
# (background jobs, CI, a reviewer, a scheduled check-in) is not a real stop:
# nothing needs Calvin, so it stays silent. A message that says it needs Calvin
# always alerts, even if it also mentions waiting.
NEEDS_CALVIN = re.compile(
    r"NEED(S)? YOU|CALVIN REQUIRED|BLOCKED:|need(s)? your (input|decision|approval|call|go)"
    r"|your call|approve|\?\s*$",
    re.IGNORECASE,
)
WAITING_ON_SELF = re.compile(
    r"\bwaiting\b|\bwait (for|on|until)\b|still running|in the background|background (job|task|run|check)"
    r"|\bi'?ll (continue|resume|check|report|be back|pick (it|this) up|follow up)"
    r"|\bi will (continue|resume|check|report)"
    r"|\bwill (continue|resume|report back) (when|once|after)"
    r"|\bonce (ci|the (ci|checks?|run|reviewer|review|build|jobs?|tests?))"
    r"|\b(ci|checks?|tests?|reviewer|review|build) (is|are) (still )?(running|pending|in progress)"
    r"|check(ing)? back|check-in|scheduled (a )?(wake|check)|\bpolling\b|\bmonitoring\b",
    re.IGNORECASE,
)


def only_waiting_on_self(message):
    text = str(message or "")
    return bool(WAITING_ON_SELF.search(text)) and not NEEDS_CALVIN.search(text)

STATUS = {
    "Stop": "STOPPED",
    "PreToolUse": "NEEDS INPUT",
    "PermissionRequest": "APPROVAL NEEDED",
    "StopFailure": "FAILED",
}


def log(line):
    """Append a diagnostics line (never secrets) to the session's log file."""
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
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
    if event == "Stop":
        return first_line(payload.get("last_assistant_message"))
    return ""


def state_path(key):
    return f"/tmp/notify-calvin-{key}.json"


def load_state(key):
    try:
        with open(state_path(key), encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def save_state(key, state):
    try:
        with open(state_path(key), "w", encoding="utf-8") as fh:
            json.dump(state, fh)
    except OSError:
        pass


def skip_reason(event, key):
    """Why this alert should not be sent, or "" to send. Records sent alerts."""
    now = time.time()
    state = load_state(key)
    if event == "Stop":
        if now - float(state.get("alert_ts", 0)) < DEDUPE_SECONDS:
            return "duplicate"
        if now - float(state.get("answered_ts", 0)) < ANSWERED_SECONDS:
            return "calvin-just-answered"
    state.update({"alert_event": event, "alert_ts": now})
    save_state(key, state)
    return ""


def main():
    if os.environ.get("CLAUDE_CODE_REMOTE") != "true":
        return 0

    try:
        payload = json.load(sys.stdin)
    except ValueError:
        payload = {}

    event = payload.get("hook_event_name", "")
    key = os.environ.get("CLAUDE_CODE_REMOTE_SESSION_ID") or payload.get("session_id") or "unknown"

    if event == "PostToolUse" and payload.get("tool_name") == "AskUserQuestion":
        state = load_state(key)
        state["answered_ts"] = time.time()
        save_state(key, state)
        log("event=PostToolUse recorded=answered")
        return 0
    if event not in STATUS:
        return 0
    if event == "PreToolUse" and payload.get("tool_name") != "AskUserQuestion":
        return 0
    if event == "PermissionRequest" and payload.get("tool_name") == "AskUserQuestion":
        return 0  # the question itself already alerted as NEEDS INPUT
    if event == "Stop" and payload.get("stop_hook_active"):
        return 0  # another Stop hook kept the agent going; it has not really stopped
    if event == "Stop" and only_waiting_on_self(payload.get("last_assistant_message")):
        log("event=Stop skipped=waiting-on-self")
        return 0

    log(f"event={event} keys={sorted(payload.keys())}")

    reason = skip_reason(event, key)
    if reason:
        log(f"event={event} skipped={reason}")
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
        reason = getattr(exc, "reason", exc)
        log(f"event={event} error=send failed ({type(exc).__name__}: {reason})")
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
