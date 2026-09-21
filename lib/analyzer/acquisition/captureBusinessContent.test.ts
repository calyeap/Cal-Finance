import { describe, it, expect, beforeEach } from "vitest";
import { acquireCompany, __resetAcquisitionCache } from "./provider";

// M9-ITEM5-CONTENT-01 SCOPE item 3 — CAPTURE runs (the acceptance runs read
// committed captures, never live EDGAR) must degrade to an honest, reasoned
// empty state for the Business section rather than inventing content or
// silently falling back to a live-only path. This is the "smallest correct
// fit" chosen over extending the capture shape: Item 1 excerpts are not part
// of the committed capture, and the reason says so plainly.

describe("CAPTURE runs — Business section content", () => {
  beforeEach(() => {
    __resetAcquisitionCache();
  });

  it("MSFT's captured run has no narrative, with a stated, honest reason", async () => {
    const acquired = await acquireCompany("MSFT", { price: null, source: "CAPTURE" });

    expect(acquired.business.narrative).toBeNull();
    expect(acquired.business.unavailableReason).not.toBeNull();
    expect(acquired.business.unavailableReason).toContain("not part of the committed");
  });

  it("OKLO's captured run has no narrative, with a stated, honest reason", async () => {
    const acquired = await acquireCompany("OKLO", { price: null, source: "CAPTURE" });

    expect(acquired.business.narrative).toBeNull();
    expect(acquired.business.unavailableReason).not.toBeNull();
  });
});
