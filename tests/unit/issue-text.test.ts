import { describe, expect, it } from "vitest";

import { firstLine, stripLinkedPrefix } from "@/lib/issue-text";

describe("a linked issue's stored description", () => {
  const stored = "Linked to ISS-1043: Lloyds Bank plc UK CoP / GB partner issue.\n\nLloyds CoP responses time out. Payee checks fail.";

  it("loses the pointer to its partner issue when shown", () => {
    expect(stripLinkedPrefix(stored)).toBe("Lloyds CoP responses time out. Payee checks fail.");
  });

  it("leaves every other description alone", () => {
    expect(stripLinkedPrefix("Trade-name payees return No match since this morning.")).toBe("Trade-name payees return No match since this morning.");
    expect(stripLinkedPrefix("Linked to our contract: see below.\n\nMore.")).toBe("Linked to our contract: see below.\n\nMore.");
  });

  it("firstLine() is the first non-empty line without the pointer", () => {
    expect(firstLine(stored)).toBe("Lloyds CoP responses time out. Payee checks fail.");
    expect(firstLine("\n\nSecond paragraph first.\nthird")).toBe("Second paragraph first.");
  });
});
