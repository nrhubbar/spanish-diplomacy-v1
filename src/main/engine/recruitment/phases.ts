import { carryOf, withCarry } from "../carry";
import { upkeepProblem } from "../economy/upkeep";
import { adjustTreasury, canAfford, subtractResources, treasuryOf } from "../resources";
import { draftState, type Phase, type TurnDraft } from "../phases/draft";
import type {
  GameState,
  Order,
  RaisedUnitDefinition,
  RecruitOrder,
  RecruitmentTurnOutcome,
  ReplenishOrder,
  Resources,
  TerritoryId,
  TrainingItem,
  UnitId,
  UnitState
} from "../types";
import { validDisbands } from "./disband";
import { capitalOf, chargeReplenish, nextRaisedSerial, raisedDefinition, raisedUnitId, recruitSlots, replenishQuote, trainingUnitId, trainsOn, uncharge } from "./rules";

/** A Replenish order paid at step 1, settled at step 9. */
export interface PaidReplenishment {
  readonly men: number;
  readonly order: ReplenishOrder;
  /** B2: what it owed, in thousandths, taken back out of the carry if it is cancelled. */
  readonly owed: Resources;
  readonly paid: Resources;
  readonly territoryId: TerritoryId;
}

declare module "../phases/draft" {
  interface TurnScratch {
    /** The recruitment area's turn-only data: Replenish orders paid at reveal, settled at step 9. */
    readonly recruitment?: { readonly replenishing: readonly PaidReplenishment[] };
  }
}

/** The carries as a state holds them: no field while nobody has one. */
function carried(carries: GameState["carry"]): Pick<GameState, "carry"> {
  return carries === undefined ? {} : { carry: carries };
}

const notEnough = "Not enough Funds or Manpower when the orders were revealed.";

/** The orders of this area that passed validation at reveal, in submission order. */
function validOrders(draft: TurnDraft): readonly (RecruitOrder | ReplenishOrder)[] {
  const rejected = new Set<Order>(draft.orders.rejected.map((outcome) => outcome.order));
  return draft.input.submissions.flatMap((submission) => submission.orders.filter(
    (order): order is RecruitOrder | ReplenishOrder => (order.kind === "recruit" || order.kind === "replenish") && !rejected.has(order)
  ));
}

/**
 * Section 2 step 1 (R2, R5, D7): pay for Recruit and Replenish orders, in submission order, from
 * what the economy's builds left. A territory takes at most its D7 number of Recruit orders; an
 * order past the limit, or one the treasury cannot cover, fails with an empty refund (nothing
 * was taken). A paid
 * Recruit starts training with its unit's id; a paid Replenish waits for step 9.
 */
