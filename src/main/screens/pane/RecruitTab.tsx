import { type JSX, useId } from "react";
import {
  capitalBuildings,
  recruitSiteProblem,
  recruitSlots,
  recruitableTypes,
  typeLock
} from "../../engine/recruitment/rules";
import { canAfford } from "../../engine/resources";
import type { FactionId, Scenario, UnitTypeDefinition } from "../../engine/types";
import { buildingIcon, developmentIcon, EconomyIcon } from "../../components/economy/EconomyIcon";
import { useAppDispatch } from "../../hooks";
import { glyphs } from "../../presentation/glyphs";
import { trainingEntries } from "../../presentation/queues";
import {
  recruitAddNote,
  recruitAddReason,
  recruitRequirements,
  recruitSiteName,
  recruitsWith,
  recruitTerms,
  resourceCells,
  resourcesLabel,
  shortfallLabel,
  termsLine
} from "../../presentation/recruitment";
import { unitEffectLines } from "../../presentation/unitEffects";
import { cancelRecruitOrder, changeRecruitQuantity } from "../../state/gameSlice";
import { balanceAfterBasket, basketCost, recruitQuantity, recruitUpkeepProblem } from "../../state/planning";
import { OrderLedger } from "../queues/OrderLedger";
import { PausedChip } from "../queues/QueueList";
import { RecruitRow, ResourceCells } from "../queues/RecruitRow";
import { TrainingList } from "../queues/TrainingList";
import type { TerritoryTabProps } from "./TerritoryTabs";

/**
 * U9, X4, N2: the order ledger with the turn's totals as its last lines, every unit type the
 * scenario recruits (what can be recruited now, then what is locked here and why), and the units
 * in training. Nothing here is inserted or removed by a Recruit order: the ledger's lines, each
 * row's lines for a reason and the totals keep their size, and the section a type is in depends on
 * the territory alone. This turn's orders are in the ledger, not in the training list, so that
 * doesn't grow. The totals stay in sight, at the top of the pane, once the ledger is scrolled away.
 */
export function RecruitTab({ scenario, session, territoryId }: TerritoryTabProps): JSX.Element {
  const dispatch = useAppDispatch();
  const { factionId, game } = session;
  const state = game.state;
  const capitalName = recruitSiteName(scenario, territoryId);
  const site = recruitSiteProblem(scenario, state, factionId, territoryId);
  const means = recruitsWith(scenario, state, factionId, territoryId, capitalBuildings(scenario, state, territoryId));
  const slots = recruitSlots(scenario, state, territoryId);
  const here = (session.draft.recruits ?? []).filter((order) => order.territoryId === territoryId);
  const left = balanceAfterBasket(scenario, session);
  const spent = basketCost(scenario, session);
  const training = trainingEntries(scenario, state, territoryId, [], factionId, false);
  const paused = state.training.some((item) => item.territoryId === territoryId && item.paused);
  const rows = recruitableTypes(scenario).map((type) => ({
    locked: site === undefined ? typeLock(scenario, state, factionId, territoryId, type).reasons : [site],
    type
  }));
  const row = ({ locked, type }: (typeof rows)[number]): JSX.Element => (
    <UnitRow
      effects={unitEffectLines(scenario, type)}
      factionId={factionId}
      key={type.id}
      locked={locked}
      onChange={(quantity) => dispatch(changeRecruitQuantity({ quantity, territoryId, unitTypeId: type.id }))}
      quantity={recruitQuantity(session.draft, territoryId, type.id)}
      requirements={recruitRequirements(scenario, state, factionId, territoryId, type)}
      scenario={scenario}
      shortfall={type.recruit === undefined || canAfford(left, type.recruit.cost) ? "" : shortfallLabel(scenario, left, type.recruit.cost)}
      slotsFull={here.length >= slots}
      type={type}
      upkeep={recruitUpkeepProblem(scenario, session, territoryId, type.id)}
    />
  );
  return (
    <div className="recruit-tab">
      <div className="recruit-top">
        <h4>{`Recruit at ${capitalName}`}</h4>
        {means.length === 0 ? <p className="pane-hint">No buildings</p> : (
          <ul aria-label="What this territory recruits with" className="site-buildings">
            {means.map(({ building, name, track }) => (
              <li key={name}>
                {building === undefined ? null : <EconomyIcon name={buildingIcon(building)} />}
                {track === undefined ? null : <EconomyIcon name={developmentIcon(scenario, track)} />}
                {name}
              </li>
            ))}
          </ul>
        )}
        {site === undefined ? null : <p className="pane-note recruit-site-note" role="note">{site}</p>}
      </div>
      {site === undefined || here.length > 0 ? (
        <section aria-label="Recruit orders" className="muster-box recruit-orders">
          <p className="roll-ledger-title">{`${String(here.length)} of ${String(slots)} Recruit orders here this turn`}</p>
          <OrderLedger
            label={`Recruit orders at ${capitalName}`}
            onCancel={(at) => dispatch(cancelRecruitOrder({ at, territoryId }))}
            orders={here}
            scenario={scenario}
            slots={slots}
          />
        </section>
      ) : null}
      <div className="muster-box recruit-basket">
        <p aria-live="polite" className="visually-hidden">
          <span>{`All recruiting and replenishing this turn: ${resourcesLabel(scenario, spent, ", ")}`}</span>
          <span>{`Left: ${resourcesLabel(scenario, left, ", ")}`}</span>
        </p>
        <div aria-hidden="true" className="roll-ledger">
          {[{ amount: spent, label: "All recruiting" }, { amount: left, label: "Left" }].map(({ amount, label }) => (
            <p className="roll-ledger-line roll-ledger-total order-line" key={label}>
              <span className="order-line-name">{label}</span>
              <span className="roll-ledger-value"><ResourceCells cells={resourceCells(scenario, amount, true)} scenario={scenario} /></span>
            </p>
          ))}
        </div>
      </div>
      <RowSection rows={rows.filter(({ locked }) => locked.length === 0).map(row)} title="Can recruit now" />
      <RowSection rows={rows.filter(({ locked }) => locked.length > 0).map(row)} title="Locked here" />
      <section aria-label="In training" className="recruit-queue">
        <div className="build-tab-head">
          <h4>In training</h4>
          {paused ? <PausedChip /> : null}
        </div>
        {training.length === 0
          ? <p className="pane-hint">No unit is training here.</p>
          : <TrainingList entries={training} label={`${capitalName} training`} paused={paused} scenario={scenario} />}
      </section>
    </div>
  );
}

