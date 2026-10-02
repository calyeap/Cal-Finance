// ---------------------------------------------------------------------------
// The one seam between this analyzer and a model.
//
// §13.1.1 forbids building "a generic Intelligence Layer... a reusable
// service, a shared abstraction, or a layer other Calboard modules are
// expected to call. Build the two calls this spec describes and no framework
// around them." So this is not a framework: it is a single function type,
// with one implementation (anthropicCall.ts) and one caller per label below.
//
// CF-ANALYZER-V1-SETTLE-01's CALVIN RULING — REJECT CURRENT PRODUCT SURFACE;
// BUILD ONE SIMPLE COMPLETE RM-BRIEF PROOF (issue #399) amends §13.1.1's count
// for an untuned ticker with no durable analyst-authored scenario bundle: "AI
// may propose initial Bear/Base/Bull scenario drivers from sourced
// facts/anchors" is its own new, bounded purpose — scenarioProposal.ts — never
// a second vote against an analyst's own recorded scenarios (analystInputs.ts
// is still the one resolver; this call is consulted only where it returns
// null). The ruling's own second call ("one brief-writer call may synthesize
// the sourced facts + computed outputs into the human-readable Overview") is
// already met by the existing, ticker-agnostic interpretation call —
// reportAnalysis.ts runs it for any assembled AnalysisResult, this ticker's
// scenario source included — so it is not a fourth label here.
//
// It exists for one reason: §8.5 requires the challenger's payload to be
// isolated BY CONSTRUCTION, and a test cannot prove isolation against a
// network call it cannot see. Passing the call in makes the request an object
// the tests assert on.
// ---------------------------------------------------------------------------

export interface AnalystCallRequest {
  /** Which call this is. Carried for logging and for the tests. */
  label: "interpretation" | "challenger" | "scenarioProposal";
  system: string;
  user: string;
  /** JSON Schema the response must satisfy. */
  responseSchema: Record<string, unknown>;
}

/**
 * Returns the model's parsed JSON response. Shape validation is the caller's
 * job — interpretation.ts and challenger.ts each check their own, because a
 * schema-shaped response can still carry a figure that does not trace.
 */
export type AnalystCall = (request: AnalystCallRequest) => Promise<unknown>;

export class AnalystCallUnavailableError extends Error {
  constructor(reason: string) {
    super(
      `The analyst AI call cannot run: ${reason}. ` +
        `The deterministic analysis is unaffected — §8.1's boundary means the numbers do not depend on this.`
    );
    this.name = "AnalystCallUnavailableError";
  }
}

export class MalformedAnalystResponseError extends Error {
  readonly diagnostic: string;

  constructor(label: string, detail: string) {
    super(`The ${label} call returned a response this analyzer cannot read: ${detail}`);
    this.name = "MalformedAnalystResponseError";
    this.diagnostic = detail;
  }
}

/** Any refusal that can say, to the model, what was wrong with its output. */
function diagnosticOf(err: unknown): string | null {
  const value = (err as { diagnostic?: unknown }).diagnostic;
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * The analyzer's log channel for the AI layer.
 *
 * Written to the stream directly rather than through console.error: Next's
 * development overlay hooks that, and these lines are all designed behaviour —
 * rendering them as a crash makes a working control indistinguishable from a
 * defect. Exported so reportAnalysis writes its own failure line the same way;
 * one place owns the channel.
 */
export function writeAnalystLog(line: string): void {
  process.stderr.write(`[analyzer] ${line}\n`);
}

/**
 * Calls once; on a refusal, tells the model exactly what failed and calls once
 * more. Two attempts, then the refusal stands.
 *
 * THIS IS NOT A REPAIR PASS, and the distinction is the one §10.7 rule 3
 * insists on: "a numeral emitted by [C] is a defect rather than a value to be
 * checked". A refused output is discarded WHOLE — nothing is patched, nothing
 * is salvaged, and no sentence from it survives into the second attempt. What
 * happens is that the same request is asked again with the defects named.
 *
 * Why retry at all: unlike everything else in this analyzer, these calls are
 * not a function of their inputs, so a single unlucky wording would otherwise
 * cost the report its entire prose layer. Why only once: a loop that retries
 * until something passes is selecting for output that satisfies the checker,
 * which is a different objective from output that is true, and the difference
 * would be invisible.
 */
export async function callWithOneRegeneration<T>(
  call: AnalystCall,
  request: AnalystCallRequest,
  interpret: (raw: unknown) => T
): Promise<T> {
  try {
    return interpret(await call(request));
  } catch (err) {
    const diagnostic = diagnosticOf(err);
    if (diagnostic === null) throw err;

    // A refusal the regeneration RECOVERS used to leave no trace at all: the
    // only log line fired when both attempts failed. So the near misses were
    // invisible, and nobody could say how often a check was firing — which is
    // exactly why the recurrence question could not be answered from history.
    // A control that reports its total failures and stays silent about its near
    // misses cannot tell you it is degrading.
    writeAnalystLog(`${request.label} refused, regenerating — ${diagnostic}`);

    const corrected: AnalystCallRequest = {
      ...request,
      user:
        `${request.user}\n\n` +
        `YOUR PREVIOUS ANSWER WAS REFUSED IN FULL AND DISCARDED. It failed on:\n\n  ${diagnostic}\n\n` +
        `Write the whole answer again from the beginning. Do not try to repair the previous one — you cannot ` +
        `see it and it no longer exists. Every figure must be a slot reference from the catalogue above, and ` +
        `no digit may appear anywhere outside one.`,
    };
    const recovered = interpret(await call(corrected));
    writeAnalystLog(`${request.label} regeneration recovered — the second attempt passed every check`);
    return recovered;
  }
}
