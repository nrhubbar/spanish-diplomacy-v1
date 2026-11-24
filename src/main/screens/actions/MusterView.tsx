import { type JSX, useMemo, useState } from "react";
import type { Scenario, TerritoryId, UnitId } from "../../engine/types";
import { useAppDispatch, useAppSelector } from "../../hooks";
import { defendersCount, groupModes, muster, type MusterGroup, type MusterKind, musterButton, supportBlocked, supportCount } from "../../presentation/muster";
import { orderFromMuster } from "../../state/gameSlice";
import { musterModeChosen, musterTicked, popView } from "../../state/paneSlice";
import { airDraftOrders, musterOrderFrom, type MusterPicks, musterPicks, musterRefusal, type PlanningSession } from "../../state/planning";
import { ActionIcon } from "./ActionIcon";
import { DefenceBox, OddsBox } from "./MusterBoxes";
import { DefenderCard, GroupModesNote, SupportRow, UnitCard } from "./MusterCards";

interface MusterViewProps {
  readonly kind: MusterKind;
  readonly scenario: Scenario;
  readonly session: PlanningSession;
  readonly target: TerritoryId;
}

/**
 * U6: the Invade and Reinforce panes. One card with the live odds (Invade) or defence (Reinforce)
 * and the button that orders every ticked unit; then every unit that can reach the target, grouped
 * by where it sets out, with a tick box and its move modes; the units already there; and, on Invade,
 * the aircraft that can fly Ground Support and the defenders. Everything scrolls together.
 */
export function MusterView({ kind, scenario, session, target }: MusterViewProps): JSX.Element {
  const dispatch = useAppDispatch();
  const { draft, factionId, game } = session;
  const choices = useAppSelector((state) => state.pane.muster);
  const view = useMemo(
    () => muster(scenario, game.state, factionId, target, kind, { airOrders: airDraftOrders(draft), orders: draft.orders }),
    [draft, factionId, game.state, kind, scenario, target]
  );
  const [refused, setRefused] = useState<string | undefined>(undefined);
  const picks = useMemo(() => musterPicks(scenario, session, target, choices), [choices, scenario, session, target]);
  const order = useMemo(() => musterOrderFrom(view, picks), [picks, view]);
  // The pane's ticks decide who goes there: the draft's other orders to the target don't count twice.
  const otherDraft = useMemo(
    () => ({ airOrders: airDraftOrders(draft).filter((each) => !(each.kind === "air-mission" && each.mission.kind === "support" && each.mission.territoryId === target)), orders: draft.orders.filter((each) => each.to !== target) }),
    [draft, target]
  );
  const anyOrdered = view.support.some((each) => each.ordered) || view.groups.some((group) => group.cards.some((card) => card.ordered));
  const tick = (unitId: UnitId, ticked: boolean): void => { dispatch(musterTicked({ ticked, unitId })); };
  const give = (): void => {
    // A refused order keeps the pane and its ticks, and says why.
    const reason = musterRefusal(scenario, session, order);
    setRefused(reason);
    if (reason !== undefined) return;
    dispatch(orderFromMuster(order));
    dispatch(popView());
  };
  const orderButton = (
    <>
      {refused === undefined ? null : <p className="muster-note muster-warning" role="alert">{refused}</p>}
      <button
        className={`primary-action muster-order muster-order-${kind}`}
        disabled={order.moves.length === 0 && order.support.length === 0 && !anyOrdered}
        onClick={give}
        type="button"
      >
        <ActionIcon name={kind} />
        {musterButton(kind, order.moves.length, order.support.length)}
      </button>
    </>
  );

  return (
    <section aria-label={kind === "invade" ? "Invade" : "Reinforce"} className="muster" data-muster={kind}>
      <p className="muster-subtitle">{view.subtitle}</p>
      {kind === "invade"
        ? <OddsBox action={orderButton} draft={otherDraft} moves={order.moves} scenario={scenario} session={session} support={order.support} target={target} />
        : <DefenceBox action={orderButton} scenario={scenario} session={session} target={target} units={order.moves.map((move) => move.unitId)} />}
      {view.groups.length === 0 ? <p className="pane-hint">None of your units can reach it this turn.</p> : null}
      {view.groups.map((group) => (
        <Group
          group={group}
          key={group.from}
          onMode={(unitId, mode) => { dispatch(musterModeChosen({ mode, unitId })); }}
          onTick={tick}
          picks={picks}
        />
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
            <span className="muster-group-count">{supportCount(view, picks.support.size)}</span>
          </h3>
          {view.support.map((each) => (
            <SupportRow
              blocked={supportBlocked(view, picks.support, each.unitId)}
              card={each}
              key={each.unitId}
              onTick={() => { tick(each.unitId, !picks.support.has(each.unitId)); }}
              ticked={picks.support.has(each.unitId)}
            />
          ))}
        </section>
      )}
      {view.defenders.cards.length === 0 ? null : (
        <section aria-label="Defenders" className="muster-group muster-defenders">
          <h3 className="muster-group-title">
            <span>Defenders</span>
            <span className="muster-group-count">{defendersCount(view.defenders)}</span>
          </h3>
          {view.defenders.cards.map((card) => <DefenderCard card={card} key={card.unitId} />)}
        </section>
      )}
    </section>
  );
}

interface GroupProps {
  readonly group: MusterGroup;
  readonly onMode: (unitId: UnitId, mode: MusterGroup["cards"][number]["defaultMode"]) => void;
  readonly onTick: (unitId: UnitId, ticked: boolean) => void;
  readonly picks: MusterPicks;
}

/** The units setting out from one territory. */
function Group({ group, onMode, onTick, picks }: GroupProps): JSX.Element {
  const modes = groupModes(group.cards);
  return (
    <section aria-label={group.title} className="muster-group">
      <h3 className="muster-group-title">
        <span>{group.title}</span>
        <span className="muster-group-count">{`${String(group.cards.filter((card) => picks.units.has(card.unitId)).length)} of ${String(group.cards.length)}`}</span>
      </h3>
      {modes === undefined ? null : <GroupModesNote modes={modes} />}
      {group.cards.map((card) => (
        <UnitCard
          card={card}
          chosen={picks.modes.get(card.unitId) ?? card.defaultMode}
          key={card.unitId}
          onMode={(mode) => { onMode(card.unitId, mode); }}
          onTick={() => { onTick(card.unitId, !picks.units.has(card.unitId)); }}
          ticked={picks.units.has(card.unitId)}
        />
      ))}
    </section>
  );
}
