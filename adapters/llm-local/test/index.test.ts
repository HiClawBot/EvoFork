import { describe, expect, it } from "vitest";
import { adapterId, getAdapterStatus } from "../src/index.js";

describe(adapterId, () => {
  it("reports placeholder status", () => {
    expect(getAdapterStatus()).toBe(`${adapterId}: placeholder`);
  });
});
