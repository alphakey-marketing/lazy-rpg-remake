import { describe, expect, it } from "vitest";
import { store } from "../src/ui/store";

describe("cloud save roundtrip", () => {
  it("exportSave → loadSave keep progress", () => {
    store.state.life.bestStage = 77;
    store.state.level = 42;
    const json = store.exportSave();
    store.hardReset();
    expect(store.state.life.bestStage).not.toBe(77);
    store.loadSave(json);
    expect(store.state.life.bestStage).toBe(77);
    expect(store.state.level).toBe(42);
  });
  it("broken json throw, state stay", () => {
    store.state.level = 9;
    expect(() => store.loadSave("{bad")).toThrow();
    expect(store.state.level).toBe(9);
  });
});
