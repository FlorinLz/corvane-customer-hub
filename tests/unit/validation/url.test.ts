import { describe, expect, it } from "vitest";

import { checkDocLink, docLinkError } from "@/lib/validation/url";

const APPROVED = ["docs.corvane-internal.example"];

describe("checkDocLink (brief 3.4.1, M12 AC7, M13 AC2)", () => {
  it("requires https", () => {
    expect(checkDocLink("http://docs.corvane-internal.example/x.pdf", APPROVED)).toBe("not_https");
  });

  it("requires an approved host", () => {
    expect(checkDocLink("https://drive.example.com/x.pdf", APPROVED)).toBe("host_not_approved");
    expect(docLinkError("host_not_approved")).toBe("Use a link to approved document storage");
  });

  it("accepts an https link on an approved host", () => {
    expect(checkDocLink("https://docs.corvane-internal.example/adyen/licence-2026.pdf", APPROVED)).toBe("ok");
  });

  it("rejects an unparseable URL", () => {
    expect(checkDocLink("not a url", APPROVED)).toBe("invalid");
  });

  it("rejects a link over 2,048 characters", () => {
    const long = "https://docs.corvane-internal.example/" + "a".repeat(2048);
    expect(checkDocLink(long, APPROVED)).toBe("too_long");
  });

  it("host matching is case-insensitive", () => {
    expect(checkDocLink("https://DOCS.corvane-internal.example/x.pdf", APPROVED)).toBe("ok");
  });
});
