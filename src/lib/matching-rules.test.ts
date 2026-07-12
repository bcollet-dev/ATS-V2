import { describe, expect, it } from "vitest";
import {
  canCandidateBeMatched,
  canNeedBeMatched,
  deriveCandidateStatusFromPropositions,
  deriveNeedStatusFromPropositions,
  winnerDowngradeReleasesFreeze,
} from "../app/(app)/matching/rules";

describe("matching rules", () => {
  it("allows matching only from candidate admissible and later derived statuses", () => {
    expect(canCandidateBeMatched("to_call")).toBe(false);
    expect(canCandidateBeMatched("in_progress")).toBe(false);
    expect(canCandidateBeMatched("interview")).toBe(false);
    expect(canCandidateBeMatched("pvpp")).toBe(false);
    expect(canCandidateBeMatched("admissible")).toBe(true);
    expect(canCandidateBeMatched("company_interview")).toBe(true);
    expect(canCandidateBeMatched("waiting_fre")).toBe(true);
    expect(canCandidateBeMatched("placed")).toBe(true);
  });

  it("allows matching only from need in progress and later derived statuses", () => {
    expect(canNeedBeMatched("ad_chase")).toBe(false);
    expect(canNeedBeMatched("prospect")).toBe(false);
    expect(canNeedBeMatched("need_in_progress")).toBe(true);
    expect(canNeedBeMatched("interview")).toBe(true);
    expect(canNeedBeMatched("waiting_fre")).toBe(true);
    expect(canNeedBeMatched("client")).toBe(true);
  });

  it("derives the candidate pipeline status from the most advanced active proposition", () => {
    expect(deriveCandidateStatusFromPropositions([])).toBe("admissible");
    expect(deriveCandidateStatusFromPropositions(["cv_sent"])).toBe("admissible");
    expect(deriveCandidateStatusFromPropositions(["cv_sent", "interview"])).toBe("company_interview");
    expect(deriveCandidateStatusFromPropositions(["interview", "waiting_fre"])).toBe("waiting_fre");
    expect(deriveCandidateStatusFromPropositions(["waiting_fre", "placed"])).toBe("placed");
  });

  it("derives the need pipeline status from the most advanced active proposition", () => {
    expect(deriveNeedStatusFromPropositions([])).toBe("need_in_progress");
    expect(deriveNeedStatusFromPropositions(["cv_sent"])).toBe("need_in_progress");
    expect(deriveNeedStatusFromPropositions(["cv_sent", "interview"])).toBe("interview");
    expect(deriveNeedStatusFromPropositions(["interview", "waiting_fre"])).toBe("waiting_fre");
    expect(deriveNeedStatusFromPropositions(["waiting_fre", "placed"])).toBe("client");
  });

  it("releases the freeze only when a winner is downgraded below waiting_fre", () => {
    expect(winnerDowngradeReleasesFreeze(true, "interview")).toBe(true);
    expect(winnerDowngradeReleasesFreeze(true, "cv_sent")).toBe(true);
    expect(winnerDowngradeReleasesFreeze(true, "not_retained")).toBe(true);
    expect(winnerDowngradeReleasesFreeze(true, "waiting_fre")).toBe(false);
    expect(winnerDowngradeReleasesFreeze(true, "placed")).toBe(false);
    expect(winnerDowngradeReleasesFreeze(false, "interview")).toBe(false);
    expect(winnerDowngradeReleasesFreeze(false, "not_retained")).toBe(false);
  });
});
