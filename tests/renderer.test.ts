import { describe, expect, it, vi } from "vitest";
import { newGame } from "../src/core/newGame";
import { BattleRenderer } from "../src/ui/render/BattleRenderer";

describe("Kuro speech bubble", () => {
  it.each<CanvasTextAlign>(["left", "center", "right", "start", "end"])(
    "keeps text inside the bubble after drawing with %s alignment",
    (inheritedAlignment) => {
      let bubble = { x: 0, width: 0 };
      const drawn: { left: number; right: number }[] = [];
      const width = (text: string) => Array.from(text).length * 12;
      const ctx = {
        textAlign: inheritedAlignment,
        save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(),
        moveTo: vi.fn(), lineTo: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
        measureText: (text: string) => ({ width: width(text) }),
        roundRect: (x: number, _y: number, w: number) => { bubble = { x, width: w }; },
        fillText: (text: string, x: number) => {
          const w = width(text);
          const offset = ctx.textAlign === "center" ? w / 2
            : ctx.textAlign === "right" || ctx.textAlign === "end" ? w : 0;
          drawn.push({ left: x - offset, right: x - offset + w });
        },
      };
      const canvas = { getContext: () => ctx } as unknown as HTMLCanvasElement;
      const renderer = new BattleRenderer(canvas, () => newGame(0, 1));
      const speech = renderer as unknown as {
        drawSay(x: number, y: number, text: string, life: number): void;
      };

      // Strike line, plus a longer line that wraps beside either edge during a dash.
      for (const x of [40, 260]) {
        for (const text of ["收工前最後一爪！", "我瞓陣先，有事唔好叫我。加油！我精神上支持你。"]) {
          ctx.textAlign = inheritedAlignment;
          drawn.length = 0;
          speech.drawSay(x, 180, text, 1.2);
          expect(drawn.length).toBeGreaterThan(0);
          for (const line of drawn) {
            expect(line.left).toBeGreaterThanOrEqual(bubble.x + 8);
            expect(line.right).toBeLessThanOrEqual(bubble.x + bubble.width - 8);
          }
        }
      }
    },
  );
});
