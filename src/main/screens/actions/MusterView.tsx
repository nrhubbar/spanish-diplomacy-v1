import { type JSX, useMemo, useState } from "react";
import type { MoveMode } from "../../engine/network/reach";
import type { Scenario, TerritoryId, UnitId } from "../../engine/types";
import { useAppDispatch } from "../../hooks";
import { glyphs } from "../../presentation/glyphs";
import { modeLabel, muster, type MusterCard, type MusterKind, musterButton, musterTicks, supportBlocked, supportCount, type SupportCard } from "../../presentation/muster";
import { orderFromMuster } from "../../state/gameSlice";
import { popView } from "../../state/paneSlice";
import { airDraftOrders, musterOrderFrom, musterRefusal, type PlanningSession } from "../../state/planning";
import { ActionIcon } from "./ActionIcon";
import { DefenceBox, OddsBox } from "./MusterBoxes";

interface MusterViewProps {
  readonly kind: MusterKind;
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  readonly target: TerritoryId;
}

function toggled<Item>(set: ReadonlySet<Item>, item: Item): ReadonlySet<Item> {
  const next = new Set(set);
  if (!next.delete(item)) next.add(item);
  return next;
}

/**
 * U6: the Invade and Reinforce panes. Every unit that can reach the target, grouped by where it
 * sets out, with a tick box and its move modes; the units already there; on Invade, the aircraft
 * that can fly Ground Support; the live odds (Invade) or defence (Reinforce); and one button that
 * orders them all.
 */
export function MusterView({ kind, scenario, session, target }: MusterViewProps): JSX.Element {
  const dispatch = useAppDispatch();
  const { draft, factionId, game } = session;
  const view = useMemo(
    () => muster(scenario, game.state, factionId, target, kind, { airOrders: airDraftOrders(draft), orders: draft.orders }),
    [draft, factionId, game.state, kind, scenario, target]
  );
  const [units, setUnits] = useState<ReadonlySet<UnitId>>(() => new Set(musterTicks(view).units));
  const [support, setSupport] = useState<ReadonlySet<UnitId>>(() => new Set(musterTicks(view).support));
  const [modes, setModes] = useState<ReadonlyMap<UnitId, MoveMode>>(() => new Map());
  const [refused, setRefused] = useState<string | undefined>(undefined);
  const ordered = useMemo(() => musterTicks(view), [view]);
  // The pane's ticks decide who goes there: the draft's other orders to the target don't count twice.
  const otherDraft = useMemo(
    () => ({ airOrders: airDraftOrders(draft).filter((order) => !(order.kind === "air-mission" && order.mission.kind === "support" && order.mission.territoryId === target)), orders: draft.orders.filter((order) => order.to !== target) }),
    [draft, target]
  );
  const changed = units.size > 0 || support.size > 0 || ordered.units.length > 0 || ordered.support.length > 0;

  return (
    <section aria-label={kind === "invade" ? "Invade" : "Reinforce"} className="muster" data-muster={kind}>
      <p className="muster-subtitle">{view.subtitle}</p>
      {kind === "invade"
        ? <OddsBox draft={otherDraft} scenario={scenario} session={session} support={[...support]} target={target} units={[...units]} />
        : <DefenceBox scenario={scenario} session={session} target={target} units={[...units]} />}
      {view.groups.length === 0 ? <p className="pane-hint">None of your units can reach it this turn.</p> : null}
      {view.groups.map((group) => (
        <section aria-label={group.title} className="muster-group" key={group.from}>
          <h3 className="muster-group-title">
            <span>{group.title}</span>
            <span className="muster-group-count">{`${String(group.cards.filter((card) => units.has(card.unitId)).length)} of ${String(group.cards.length)}`}</span>
          </h3>
          {group.cards.map((card) => (
            <UnitCard
              card={card}
              chosen={modes.get(card.unitId) ?? card.defaultMode}
              key={card.unitId}
              onMode={(mode) => { setModes((current) => new Map(current).set(card.unitId, mode)); }}
              onTick={() => { setUnits((current) => toggled(current, card.unitId)); }}
              ticked={units.has(card.unitId)}
            />
          ))}
        </section>
      ))}
      {view.here.length === 0 ? null : (
        <section aria-label="Already here" className="muster-group muster-here">
          <h3 className="muster-group-title">Already here</h3>
          <ul>
            {view.here.map((each) => (
              <li key={each.unitId}><strong>{each.name}</strong> <span className="muster-values">{each.values}</span> <span className="muster-note">{each.note}</span></li>
            ))}
          </ul>
        </section>
      )}
      {view.support.length === 0 ? null : (
        <section aria-label="Ground Support" className="muster-group muster-support">
          <h3 className="muster-group-title">
            <span>Ground Support</span>
            <span className="muster-group-count">{supportCount(view, support.size)}</span>
          </h3>
          {view.support.map((each) => (
            <SupportRow
              blocked={supportBlocked(view, support, each.unitId)}
              card={each}
              key={each.unitId}
              onTick={() => { setSupport((current) => toggled(current, each.unitId)); }}
              ticked={support.has(each.unitId)}
            />
          ))}
        </section>
      )}
      <div className="muster-footer">
        {refused === undefined ? null : <p className="muster-note muster-warning" role="alert">{refused}</p>}
        <button
          className={`primary-action muster-order muster-order-${kind}`}
          disabled={!changed}
          onClick={() => {
            const order = musterOrderFrom(view, { modes, support, units });
            // A refused order keeps the pane and its ticks, and says why.
            const reason = musterRefusal(scenario, game.state, factionId, order);
            setRefused(reason);
            if (reason !== undefined) return;
            dispatch(orderFromMuster(order));
            dispatch(popView());
          }}
          type="button"
        >
          <ActionIcon name={kind} />
          {musterButton(kind, units.size, support.size)}
        </button>
      </div>
    </section>
  );
}

