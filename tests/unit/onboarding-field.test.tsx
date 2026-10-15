import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { fieldIsFilled, fillField, setFieldValue, textFor } from "@/lib/onboarding/field";
import { placeBubble } from "@/lib/onboarding/placement";

afterEach(cleanup);

function Controlled({ initial = "", area = false }: { initial?: string; area?: boolean }) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      {area ? <textarea aria-label="field" value={value} onChange={(e) => setValue(e.target.value)} /> : <input aria-label="field" value={value} onChange={(e) => setValue(e.target.value)} />}
      <output data-testid="state">{value}</output>
    </>
  );
}

describe("Fill for me writes into a controlled field", () => {
  it("updates React state through the native setter and an input event, in an input and a textarea", () => {
    for (const area of [false, true]) {
      render(<Controlled area={area} />);
      const el = screen.getByLabelText("field") as HTMLInputElement;
      setFieldValue(el, "Lloyds");
      expect(screen.getByTestId("state").textContent).toBe("Lloyds");
      expect(el.value).toBe("Lloyds");
      cleanup();
    }
  });

  it("replaces a template's placeholder and keeps the rest of the message", () => {
    const body = "Hello Silvia,\n\nWhat we are doing: [one line to complete before sending]\nNext update at 11:00.";
    render(<Controlled area initial={body} />);
    const el = screen.getByLabelText("field") as HTMLTextAreaElement;
    expect(fillField(el, { fill: "x", replace: "[one line to complete before sending]" }, "Ops renewed the certificate.")).toBe(true);
    expect(screen.getByTestId("state").textContent).toBe("Hello Silvia,\n\nWhat we are doing: Ops renewed the certificate.\nNext update at 11:00.");
    expect(fieldIsFilled(el, { kind: "type", replace: "[one line to complete before sending]" })).toBe(true);
  });

  it("writes the whole text when there is no template", () => {
    render(<Controlled initial="old" />);
    const el = screen.getByLabelText("field") as HTMLInputElement;
    expect(textFor(el, {}, "new")).toBe("new");
    fillField(el, {}, "new");
    expect(screen.getByTestId("state").textContent).toBe("new");
  });

  it("does not write into something that is not a text field", () => {
    render(<button>Resolve</button>);
    expect(fillField(screen.getByRole("button"), {}, "x")).toBe(false);
  });
});

describe("fieldIsFilled", () => {
  it("reads a text field, a radio inside a label, and a select that shows the option", () => {
    const { container } = render(
      <>
        <input aria-label="empty" defaultValue="" />
        <input aria-label="full" defaultValue="Lloyds" />
        <label data-testid="radio">
          <input type="radio" defaultChecked />
          UK CoP / GB
        </label>
        <label data-testid="radio-off">
          <input type="radio" />
          Down
        </label>
        <button role="combobox" aria-controls="x" aria-expanded="false">Partner degraded or unavailable</button>
      </>,
    );
    expect(fieldIsFilled(screen.getByLabelText("empty"), { kind: "type" })).toBe(false);
    expect(fieldIsFilled(screen.getByLabelText("full"), { kind: "type" })).toBe(true);
    expect(fieldIsFilled(screen.getByTestId("radio"), { kind: "pick" })).toBe(true);
    expect(fieldIsFilled(screen.getByTestId("radio-off"), { kind: "pick" })).toBe(false);
    expect(fieldIsFilled(container.querySelector("button")!, { kind: "pick", option: "Partner degraded or unavailable" })).toBe(true);
    expect(fieldIsFilled(container.querySelector("button")!, { kind: "pick", option: "Email" })).toBe(false);
  });
});

describe("placeBubble", () => {
  const bubble = { width: 288, height: 90 };
  const usable = { width: 1280 - 360, height: 800 };
  const inside = (p: { left: number; top: number }) => p.left >= 8 && p.top >= 8 && p.left + bubble.width <= usable.width - 8 && p.top + bubble.height <= usable.height - 8;
  const overlaps = (p: { left: number; top: number }, t: { left: number; top: number; width: number; height: number }) =>
    p.left < t.left + t.width && p.left + bubble.width > t.left && p.top < t.top + t.height && p.top + bubble.height > t.top;

  it("goes to the right of a target with room, level with it", () => {
    const t = { left: 100, top: 300, width: 120, height: 36 };
    const p = placeBubble(t, bubble, usable);
    expect(p.side).toBe("right");
    expect(p.left).toBeGreaterThan(t.left + t.width);
    expect(inside(p)).toBe(true);
  });

  it("goes inside the corner of a target as big as the page, still inside the viewport", () => {
    const t = { left: 40, top: 0, width: 880, height: 1400 };
    const p = placeBubble(t, bubble, usable);
    expect(p.side).toBe("inside");
    expect(inside(p)).toBe(true);
  });

  it("falls to below, left or above when the right is full, and stays inside the viewport without covering the target", () => {
    const targets = [
      { left: 780, top: 300, width: 120, height: 36 }, // against the panel
      { left: 780, top: 20, width: 120, height: 36 }, // top right corner
      { left: 780, top: 740, width: 120, height: 36 }, // bottom right corner
      { left: 10, top: 700, width: 200, height: 40 }, // bottom left
      { left: 300, top: 10, width: 500, height: 600 }, // large
    ];
    for (const t of targets) {
      const p = placeBubble(t, bubble, usable);
      expect(inside(p), JSON.stringify(t)).toBe(true);
      expect(overlaps(p, t), JSON.stringify(t)).toBe(false);
    }
  });
});
