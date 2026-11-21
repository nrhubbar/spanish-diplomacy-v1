// Milestone 3 Rev 2 UX pass: reaches a mid-game state through the app's own Redux actions.
// The store is captured by render.mjs's init script (a stand-in for the Redux DevTools hook the
// dev build already calls), so nothing in src/ changes. Evaluated in the page as window.M3D.
window.M3D = (() => {
  const st = () => window.__store;
  const d = (type, payload) => st().dispatch(payload === undefined ? { type } : { type, payload });
  const S = () => st().getState().game.session;
  const recruit = (territoryId, unitTypeId, quantity = 1) => d("game/changeRecruitQuantity", { territoryId, unitTypeId, quantity });
  const build = (subTerritoryId, project) => d("game/queueBuildOrder", { factionId: "republic", kind: "build", subTerritoryId, project });
  const B = (buildingId) => ({ kind: "building", buildingId });
  const Dv = (developmentId) => ({ kind: "development", developmentId });
  function turn1() {
    recruit("catalunya", "infantry-regiment");
    recruit("valencia", "militia-column");
    recruit("madrid", "infantry-regiment");
    build("barcelona", Dv("farms"));
    build("barcelona", B("fortifications"));
    build("valencia", B("fortifications"));
    build("madrid", B("fortifications"));
  }
  /** Turn 2's draft: recruits, builds, a move and an air raid, all through the planning reducers. */
  function turn2() {
    recruit("catalunya", "militia-column");
    recruit("valencia", "infantry-regiment");
    build("girona", Dv("farms"));
    const raid = Object.values(S().game.state.units).find((u) => u.factionId === "republic" && /breguet/.test(u.id));
    if (raid) d("game/planAirMission", { unitId: raid.id, mission: { kind: "raid", subTerritoryId: "guadalajara" } });
    d("game/closeAircraftPane");
    // Two moves: the Durruti Column to the Aragón front, and Valencia's new militia south to Murcia.
    move("catalunya", ["rep-durruti-column"], "aragon");
    move("valencia", ["r_republic_militia-column_1"], "murcia");
    d("game/clearUnitSelection");
  }
  function move(from, unitIds, to) {
    d("game/clickMapTerritory", from);
    d("game/clearUnitSelection");
    for (const id of unitIds) d("game/toggleUnitSelection", id);
    d("game/chooseOrderKind", "move");
    d("game/clickMapTerritory", to);
  }
  function midgame({ seed = 42, through = "planning2", orders2 = true } = {}) {
    d("game/startGame", { seed });
    turn1();
    d("game/endTurn");
    if (through === "resolution1") return S().phase;
    d("game/startNextTurn");
    if (orders2) turn2();
    if (through === "resolution2") { d("game/endTurn"); return S().phase; }
    return S().phase;
  }
  return { d, S, recruit, build, move, midgame, turn1, turn2 };
})();
