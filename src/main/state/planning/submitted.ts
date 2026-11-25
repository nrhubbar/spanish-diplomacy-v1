import type { Order } from "../../engine/types";
import { type Draft, emptyDraft } from "../session";
import { airDraftOrders } from "./air";
import { draftOrders } from "./recruitment";

/**
 * Every order a draft saves: moves and withdrawals, Replenish, Recruit and Build orders, then
 * air missions and Sack orders. Each save and End Turn send exactly these, so time running out
 * (T5) never drops a basket.
 */
export function submittedDraftOrders(draft: Draft): readonly Order[] {
  return [...draftOrders(draft), ...airDraftOrders(draft)];
}

/** The draft whose saved orders these are: `submittedDraftOrders` the other way round. */
export function draftFrom(orders: readonly Order[]): Draft {
  if (orders.length === 0) return emptyDraft;
  return {
    ...emptyDraft,
    airOrders: orders.filter((order) => order.kind === "air-mission" || order.kind === "sack"),
    builds: orders.filter((order) => order.kind === "build"),
    disbands: orders.filter((order) => order.kind === "disband"),
    orders: orders.filter((order) => order.kind === "move" || order.kind === "withdraw"),
    recruits: orders.filter((order) => order.kind === "recruit"),
    replenishments: orders.filter((order) => order.kind === "replenish")
  };
}
