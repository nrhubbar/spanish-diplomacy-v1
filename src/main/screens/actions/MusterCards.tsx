import type { JSX, ReactNode } from "react";
import type { MoveMode } from "../../engine/network/reach";
import { glyphs } from "../../presentation/glyphs";
import { type GroupModes, modeLabel, type MusterCard, type SupportCard, type UnitFigures } from "../../presentation/muster";
import { ActionIcon } from "./ActionIcon";

interface FiguresCardProps {
  readonly card: UnitFigures;
  readonly children?: ReactNode;
  /** What the card's works mean here, for screen readers and as a hint. */
  readonly dugInNote?: string;
  /** The name row: the name alone, or with a tick box and travel chips. */
  readonly head: ReactNode;
  readonly ticked?: boolean;
}

/** One unit's card: its name row, then its values, men and works on one line. */
function FiguresCard({ card, children, dugInNote, head, ticked = false }: FiguresCardProps): JSX.Element {
  return (
    <article aria-label={card.name} className="muster-card" data-ticked={ticked}>
      <div className="muster-card-row">{head}</div>
      <div className="muster-card-figures">
        <span className="muster-values">{card.values}</span>
        <span aria-hidden="true" className="muster-strength"><span style={{ width: `${String(Math.round(card.share * 100))}%` }} /></span>
        <span className="muster-men">{card.men}</span>
        {card.dugIn === undefined ? null : (
          <span className="muster-chip muster-dug-in" title={dugInNote}>
            {card.dugIn}
            {dugInNote === undefined ? null : <span className="visually-hidden">{`. ${dugInNote}`}</span>}
          </span>
        )}
      </div>
      {children}
    </article>
  );
}

interface UnitCardProps {
  readonly card: MusterCard;
  readonly chosen: MoveMode;
  readonly onMode: (mode: MoveMode) => void;
  readonly onTick: () => void;
  readonly ticked: boolean;
}

/** A unit that can go: a tick box, and one chip per way it can travel. */
export function UnitCard({ card, chosen, onMode, onTick, ticked }: UnitCardProps): JSX.Element {
  return (
    <FiguresCard
      card={card}
      dugInNote="Leaving gives up its works."
      head={(
        <>
          <label className="muster-card-head">
            <input checked={ticked} onChange={onTick} type="checkbox" />
            <span className="muster-card-name">{card.name}</span>
          </label>
          <div aria-label="Move mode" className="muster-modes" role="group">
            {card.modes.filter((chip) => chip.ok).map((chip) => (
              <button
                aria-pressed={chip.mode === chosen}
                className="muster-chip muster-mode"
                data-mode={chip.mode}
                key={chip.mode}
                onClick={() => { onMode(chip.mode); }}
                type="button"
              >
                <ActionIcon name={chip.mode} />
                {modeLabel(chip.mode)}
              </button>
            ))}
          </div>
        </>
      )}
      ticked={ticked}
    >
      {card.otherOrder === undefined ? null : <p className="muster-note muster-replaces">{`${card.otherOrder}. Ticking this replaces it.`}</p>}
    </FiguresCard>
  );
}

/** A unit defending the target: the same card, with nothing to choose. */
export function DefenderCard({ card }: { readonly card: UnitFigures }): JSX.Element {
  return <FiguresCard card={card} head={<span className="muster-card-name">{card.name}</span>} />;
}

/** One line for a group whose units can't take every mode; the reasons fold out. */
export function GroupModesNote({ modes }: { readonly modes: GroupModes }): JSX.Element {
  return (
    <details className="muster-why">
      <summary>
        {modes.only === undefined ? null : <span>{`${modes.only} `}</span>}
        <span className="muster-why-question">{modes.question}</span>
      </summary>
      <ul>
        {modes.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
    </details>
  );
}

interface SupportRowProps {
  readonly blocked: string | undefined;
  readonly card: SupportCard;
  readonly onTick: () => void;
  readonly ticked: boolean;
}

/** An aircraft that can fly Ground Support over the target. */
export function SupportRow({ blocked, card, onTick, ticked }: SupportRowProps): JSX.Element {
  return (
    <article aria-label={card.name} className="muster-card muster-aircraft" data-ticked={ticked}>
      <label className="muster-card-head" title={blocked}>
        <input checked={ticked} disabled={blocked !== undefined} onChange={onTick} type="checkbox" />
        <span className="muster-card-name">{card.name}</span>
      </label>
      <p className="muster-card-type">{`${card.typeName} ${glyphs.dot} ${card.base}`}</p>
      {card.otherMission === undefined ? null : <p className="muster-note muster-replaces">{`${card.otherMission}. Ticking this replaces it.`}</p>}
      {blocked === undefined ? null : <p className="muster-note">{blocked}</p>}
    </article>
  );
}
