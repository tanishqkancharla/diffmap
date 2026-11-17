import assert from "node:assert/strict";
import test from "node:test";
import { parseServiceDiagram } from "../services.js";
import { layoutServices, serviceLinks, type Rect } from "./serviceLayout.js";

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

test("message stacks have space separate from services and connectors", async () => {
  const parsed = parseServiceDiagram(`service Client
service Notes
step "Reject"
  Client -> Notes: POST /notes with whitespace-only text
  Notes -> Client: 400 with an error`);
  assert.ok(parsed.ok);
  const links = serviceLinks(parsed.diagram);
  for (const direction of ["RIGHT", "DOWN"] as const) {
    const layout = await layoutServices({
      diagram: parsed.diagram,
      links,
      sizes: new Map([
        ["Client", { width: 137, height: 34 }],
        ["Notes", { width: 239, height: 58 }],
      ]),
      // Two wrapped messages and the gap between them, not one 20px pill.
      labels: new Map([[links[0]!.id, { width: 196, height: 82 }]]),
      direction,
    });
    const label = layout.labels.get(links[0]!.id)!;
    assert.equal(label.width, 196);
    assert.equal(label.height, 82);
    assert.ok(label.x >= 0 && label.y >= 0);
    assert.ok(label.x + label.width <= layout.width);
    assert.ok(label.y + label.height <= layout.height);
    for (const box of layout.boxes.values()) assert.ok(!overlaps(label, box));
    const route = layout.routes.get(links[0]!.id)!;
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1]!;
      const b = route[i]!;
      assert.ok(
        !overlaps(label, {
          x: Math.min(a.x, b.x) - 1,
          y: Math.min(a.y, b.y) - 1,
          width: Math.abs(a.x - b.x) + 2,
          height: Math.abs(a.y - b.y) + 2,
        }),
        `${direction}: connector crosses message text`,
      );
    }
  }
});