export const payForRecruits: Phase = (draft) => {
  const orders = validOrders(draft);
  if (orders.length === 0) return draft;
  const { scenario, start } = draft.input;
  let treasuries = draft.systems.treasuries;
  let training = draft.systems.training;
  let { carry: carries } = draft.systems;
  const events: RecruitmentTurnOutcome[] = [];
  const replenishing: PaidReplenishment[] = [];
  const used = new Map<string, number>();
  // D1: each order is refused if it leaves next turn's stock below zero, after this side's Disband orders and what it was already granted.
  const before = draftState(draft);
  const granted: Order[] = [...validDisbands(draft)];
  const upkeepReason = (order: RecruitOrder | ReplenishOrder): string | undefined =>
    upkeepProblem(scenario, before, order.factionId, [...granted.filter((other) => other.factionId === order.factionId), order]);

  for (const order of orders) {
    const balance = treasuryOf({ treasuries }, order.factionId);
    if (order.kind === "recruit") {
      const type = scenario.index.unitTypes.get(order.unitTypeId);
      const recruit = type?.recruit;
      if (recruit === undefined) continue;
      const slotKey = `${order.factionId}|${order.territoryId}`;
      const count = used.get(slotKey) ?? 0;
      const refund = (reason: string): void => {
        // RR-5, m1: nothing was taken, so nothing comes back (like `build-refunded` at step 1).
        events.push({ factionId: order.factionId, kind: "training-refunded", reason, refund: {}, territoryId: order.territoryId, typeId: order.unitTypeId });
      };
      if (count >= recruitSlots(scenario, start, order.territoryId)) {
        refund(`At most ${String(recruitSlots(scenario, start, order.territoryId))} new units a turn can be recruited there.`);
        continue;
      }
      if (!canAfford(balance, recruit.cost)) {
        refund(notEnough);
        continue;
      }
      const short = upkeepReason(order);
      if (short !== undefined) {
        refund(short);
        continue;
      }
      granted.push(order);
      used.set(slotKey, count + 1);
      treasuries = adjustTreasury(treasuries, order.factionId, subtractResources({}, recruit.cost));
      const unitId = trainingUnitId(training, order.factionId, order.unitTypeId, order.territoryId);
      const item: TrainingItem = { factionId: order.factionId, paid: recruit.cost, paused: false, territoryId: order.territoryId, turnsLeft: recruit.trainingTurns, typeId: order.unitTypeId, unitId };
      training = [...training, item];
      events.push({ kind: "training-started", order, paid: recruit.cost, turnsLeft: recruit.trainingTurns, unitId });
    } else {
      const unit = start.units[order.unitId];
      const quote = unit === undefined ? undefined : replenishQuote(scenario, start, unit);
      if (unit === undefined || quote === undefined) continue;
      // B2: priced against the carry so far this reveal, not the start of the turn's.
      const charge = chargeReplenish(carryOf(carried(carries), order.factionId), quote.owed);
      if (!canAfford(balance, charge.paid)) {
        events.push({ kind: "replenish-cancelled", order, reason: notEnough, refund: {} });
        continue;
      }
      const short = upkeepReason(order);
      if (short !== undefined) {
        events.push({ kind: "replenish-cancelled", order, reason: short, refund: {} });
        continue;
      }
      granted.push(order);
      treasuries = adjustTreasury(treasuries, order.factionId, subtractResources({}, charge.paid));
      carries = withCarry(carries, order.factionId, charge.carry).carry;
      replenishing.push({ men: quote.men, order, owed: quote.owed, paid: charge.paid, territoryId: unit.territoryId });
    }
  }
  return {
    ...draft,
    events: [...draft.events, ...events],
    scratch: { ...draft.scratch, recruitment: { replenishing } },
    systems: { ...draft.systems, training, treasuries, ...carried(carries) }
  };
};

/** Every unit that took part in a battle this turn, standing battles included (Q-RECR-5 as ticked). */
function unitsInBattle(draft: TurnDraft): ReadonlySet<UnitId> {
  const sides = [
    ...draft.meetings.battles.flatMap((battle) => [battle.attacker, battle.defender]),
    ...[...draft.front.battles, ...draft.standing].flatMap((pending) => [pending.battle.attacker, pending.battle.defender])
  ];
  return new Set(sides.flatMap((side) => side.armies.map((army) => army.unitId)));
}

/**
 * Section 2 step 9 (R5, C5, Q-MR-05): replenished men arrive after battles and control. Any
 * battle the unit fought, or its retreat or loss, cancels the order with a full refund.
 * Otherwise the men join, up to full strength, and demoralization clears.
 */
export const replenish: Phase = (draft) => {
  const paid = draft.scratch.recruitment?.replenishing ?? [];
  if (paid.length === 0) return draft;
  const { scenario } = draft.input;
  const fought = unitsInBattle(draft);
  let treasuries = draft.systems.treasuries;
  let { carry: carries } = draft.systems;
  const armies: Record<UnitId, UnitState> = { ...draft.armies };
  const events: RecruitmentTurnOutcome[] = [];
  for (const entry of paid) {
    const unit = armies[entry.order.unitId];
    const reason = unit === undefined
      ? "The unit was lost before the men arrived."
      : fought.has(unit.id) ? "The unit fought a battle." : unit.territoryId === entry.territoryId ? undefined : "The unit fell back.";
    if (unit === undefined || reason !== undefined) {
      treasuries = adjustTreasury(treasuries, entry.order.factionId, entry.paid);
      carries = withCarry(carries, entry.order.factionId, uncharge(carryOf(carried(carries), entry.order.factionId), entry.owed, entry.paid)).carry;
      events.push({ kind: "replenish-cancelled", order: entry.order, reason: reason ?? "", refund: entry.paid });
      continue;
    }
    const full = (draft.systems.raised[unit.id] ?? scenario.index.units.get(unit.id) ?? raisedDefinition(scenario, unit.id))?.fullStrength ?? unit.strength;
    const men = Math.max(0, Math.min(entry.men, full - unit.strength));
    armies[unit.id] = { ...unit, morale: { demoralized: false, quietTurns: 0 }, strength: unit.strength + men };
    // Demoralized at the start of the turn: the rest rule (M23) may already have cleared it this step.
    const recovered = draft.input.start.units[unit.id]?.morale.demoralized ?? unit.morale.demoralized;
    events.push({ kind: "replenish-applied", men, order: entry.order, paid: entry.paid, recovered });
  }
  return { ...draft, armies, events: [...draft.events, ...events], systems: { ...draft.systems, treasuries, ...carried(carries) } };
};