/** One section of unit rows under its title; nothing when it has none. */
function RowSection({ rows, title }: { readonly rows: readonly JSX.Element[]; readonly title: string }): JSX.Element | null {
  const id = useId();
  return rows.length === 0 ? null : (
    <section aria-labelledby={id}>
      <div className="build-tab-head"><h4 id={id}>{title}</h4></div>
      <ul aria-labelledby={id} className="recruit-list">{rows}</ul>
    </section>
  );
}

interface UnitRowProps {
  readonly effects: readonly string[];
  readonly factionId: FactionId;
  readonly locked: readonly string[];
  readonly onChange: (quantity: number) => void;
  readonly quantity: number;
  readonly requirements: readonly { readonly have: boolean; readonly name: string }[];
  readonly scenario: Scenario;
  readonly shortfall: string;
  readonly slotsFull: boolean;
  readonly type: UnitTypeDefinition;
  /** D1: why next turn's upkeep refuses one more. */
  readonly upkeep: string | undefined;
}

/** A unit type as a row of the Build list: its terms, a stepper (or why it is locked), and what it does, folded away. */
function UnitRow({ effects, factionId, locked, onChange, quantity, requirements, scenario, shortfall, slotsFull, type, upkeep }: UnitRowProps): JSX.Element {
  const ids = useId();
  const isLocked = locked.length > 0;
  const name = type.name;
  const reason = recruitAddReason(locked, slotsFull, shortfall, upkeep);
  const note = isLocked ? undefined : recruitAddNote(slotsFull, shortfall, upkeep);
  const terms = recruitTerms(scenario, type);
  const detailsId = `${ids}-details`;
  return (
    <RecruitRow
      action={isLocked ? null : (
        <div className="recruit-action">
          <span aria-label={`${name} to recruit`} className="recruit-stepper" role="group">
            <StepperButton label={`One fewer ${name}`} off={quantity === 0} onPress={() => { onChange(quantity - 1); }} text={glyphs.minus} />
            <output aria-live="polite" className="stepper-value">{quantity}</output>
            <StepperButton label={`One more ${name}`} off={reason !== undefined} onPress={() => { onChange(quantity + 1); }} text="+" why={reason} />
          </span>
          <p className="build-locked recruit-note" title={reason}>{note?.text}</p>
        </div>
      )}
      describedBy={detailsId}
      factionId={factionId}
      locked={isLocked}
      name={name}
      scenario={scenario}
      typeId={type.id}
    >
      <span className="build-terms">
        {terms.map(({ kind, meta }, at) => (
          <span key={kind}>{at === 0 ? null : ` ${glyphs.dot} `}<span data-short={kind === note?.term}>{meta}</span></span>
        ))}
      </span>
      {isLocked ? <span className="build-locked">{locked[0]}</span> : null}
      {effects.length === 0 ? null : (
        <details className="muster-why recruit-effects">
          <summary><span className="muster-why-question">Special effects</span><span className="visually-hidden">{` of the ${name}`}</span></summary>
          <ul>{effects.map((line) => <li key={line}>{line}</li>)}</ul>
        </details>
      )}
      <span className="recruit-details" id={detailsId} role="tooltip">
        <strong>{isLocked ? `${name}: locked` : name}</strong>
        {isLocked ? locked.map((line) => <span key={line}>{line}</span>) : null}
        <span>{termsLine(terms, "detail")}</span>
        {requirements.length === 0
          ? <span>Needs no buildings.</span>
          : <span>{`Needs: ${requirements.map((entry) => `${entry.name} ${entry.have ? glyphs.check : glyphs.close}`).join(", ")}`}</span>}
        {!isLocked && reason !== undefined ? <span>{reason}</span> : null}
      </span>
    </RecruitRow>
  );
}

interface StepperButtonProps {
  readonly label: string;
  readonly off: boolean;
  readonly onPress: () => void;
  readonly text: string;
  readonly why?: string | undefined;
}

/** Turned off with `aria-disabled`, so it keeps the keyboard's focus at the last order and can still say why. */
function StepperButton({ label, off, onPress, text, why }: StepperButtonProps): JSX.Element {
  return (
    <button aria-description={why} aria-disabled={off} aria-label={label} className="secondary-button compact-button stepper-button" onClick={off ? undefined : onPress} title={why} type="button">{text}</button>
  );
}
