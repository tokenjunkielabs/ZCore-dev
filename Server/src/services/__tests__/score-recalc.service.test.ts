import { describe, expect, it } from "vitest";
import { recalculateUserScore } from "../../services/score-recalc.service";

describe("score-recalc.service", () => {
  it("recomputes score from stellar base, events, and payments", () => {
    const result = recalculateUserScore({
      stellarBase: 120,
      creditEvents: [{ scoreImpact: 15 }, { scoreImpact: 20 }],
      payments: [{ status: "paid" }, { status: "defaulted" }],
    });

    expect(result.score).toBe(135);
    expect(result.profileTier).toBe("C");
    expect(result.eventsTotal).toBe(35);
    expect(result.paymentsTotal).toBe(-20);
  });

  it("excludes disputed credit events from score impact", () => {
    const result = recalculateUserScore({
      stellarBase: 120,
      creditEvents: [
        { scoreImpact: 50, disputed: true },
        { scoreImpact: 25, disputed: false },
      ],
      payments: [],
    });

    expect(result.score).toBe(145);
    expect(result.eventsTotal).toBe(25);
  });
});
