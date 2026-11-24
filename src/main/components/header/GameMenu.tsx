import { type JSX, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "../../hooks";
import { exitGame } from "../../state/gameSlice";
import { paths } from "../../state/routing";
import { ShellIcon } from "./ShellIcon";

/**
 * U1 (Q-R2-15): the hamburger menu at the end of the top bar, in place of "Exit game": Settings
 * (with the sound levels, N9), Save (not built yet, so disabled) and Exit Game, which asks first.
 * Escape or a click outside closes it.
 */
export function GameMenu(): JSX.Element {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: Event): void => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  return (
    <div className="game-menu" ref={root}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-label="Menu"
        className="game-menu-button"
        onClick={() => { setOpen(!open); setConfirming(false); }}
        type="button"
      >
        <ShellIcon name="menu" />
      </button>
      {open ? (
        <div aria-label="Game menu" className="game-menu-list" data-own-escape="true" id={menuId} role="group">
          {confirming ? (
            <div className="exit-confirm" role="group" aria-label="Leave this game?">
              <span>Leave this game?</span>
              <button className="secondary-button compact-button" onClick={() => { dispatch(exitGame()); }} type="button">Leave</button>
              <button className="compact-button" onClick={() => { setConfirming(false); }} type="button">Stay</button>
            </div>
          ) : (
            <>
              <SettingsItem />
              <button aria-describedby={`${menuId}-later`} className="game-menu-item" disabled type="button">
                <ShellIcon name="save" />
                Save
                <small aria-hidden="true" className="game-menu-later" id={`${menuId}-later`}>Coming later</small>
              </button>
              <hr />
              <button className="game-menu-item" data-tone="danger" onClick={() => { setConfirming(true); }} type="button">
                <ShellIcon name="door" />
                Exit Game
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Opens the Settings screen; Back there returns to the game. Mounted only while the menu is open. */
function SettingsItem(): JSX.Element {
  const navigate = useNavigate();
  return (
    <button className="game-menu-item" onClick={() => { void navigate(paths.settings); }} type="button">
      <ShellIcon name="gear" />
      Settings
    </button>
  );
}
