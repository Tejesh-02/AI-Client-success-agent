import { describe, expect, it } from "vitest";
import { mapLegacyPriorityToSeverity } from "../src/services/severity";

describe("legacy severity mapping", () => {
  it("maps old ticket priorities to ITSM severity", () => {
    expect(mapLegacyPriorityToSeverity("critical")).toBe("critical");
    expect(mapLegacyPriorityToSeverity("high")).toBe("important");
    expect(mapLegacyPriorityToSeverity("medium")).toBe("moderate");
    expect(mapLegacyPriorityToSeverity("low")).toBe("low");
    expect(mapLegacyPriorityToSeverity("unknown")).toBe("moderate");
  });
});
