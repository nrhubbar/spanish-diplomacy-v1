import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../main/app";
import { createAppStore } from "../main/state/store";

function renderWithStore(): void {
  render(
    <Provider store={createAppStore()}>
      <App />
    </Provider>
  );
}

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts on the main screen", () => {
    renderWithStore();

    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Start" })).toBeVisible();
  });

  it("opens the counter screen from the start button", async () => {
    const user = userEvent.setup();
    renderWithStore();

    await user.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByRole("heading", { name: "Order Counter" })).toBeVisible();
    expect(screen.getByLabelText("Counter value")).toHaveTextContent("0");
  });

  it("increments and decrements the counter", async () => {
    const user = userEvent.setup();
    renderWithStore();

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Up" }));
    await user.click(screen.getByRole("button", { name: "Up" }));
    await user.click(screen.getByRole("button", { name: "Down" }));

    expect(screen.getByLabelText("Counter value")).toHaveTextContent("1");
  });

  it("returns to the start screen", async () => {
    const user = userEvent.setup();
    renderWithStore();

    await user.click(screen.getByRole("button", { name: "Start" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  });
});
