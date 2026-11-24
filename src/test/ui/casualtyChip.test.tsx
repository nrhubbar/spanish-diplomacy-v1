import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { CasualtyChip } from "../../main/components/header/CasualtyChip";
import { initialGameState } from "../../main/engine/resolution";
import { faction, spain } from "../support";

afterEach(cleanup);

describe("the casualty chip", () => {
  const scenario = spain();
  const start = initialGameState(scenario);

  it("says none yet at the start", () => {
    render(<CasualtyChip scenario={scenario} state={start} />);
    expect(screen.getByRole("button", { name: "0 casualties: none yet" })).toHaveTextContent("0");
  });

  it("is short, full in its name, and shows each side when tapped", async () => {
    render(<CasualtyChip scenario={scenario} state={{ ...start, casualties: { [faction("north")]: 12_000, [faction("republic")]: 418 } }} />);
    const chip = screen.getByRole("button", { name: "12.4k casualties: 12,418 men" });
    expect(chip).toHaveTextContent("12.4k");
    expect(chip).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Casualties since turn 1" })).toBeNull();
    await userEvent.click(chip);
    const split = screen.getByRole("region", { name: "Casualties since turn 1" });
    expect(within(split).getByRole("row", { name: /^All sides/ })).toHaveTextContent("12,418");
    expect(within(split).getAllByRole("row")).toHaveLength(scenario.factions.length + 1);
    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-expanded", "false");
  });
});
