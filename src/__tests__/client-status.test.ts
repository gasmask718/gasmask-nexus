import { describe, it, expect } from "vitest";
import {
  toClientDisplayStatus,
  CLIENT_STATUS_LABEL,
  isClientActionRequired,
  clientStatusTone,
} from "@/lib/funding/clientStatus";

describe("client-safe status mapping", () => {
  it("maps hub statuses to client display states", () => {
    expect(toClientDisplayStatus("Preparing")).toBe("APPLICATION_PREPARING");
    expect(toClientDisplayStatus("Submitted")).toBe("SUBMITTED");
    expect(toClientDisplayStatus("Approved")).toBe("APPROVED");
    expect(toClientDisplayStatus("Declined")).toBe("DECLINED");
    expect(toClientDisplayStatus("Funded")).toBe("FUNDED");
    expect(toClientDisplayStatus("NEEDS_HUMAN_REVIEW")).toBe("ACTION_REQUIRED");
    expect(toClientDisplayStatus("additional_documents_required")).toBe(
      "ADDITIONAL_DOCUMENTS_REQUIRED",
    );
  });

  it("never throws on unknown or empty input", () => {
    expect(toClientDisplayStatus(null)).toBe("APPLICATION_PREPARING");
    expect(toClientDisplayStatus("")).toBe("APPLICATION_PREPARING");
    expect(toClientDisplayStatus("zzz-unmapped")).toBe("UNDER_REVIEW");
  });

  it("has a label and tone for every display state", () => {
    for (const key of Object.keys(CLIENT_STATUS_LABEL) as Array<
      keyof typeof CLIENT_STATUS_LABEL
    >) {
      expect(CLIENT_STATUS_LABEL[key]).toBeTruthy();
      expect(clientStatusTone(key)).toContain("border-");
    }
  });

  it("flags only client-actionable states", () => {
    expect(isClientActionRequired("ACTION_REQUIRED")).toBe(true);
    expect(isClientActionRequired("ADDITIONAL_DOCUMENTS_REQUIRED")).toBe(true);
    expect(isClientActionRequired("PROFILE_INCOMPLETE")).toBe(true);
    expect(isClientActionRequired("SUBMITTED")).toBe(false);
    expect(isClientActionRequired("FUNDED")).toBe(false);
  });
});
