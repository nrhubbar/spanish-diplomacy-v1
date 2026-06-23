import { describe, expect, it } from "vitest";
import { appSubtitle, appTitle, mountApp, renderApp } from "../app";

describe("renderApp", () => {
  it("renders the app heading and subtitle", () => {
    const root = document.createElement("main");

    renderApp(root);

    expect(root.querySelector("h1")?.textContent).toBe(appTitle);
    expect(root.textContent).toContain(appSubtitle);
  });

  it("does not fail when no root is available", () => {
    expect(() => mountApp(null)).not.toThrow();
  });

  it("mounts into a provided root", () => {
    const root = document.createElement("main");

    mountApp(root);

    expect(root.querySelector("h1")?.textContent).toBe(appTitle);
  });
});
