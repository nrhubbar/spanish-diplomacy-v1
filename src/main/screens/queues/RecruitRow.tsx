import { type JSX, type ReactNode, useMemo } from "react";
import { EconomyIcon, resourceIcon } from "../../components/economy/EconomyIcon";
import type { FactionId, Scenario, UnitTypeId } from "../../engine/types";
import { useMapAssets } from "../../hooks";
import { prepareSymbol } from "../../map/markup";
import type { ResourceCell } from "../../presentation/recruitment";

interface UnitSymbolProps {
  readonly factionId: FactionId;
  readonly scenario: Scenario;
  readonly typeId: UnitTypeId;
}

/** A unit type's map symbol in its faction's colour. It repeats the name beside it, so it is hidden from screen readers. */
export function UnitSymbol({ factionId, scenario, typeId }: UnitSymbolProps): JSX.Element {
  const source = useMapAssets(scenario.id)?.unitSymbols.get(typeId);
  const color = scenario.index.factions.get(factionId)?.color ?? "#000";
  const markup = useMemo(() => (source === undefined ? "" : prepareSymbol(source, color)), [color, source]);
  return <span aria-hidden="true" className="recruit-symbol" dangerouslySetInnerHTML={{ __html: markup }} />;
}

/** Amounts of resources as icons and numbers, named for screen readers: one line, however large the amounts. */
export function ResourceCells({ cells, scenario }: { readonly cells: readonly ResourceCell[]; readonly scenario: Scenario }): JSX.Element {
  return (
    <>
      {cells.map((cell) => (
        <span className="recruit-cell" key={cell.id} title={cell.name}>
          <EconomyIcon name={resourceIcon(scenario, cell.id)} />
          {cell.text}
          <span className="visually-hidden">{` ${cell.name} `}</span>
        </span>
      ))}
    </>
  );
}

interface RecruitRowProps extends UnitSymbolProps {
  /** What can be done with it: a stepper, or Cancel. */
  readonly action?: ReactNode;
  readonly children?: ReactNode;
  /** The id of the text that says more about it. */
  readonly describedBy?: string;
  readonly locked?: boolean;
  readonly name: string;
  /** Whose it is, when not the viewer's. */
  readonly owner?: string | undefined;
}

/**
 * N2: one unit on either Recruit surface, whether it can be recruited, is ordered or is training,
 * laid out as a row of the Build list: its symbol, name and values, what the list adds beneath,
 * and on the right what can be done with it.
 */
export function RecruitRow({ action, children, describedBy, factionId, locked = false, name, owner, scenario, typeId }: RecruitRowProps): JSX.Element {
  const type = scenario.index.unitTypes.get(typeId);
  return (
    <li aria-describedby={describedBy} className={`build-option recruit-row${locked ? " build-option-locked" : ""}`} data-locked={locked} tabIndex={locked ? 0 : undefined}>
      <div>
        <strong className="recruit-head">
          <UnitSymbol factionId={factionId} scenario={scenario} typeId={typeId} />
          <span className="recruit-name">{name}</span>
          {owner === undefined ? null : <span className="queue-owner">{` (${owner}, recon)`}</span>}
          {type === undefined ? null : <span className="muster-values" title="Attack-defence at full strength">{`${String(type.attack)}-${String(type.defence)}`}</span>}
        </strong>
        {children}
      </div>
      {action}
    </li>
  );
}