function UnitCard({ card, chosen, onMode, onTick, ticked }: { readonly card: MusterCard; readonly chosen: MoveMode; readonly onMode: (mode: MoveMode) => void; readonly onTick: () => void; readonly ticked: boolean }): JSX.Element {
  const blocked = card.modes.flatMap((chip) => (chip.ok ? [] : [chip]));
  return (
    <article aria-label={card.name} className="muster-card" data-ticked={ticked}>
      <label className="muster-card-head">
        <input checked={ticked} onChange={onTick} type="checkbox" />
        <span className="muster-card-name">{card.name}</span>
      </label>
      <p className="muster-card-type">{card.typeName}</p>
      <div className="muster-card-figures">
        <span className="muster-values">{card.values}</span>
        <span aria-hidden="true" className="muster-strength"><span style={{ width: `${String(Math.round(card.share * 100))}%` }} /></span>
        <span className="muster-men">{card.men}</span>
        {card.dugIn === undefined ? null : <span className="muster-chip muster-dug-in">{card.dugIn}</span>}
      </div>
      <div aria-label="Move mode" className="muster-modes" role="group">
        {card.modes.map((chip) => (
          <button
            aria-pressed={chip.ok ? chip.mode === chosen : undefined}
            className="muster-chip muster-mode"
            data-mode={chip.mode}
            disabled={!chip.ok}
            key={chip.mode}
            onClick={() => { onMode(chip.mode); }}
            title={chip.ok ? undefined : chip.reason}
            type="button"
          >
            <ActionIcon name={chip.mode} />
            {modeLabel(chip.mode)}
          </button>
        ))}
      </div>
      {blocked.length === 0 ? null : (
        <ul className="muster-mode-notes">
          {blocked.map((chip) => <li key={chip.mode}>{`${modeLabel(chip.mode)}: ${chip.reason}`}</li>)}
        </ul>
      )}
      {card.otherOrder === undefined ? null : <p className="muster-note muster-replaces">{`${card.otherOrder}. Ticking this replaces it.`}</p>}
      {card.dugIn === undefined ? null : <p className="muster-note">Leaving gives up its works.</p>}
    </article>
  );
}

function SupportRow({ blocked, card, onTick, ticked }: { readonly blocked: string | undefined; readonly card: SupportCard; readonly onTick: () => void; readonly ticked: boolean }): JSX.Element {
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
