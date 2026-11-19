import { describe, expect, it, vi } from "vitest";
import { outcomeMedallion } from "../main/assets/outcomes/art";

vi.mock("../main/assets/outcomes/medallionSources", () => {
  const svg = (content: string, viewBox = "-12.5 -12.5 25 25"): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${content}</svg>`;
  return {
    medallionSources: {
      recovered: svg('<circle r="8"/>'),
      demoralized: svg('<circle class="outcome-ring" r="11"/>', "0 0 25"),
      surrendered: svg('<circle class="outcome-ring" r="11"/>', "0 0 a 25")
    }
  };
});

describe("outcome art with broken sources", () => {
  it("refuses a medallion without a ring or a viewBox", () => {
    expect(() => outcomeMedallion("recovered", { ring: "#123456" })).toThrow('Medallion "recovered" has no ring.');
    expect(() => outcomeMedallion("demoralized", { ring: "#123456" })).toThrow('Outcome medallion "demoralized" needs a viewBox.');
    expect(() => outcomeMedallion("surrendered", { ring: "#123456" })).toThrow("needs a viewBox");
  });
});