/** The faction no longer holds the capital where the unit trains (or the territory, without sub-territories). */
function trainingLost(draft: TurnDraft, state: GameState, item: TrainingItem): boolean {
  const capital = capitalOf(draft.input.scenario, item.territoryId);
  if (capital !== undefined) return state.subTerritories[capital]?.holder !== item.factionId;
  const control = state.control[item.territoryId];
  return control?.kind === "controlled" ? control.factionId !== item.factionId : !(control?.factionIds.includes(item.factionId) ?? false);
}

/**
 * Section 2 step 10 (R4, R7, C8): each unit in training advances one turn. In contested ground,
 * types that train on there (militia) advance and the rest pause. When the capital has fallen,
 * training not yet started (no turn taken off yet, such as a Recruit paid this turn) is
 * refunded, and training under way is lost with its payment, like a build queue ($5, D28.2). A
 * unit whose training runs out appears in its territory at full establishment, healthy and
 * rested, at the end of this turn; it can first move next turn. Its definition joins `raised` (R6).
 */
export const advanceTraining: Phase = (draft) => {
  if (draft.systems.training.length === 0) return draft;
  const { scenario } = draft.input;
  const state = draftState(draft);
  const armies: Record<UnitId, UnitState> = { ...draft.armies };
  const raised: Record<UnitId, RaisedUnitDefinition> = { ...draft.systems.raised };
  const training: TrainingItem[] = [];
  const events: RecruitmentTurnOutcome[] = [];
  let treasuries = draft.systems.treasuries;
  for (const item of draft.systems.training) {
    if (trainingLost(draft, state, item)) {
      // D28.2 (RR-8): like a build queue ($5), training not yet started is refunded; training under way is lost with its payment.
      const started = item.turnsLeft < (scenario.index.unitTypes.get(item.typeId)?.recruit?.trainingTurns ?? item.turnsLeft);
      if (!started) treasuries = adjustTreasury(treasuries, item.factionId, item.paid);
      events.push(started
        ? { factionId: item.factionId, kind: "training-refunded", reason: "The capital fell while the unit was training; its payment is lost.", refund: {}, territoryId: item.territoryId, typeId: item.typeId }
        : { factionId: item.factionId, kind: "training-refunded", reason: "The capital fell before training began.", refund: item.paid, territoryId: item.territoryId, typeId: item.typeId });
      continue;
    }
    if (!trainsOn(scenario, state, item)) {
      if (!item.paused) events.push({ factionId: item.factionId, kind: "training-paused", territoryId: item.territoryId, unitId: item.unitId });
      training.push({ ...item, paused: true });
      continue;
    }
    const turnsLeft = item.turnsLeft - 1;
    if (turnsLeft > 0) {
      training.push({ ...item, paused: false, turnsLeft });
      continue;
    }
    // m7: numbered as it appears, in training-list order, among the faction's raised units of its type.
    const unitId = raisedUnitId(item.factionId, item.typeId, nextRaisedSerial(raised, item.factionId, item.typeId));
    const definition = raisedDefinition(scenario, unitId);
    if (definition === undefined) continue;
    raised[unitId] = definition;
    armies[unitId] = {
      factionId: item.factionId,
      fatigue: 0,
      id: unitId,
      morale: { demoralized: false, quietTurns: 0 },
      strength: definition.fullStrength,
      territoryId: item.territoryId
    };
    events.push({ factionId: item.factionId, kind: "training-completed", territoryId: item.territoryId, typeId: item.typeId, unitId });
  }
  return { ...draft, armies, events: [...draft.events, ...events], systems: { ...draft.systems, raised, training, treasuries } };
};
