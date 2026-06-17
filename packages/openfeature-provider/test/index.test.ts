import { describe, expect, it } from "vitest";
import { getModuleStatus, moduleId } from "../src/index.js";

describe(moduleId, () => {
  it("reports placeholder status", () => {
    expect(getModuleStatus()).toEqual({
      name: moduleId,
      status: "placeholder"
    });
  });
});
