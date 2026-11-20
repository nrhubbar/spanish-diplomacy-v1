import { type JSX, useId, useMemo } from "react";
import {
  capitalBuildings,
  recruitSiteProblem,
  recruitSlots,
  recruitableTypes,
  typeLock
} from "../../engine/recruitment/rules";
import { canAfford } from "../../engine/resources";
import type { UnitTypeDefinition } from "../../engine/types";
import { useAppDispatch, useMapAssets } from "../../hooks";
import { prepareSymbol } from "../../map/markup";
import { glyphs } from "../../presentation/glyphs";
import {
  capitalBuildingsLabel,
  recruitAddReason,
  recruitRequirements,
  recruitSiteName,
  recruitTerms,
  resourcesLabel,
  shortfallLabel
} from "../../presentation/recruitment";
import { changeRecruitQuantity } from "../../state/gameSlice";
import { balanceAfterBasket, basketCost, recruitQuantity } from "../../state/planning";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * X4 (Q-UX-05): every unit type the scenario recruits, with its values, cost, men, training
 * time and a quantity. A locked type says why inline, and hovering or focusing it gives the
 * details. The basket line totals the turn's Recruit and Replenish orders and what is left.
 */
export function RecruitTab({ scenario, session, territoryId }: TerritoryTabProps): JSX.Element {
  const dispatch = useAppDispatch();
  const headingId = useId();
  const assets = useMapAssets(scenario.id);
  const { factionId, game } = session;
  const state = game.state;
  const faction = scenario.index.factions.get(factionId);
  const capitalName = recruitSiteName(scenario, territoryId);
  const site = recruitSiteProblem(scenario, state, factionId, territoryId);
  const standing = capitalBuildings(scenario, state, territoryId);
  const slots = recruitSlots(scenario, state, territoryId);
  const here = (session.draft.recruits ?? []).filter((order) => order.territoryId === territoryId).length;
  const left = balanceAfterBasket(scenario, session);
  const spent = basketCost(scenario, session);
  const symbols = useMemo(() => {
    const color = faction?.color ?? "#000";
    return new Map([...assets?.unitSymbols ?? []].map(([id, source]) => [id, prepareSymbol(source, color)]));
  }, [assets, faction]);

  return (
    <div className="recruit-tab">
      <div className="recruit-header">
        <h4 id={headingId}>{`Recruit at ${capitalName}`}</h4>
        <span className="recruit-buildings" title="Buildings in the capital">
          {capitalBuildingsLabel(scenario, standing)}
        </span>
      </div>
      {site === undefined ? (
        <p className="pane-meta recruit-slots">{`${String(here)} of ${String(slots)} Recruit orders here this turn`}</p>
      ) : <p className="pane-note recruit-site-note" role="note">{site}</p>}
      <ul aria-labelledby={headingId} className="recruit-list">
        {recruitableTypes(scenario).map((type) => (
          <RecruitRow
            key={type.id}
            locked={site === undefined ? typeLock(scenario, state, factionId, territoryId, type).reasons : [site]}
            onChange={(quantity) => dispatch(changeRecruitQuantity({ quantity, territoryId, unitTypeId: type.id }))}
            quantity={recruitQuantity(session.draft, territoryId, type.id)}
            shortfall={type.recruit === undefined || canAfford(left, type.recruit.cost) ? "" : shortfallLabel(scenario, left, type.recruit.cost)}
            slotsFull={here >= slots}
            symbol={symbols.get(type.id) ?? ""}
            type={type}
            requirements={recruitRequirements(scenario, type, standing)}
            terms={recruitTerms(scenario, type)}
          />
        ))}
      </ul>
      <p aria-live="polite" className="recruit-basket">
        <span>{`This turn: ${resourcesLabel(scenario, spent, ", ")}`}</span>
        <span>{`Left: ${resourcesLabel(scenario, left, ", ")}`}</span>
      </p>
    </div>
  );
}

interface RecruitRowProps {
  readonly locked: readonly string[];
  readonly onChange: (quantity: number) => void;
  readonly quantity: number;
  readonly requirements: readonly { readonly have: boolean; readonly name: string }[];
  readonly shortfall: string;
  readonly slotsFull: boolean;
  readonly symbol: string;
  readonly terms: { readonly detail: string; readonly meta: string };
  readonly type: UnitTypeDefinition;
}

function RecruitRow({ locked, onChange, quantity, requirements, shortfall, slotsFull, symbol, terms, type }: RecruitRowProps): JSX.Element {
  const ids = useId();
  const isLocked = locked.length > 0;
  const name = type.name;
  const addReason = recruitAddReason(locked, slotsFull, shortfall);
  const detailsId = `${ids}-details`;
  return (
    <li aria-describedby={detailsId} className="recruit-row" data-locked={isLocked} tabIndex={isLocked ? 0 : undefined}>
      <span aria-hidden="true" className="recruit-symbol" dangerouslySetInnerHTML={{ __html: symbol }} />
      <span className="recruit-name">{name}</span>
      <span className="recruit-values" title="Attack-defence at full strength">{`${String(type.attack)}-${String(type.defence)}`}</span>
      <span className="recruit-meta">
        {isLocked
          ? <span className="recruit-lock"><span aria-hidden="true">{"\u{1F512}"} </span>{locked[0]}</span>
          : terms.meta}
      </span>
      {isLocked ? null : (
        <span className="recruit-stepper" role="group" aria-label={`${name} to recruit`}>
          <button aria-label={`One fewer ${name}`} className="stepper-button" disabled={quantity === 0} onClick={() => { onChange(quantity - 1); }} type="button">{glyphs.minus}</button>
          <output aria-live="polite" className="stepper-value">{quantity}</output>
          <button
            aria-label={`One more ${name}`}
            className="stepper-button"
            disabled={addReason !== undefined}
            onClick={() => { onChange(quantity + 1); }}
            title={addReason}
            type="button"
          >
            +
          </button>
        </span>
      )}
      <span className="recruit-details" id={detailsId} role="tooltip">
        <strong>{isLocked ? `${name}: locked` : name}</strong>
        {isLocked ? locked.map((reason) => <span key={reason}>{reason}</span>) : null}
        <span>{terms.detail}</span>
        {requirements.length === 0
          ? <span>Needs no buildings.</span>
          : <span>{`Needs: ${requirements.map((entry) => `${entry.name} ${entry.have ? glyphs.check : glyphs.close}`).join(", ")}`}</span>}
        {!isLocked && addReason !== undefined ? <span>{addReason}</span> : null}
      </span>
    </li>
  );
}
