import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../main/app";
import { addInfoNotification } from "../main/state/notificationSlice";
import { createAppStore } from "../main/state/store";

function renderWithStore(initialPath = "/"): ReturnType<typeof createAppStore> {
  const store = createAppStore();

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </Provider>
  );

  return store;
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

  it("redirects unknown routes to the start screen", () => {
    renderWithStore("/missing");

    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  });

  it("shows and dismisses app notifications", async () => {
    const user = userEvent.setup();
    const store = renderWithStore();

    act(() => {
      store.dispatch(addInfoNotification("Orders saved."));
    });

    expect(await screen.findByLabelText("Notifications")).toBeVisible();
    expect(screen.getByText("Orders saved.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Orders saved.")).not.toBeInTheDocument();
  });
});
