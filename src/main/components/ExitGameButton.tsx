import type { JSX } from "react";
import { useNavigate } from "react-router";
import { useAppDispatch } from "../hooks";
import { exitGame } from "../state/gameSlice";

export function ExitGameButton(): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  return (
    <button
      className="secondary-button compact-button"
      onClick={() => {
        dispatch(exitGame());
        navigate("/");
      }}
      type="button"
    >
      Exit game
    </button>
  );
}
