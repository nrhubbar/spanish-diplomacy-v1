/* Map cluster widgets: partition-splitter (idea 7), rail-capacity (idea 5), city-yield (idea 4). Plain ES2019, no libraries. */
(function () {
  "use strict";
  var W = (window.M3W = window.M3W || {});

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function labelled(text, control) {
    var l = el("label", "w-label");
    l.appendChild(document.createTextNode(text + " "));
    l.appendChild(control);
    return l;
  }
  function select(options, value) {
    var s = document.createElement("select");
    for (var i = 0; i < options.length; i++) {
      var o = document.createElement("option");
      o.value = options[i][0];
      o.textContent = options[i][1];
      s.appendChild(o);
    }
    if (value !== undefined) s.value = value;
    return s;
  }
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }
  function wrapTable(table) {
    var s = el("div", "w-scroll");
    s.appendChild(table);
    return s;
  }
  function row(cells, header) {
    var tr = el("tr");
    for (var i = 0; i < cells.length; i++) tr.appendChild(el(header ? "th" : "td", null, cells[i]));
    return tr;
  }
  function bar(percent, color) {
    var track = el("div", "w-bar-track");
    var b = el("div", "w-bar");
    b.style.width = Math.max(0, Math.min(100, percent)) + "%";
    if (color) b.style.background = color;
    track.appendChild(b);
    return track;
  }

  var FACTION = {
    republic: { name: "Republic", color: "var(--rep)" },
    north: { name: "Northern Insurgent Command", color: "var(--nic)" },
    south: { name: "Southern Insurgent Command", color: "var(--sic)" }
  };

  /* ---------- partition-splitter (idea 7) ---------- */
  W["partition-splitter"] = function (root) {
    if (!root) return;
    // Provinces are the 1833 provinces. Start control = holder of the provincial capital on 31 July 1936
    // (es.wikipedia "Golpe de Estado de julio de 1936"). Adjacency is from recall (unverified). Yields are illustrative.
    var T = {
      andalucia: {
        name: "Andaluc\u00eda",
        factions: ["south", "republic"],
        provinces: [
          { id: "huelva", name: "Huelva", start: "south", yield: 2, adj: ["sevilla"] },
          { id: "sevilla", name: "Sevilla", start: "south", yield: 4, adj: ["huelva", "cadiz", "malaga", "cordoba"] },
          { id: "cadiz", name: "C\u00e1diz", start: "south", yield: 3, adj: ["sevilla", "malaga"] },
          { id: "malaga", name: "M\u00e1laga", start: "republic", yield: 3, adj: ["cadiz", "sevilla", "cordoba", "granada"] },
          { id: "cordoba", name: "C\u00f3rdoba", start: "south", yield: 3, adj: ["sevilla", "malaga", "granada", "jaen"] },
          { id: "jaen", name: "Ja\u00e9n", start: "republic", yield: 2, adj: ["cordoba", "granada"] },
          { id: "granada", name: "Granada", start: "south", yield: 3, adj: ["malaga", "cordoba", "jaen", "almeria"] },
          { id: "almeria", name: "Almer\u00eda", start: "republic", yield: 2, adj: ["granada"] }
        ],
        origins: [
          { id: "extremadura", name: "Extremadura (land)", touches: ["huelva", "sevilla", "cordoba"] },
          { id: "castilla-la-mancha", name: "Castilla-La Mancha (land)", touches: ["cordoba", "jaen", "granada"] },
          { id: "murcia", name: "Murcia (land)", touches: ["granada", "almeria"] },
          { id: "ceuta", name: "Ceuta (sea, Strait)", touches: ["cadiz"] },
          { id: "melilla", name: "Melilla (sea, Alboran)", touches: ["malaga", "almeria"] },
          { id: "inside", name: "Inside the territory (Push order)", touches: [] }
        ]
      },
      aragon: {
        name: "Arag\u00f3n",
        factions: ["north", "republic"],
        provinces: [
          { id: "huesca", name: "Huesca", start: "north", yield: 2, adj: ["zaragoza"] },
          { id: "zaragoza", name: "Zaragoza", start: "north", yield: 3, adj: ["huesca", "teruel"] },
          { id: "teruel", name: "Teruel", start: "north", yield: 2, adj: ["zaragoza"] }
        ],
        origins: [
          { id: "catalunya", name: "Catalu\u00f1a (land)", touches: ["huesca", "zaragoza", "teruel"] },
          { id: "valencia", name: "Valencia (land)", touches: ["teruel"] },
          { id: "castilla-la-mancha", name: "Castilla-La Mancha (land)", touches: ["zaragoza", "teruel"] },
          { id: "navarra", name: "Navarra (land)", touches: ["huesca", "zaragoza"] },
          { id: "inside", name: "Inside the territory (Push order)", touches: [] }
        ]
      },
      extremadura: {
        name: "Extremadura",
        factions: ["south", "republic"],
        provinces: [
          { id: "caceres", name: "C\u00e1ceres", start: "south", yield: 2, adj: ["badajoz"] },
          { id: "badajoz", name: "Badajoz", start: "republic", yield: 3, adj: ["caceres"] }
        ],
        origins: [
          { id: "andalucia", name: "Andaluc\u00eda (land)", touches: ["badajoz"] },
          { id: "castilla-y-leon", name: "Castilla y Le\u00f3n (land)", touches: ["caceres"] },
          { id: "castilla-la-mancha", name: "Castilla-La Mancha (land)", touches: ["caceres", "badajoz"] },
          { id: "inside", name: "Inside the territory (Push order)", touches: [] }
        ]
      }
    };
    // Illustrative grades; the Military cluster's d20 design owns the real ones. "all" = every defender sub-region.
    // Grade ids follow the Military cluster's d20 ladder (research/military.sections.md): ground 0, 1, 2 or all.
    var GRADES = [
      ["0", "attack-stalled or worse (ground 0)"],
      ["1", "defender-gives-ground (ground 1)"],
      ["2", "defender-pushed-back (ground 2)"],
      ["all", "defender-driven-out or better (ground: all)"]
    ];

    var terrSel = select([["andalucia", "Andaluc\u00eda (8 provinces)"], ["aragon", "Arag\u00f3n (3)"], ["extremadura", "Extremadura (2)"]], "andalucia");
    var attSel = document.createElement("select");
    var originSel = document.createElement("select");
    var gradeSel = select(GRADES, "2");
    var resolveBtn = el("button", null, "Resolve battle");
    var resetBtn = el("button", null, "Reset to 31 July 1936");

    var r1 = el("div", "w-row");
    r1.appendChild(labelled("Territory", terrSel));
    r1.appendChild(labelled("Attacker", attSel));
    var r2 = el("div", "w-row");
    r2.appendChild(labelled("Attacking from", originSel));
    r2.appendChild(labelled("Graded result", gradeSel));
    var r3 = el("div", "w-row");
    r3.appendChild(resolveBtn);
    r3.appendChild(resetBtn);
    root.appendChild(r1);
    root.appendChild(r2);
    root.appendChild(r3);

    var stateLine = el("div", "w-row");
    var chips = el("div", "w-grid");
    var log = el("div");
    var income = el("div");
    root.appendChild(stateLine);
    root.appendChild(chips);
    root.appendChild(log);
    root.appendChild(income);
    root.appendChild(el("p", "w-note", "Rule P0: an entry from outside fights only where the enemy zone borders its origin; otherwise it joins its own zone. Rule P1: repeat k times. An entry's first pick must border its origin; after that (and for a Push), candidates border the attacker's own provinces. Pick the one with the most attacker-held neighbours (the origin counts as one); break ties by list order. Start control is the 31 July 1936 holder of each provincial capital (es.wikipedia, \"Golpe de Estado de julio de 1936\"). C\u00f3rdoba and Granada were held as cities only, and their countryside stayed loyal. By the capital rule Arag\u00f3n starts wholly Northern; its Republican eastern strip would need an override. Adjacency is from recall. Yields are illustrative. Grade names follow the Military cluster's proposed d20 ladder (ground 0, 1, 2 or all)."));

    var control = {};

    function current() { return T[terrSel.value]; }
    function byId(t, id) {
      for (var i = 0; i < t.provinces.length; i++) if (t.provinces[i].id === id) return t.provinces[i];
      return null;
    }
    function reset() {
      var t = current();
      control = {};
      for (var i = 0; i < t.provinces.length; i++) control[t.provinces[i].id] = t.provinces[i].start;
    }
    function fillSelectors() {
      var t = current();
      clear(attSel);
      for (var i = 0; i < t.factions.length; i++) {
        var o = document.createElement("option");
        o.value = t.factions[i];
        o.textContent = FACTION[t.factions[i]].name;
        attSel.appendChild(o);
      }
      attSel.value = terrSel.value === "andalucia" ? "south" : "republic";
      clear(originSel);
      for (var j = 0; j < t.origins.length; j++) {
        var p = document.createElement("option");
        p.value = t.origins[j].id;
        p.textContent = t.origins[j].name;
        originSel.appendChild(p);
      }
    }
    function originOf(t) {
      for (var i = 0; i < t.origins.length; i++) if (t.origins[i].id === originSel.value) return t.origins[i];
      return t.origins[0];
    }
    function nearestFallback(t, from, defender) {
      // Breadth-first through the territory's provinces to the nearest one the defender still holds.
      var seen = {}; seen[from] = true;
      var queue = [from];
      while (queue.length) {
        var cur = queue.shift();
        var prov = byId(t, cur);
        for (var i = 0; i < prov.adj.length; i++) {
          var n = prov.adj[i];
          if (seen[n]) continue;
          seen[n] = true;
          if (control[n] === defender) return n;
          queue.push(n);
        }
      }
      return null;
    }
    function resolve() {
      var t = current();
      var attacker = attSel.value;
      var defender = t.factions[0] === attacker ? t.factions[1] : t.factions[0];
      var origin = originOf(t);
      var g = gradeSel.value;
      var k = g === "all" ? 999 : parseInt(g, 10);
      var lines = [];
      var flips = 0;
      var outside = origin.id !== "inside";
      if (outside) {
        // P0: an entry from outside fights only where the enemy's zone borders its origin.
        var front = origin.touches.filter(function (id) { return control[id] === defender; });
        if (front.length === 0) {
          var holdsAny = t.provinces.some(function (p) { return control[p.id] === attacker; });
          lines.push(holdsAny
            ? "Rule P0: no " + FACTION[defender].name + " province borders " + origin.name + ", so this move joins the " + FACTION[attacker].name + "'s own zone as a reinforcement (M11) and no battle is fought. Choose a Push to attack from inside."
            : "No defender-held province borders this origin, so there is no front to attack here.");
          render(lines);
          return;
        }
      }
      while (flips < k) {
        var best = null, bestScore = -1;
        for (var i = 0; i < t.provinces.length; i++) {
          var p = t.provinces[i];
          if (control[p.id] !== defender) continue;
          var fromOrigin = outside && origin.touches.indexOf(p.id) >= 0 ? 1 : 0;
          var held = 0;
          for (var j = 0; j < p.adj.length; j++) if (control[p.adj[j]] === attacker) held += 1;
          if (fromOrigin === 0 && held === 0) continue;
          // The first sub-region an outside entry takes must border its origin.
          if (outside && flips === 0 && fromOrigin === 0) continue;
          var score = fromOrigin + held;
          if (score > bestScore) { best = p; bestScore = score; }
        }
        if (!best) {
          if (flips === 0 && k > 0) lines.push("No defender-held province borders this origin or the attacker's provinces, so the ground is lost.");
          break;
        }
        control[best.id] = attacker;
        flips += 1;
        var fb = nearestFallback(t, best.id, defender);
        lines.push(flips + ". " + best.name + " falls to the " + FACTION[attacker].name + " (score " + bestScore + "). Its defenders " +
          (fb ? "fall back into " + byId(t, fb).name + "." : "have no province left here and retreat out of the territory (M21)."));
      }
      if (k === 0) lines.push("Ground 0: nothing changes hands. The result's losses and demoralization apply as usual.");
      render(lines);
    }
    function render(lines) {
      var t = current();
      clear(chips);
      var totals = {}, counts = {}, total = 0;
      for (var i = 0; i < t.factions.length; i++) { totals[t.factions[i]] = 0; counts[t.factions[i]] = 0; }
      for (var j = 0; j < t.provinces.length; j++) {
        var p = t.provinces[j];
        var f = control[p.id];
        totals[f] += p.yield; counts[f] += 1; total += p.yield;
        var card = el("div", "w-card");
        card.style.borderLeft = "6px solid " + FACTION[f].color;
        card.appendChild(el("strong", null, p.name));
        card.appendChild(el("div", "w-note", FACTION[f].name + ", yield " + p.yield));
        chips.appendChild(card);
      }
      clear(stateLine);
      var holders = t.factions.filter(function (f) { return counts[f] > 0; });
      var stateText = holders.length === 1
        ? "Controlled by the " + FACTION[holders[0]].name + " (counts toward the territory share)"
        : "Partitioned: " + holders.map(function (f) { return FACTION[f].name + " " + counts[f]; }).join(", ") + " (counts for nobody)";
      stateLine.appendChild(el("span", "w-label", "Territory state"));
      stateLine.appendChild(el("span", "w-out", stateText));
      clear(log);
      for (var k = 0; k < (lines || []).length; k++) log.appendChild(el("p", null, lines[k]));
      clear(income);
      income.appendChild(el("p", "w-label", "Income split (illustrative yield points per turn)"));
      for (var m = 0; m < t.factions.length; m++) {
        var fid = t.factions[m];
        var r = el("div", "w-row");
        r.appendChild(el("span", null, FACTION[fid].name + ": "));
        r.appendChild(el("span", "w-out", totals[fid] + " of " + total));
        income.appendChild(r);
        income.appendChild(bar(total ? (100 * totals[fid]) / total : 0, FACTION[fid].color));
      }
    }
    terrSel.addEventListener("change", function () { fillSelectors(); reset(); render([]); });
    resolveBtn.addEventListener("click", resolve);
    resetBtn.addEventListener("click", function () { reset(); render(["Reset to the 31 July 1936 capital holders."]); });
    fillSelectors();
    reset();
    render([]);
  };

  /* ---------- rail-capacity (idea 5) ---------- */
  W["rail-capacity"] = function (root) {
    if (!root) return;
    // Lines follow 1936 main lines between scenario territories (MZA, Norte, Andaluces); steps are territory connections.
    var LINES = [
      { id: "mad-val", name: "Madrid - Albacete - Valencia (MZA)", stops: ["Madrid", "Albacete (Castilla-La Mancha)", "Valencia"] },
      { id: "mad-bcn", name: "Madrid - Guadalajara - Zaragoza - Barcelona", stops: ["Madrid", "Guadalajara (Castilla-La Mancha)", "Zaragoza (Arag\u00f3n)", "Barcelona (Catalu\u00f1a)"] },
      { id: "sev-mad", name: "Sevilla - M\u00e9rida - Talavera - Madrid", stops: ["Sevilla (Andaluc\u00eda)", "M\u00e9rida (Extremadura)", "Talavera (Castilla-La Mancha)", "Madrid"] },
      { id: "sal-mer", name: "Salamanca - Plasencia - M\u00e9rida", stops: ["Salamanca (Castilla y Le\u00f3n)", "M\u00e9rida (Extremadura)"] },
      { id: "bur-bil", name: "Burgos - Miranda - Bilbao (Norte)", stops: ["Burgos (Castilla y Le\u00f3n)", "Bilbao (Pa\u00eds Vasco)"] }
    ];
    // Illustrative: armies per turn on the line, and connections an army can cover in one two-week turn (A-MAP-1).
    var LEVELS = {
      1: { name: "1: single track", cap: 1, range: 2 },
      2: { name: "2: main line", cap: 2, range: 3 },
      3: { name: "3: upgraded", cap: 4, range: 4 }
    };
    var lineSel = select(LINES.map(function (l) { return [l.id, l.name]; }), "mad-val");
    var levelSel = select([["1", LEVELS[1].name], ["2", LEVELS[2].name], ["3", LEVELS[3].name]], "2");
    var armies = document.createElement("input");
    armies.type = "number"; armies.min = "1"; armies.max = "12"; armies.value = "3";
    var damaged = document.createElement("input");
    damaged.type = "checkbox";
    var r1 = el("div", "w-row");
    r1.appendChild(labelled("Line", lineSel));
    var r2 = el("div", "w-row");
    r2.appendChild(labelled("Track level", levelSel));
    r2.appendChild(labelled("Armies to send", armies));
    r2.appendChild(labelled("First segment damaged (one level lower)", damaged));
    root.appendChild(r1);
    root.appendChild(r2);
    var out = el("div");
    root.appendChild(out);
    root.appendChild(el("p", "w-note", "All capacities and ranges are illustrative. The weakest segment caps the route, as in HOI4's railway throughput (GuildOrder HOI4 guide). Rail moves enter only ground the mover controls, with no enemy army, as M11 reinforcements do. On foot an army moves one connection per turn (M2). For scale: the 91 km Torrej\u00f3n to Taranc\u00f3n line took about ten months to build in 1937-38 (V\u00edas Verdes), about 20 two-week turns."));

    function render() {
      clear(out);
      var line = LINES.filter(function (l) { return l.id === lineSel.value; })[0] || LINES[0];
      var level = parseInt(levelSel.value, 10);
      var segments = line.stops.length - 1;
      var weakest = damaged.checked ? Math.max(0, level - 1) : level;
      var n = Math.max(1, Math.min(12, parseInt(armies.value, 10) || 1));
      var t = el("table", "w-table");
      t.appendChild(row(["Segment", "Level"], true));
      for (var i = 0; i < segments; i++) {
        var lv = i === 0 && damaged.checked ? level - 1 : level;
        t.appendChild(row([line.stops[i] + " to " + line.stops[i + 1], lv <= 0 ? "0: cut (repair needed)" : String(lv)]));
      }
      out.appendChild(wrapTable(t));
      if (weakest <= 0) {
        var rc = el("div", "w-row");
        rc.appendChild(el("span", null, "By rail this turn: "));
        rc.appendChild(el("span", "w-out", "0 armies: the line is cut at its first segment"));
        out.appendChild(rc);
        out.appendChild(el("p", "w-note", "On foot, all " + n + " armies need " + segments + " turn(s) to reach " + line.stops[segments] + "."));
        return;
      }
      var cap = LEVELS[weakest].cap;
      var range = LEVELS[weakest].range;
      var byRail = Math.min(n, cap);
      var steps = Math.min(range, segments);
      var waves = Math.ceil(n / cap);
      var turnsPerWave = Math.ceil(segments / range);
      var rows = [
        ["Route capped at level", String(weakest) + " (capacity " + cap + " a turn, range " + range + " connections)"],
        ["By rail this turn", byRail + " of " + n + " armies, reaching " + line.stops[steps]],
        ["Left behind", (n - byRail) + " armies (march one connection, to " + line.stops[Math.min(1, segments)] + ")"],
        ["Rail wave to " + line.stops[segments], turnsPerWave + " turn(s)"],
        ["Rest on foot to " + line.stops[segments], n > byRail ? segments + " turn(s)" : "none left"],
        ["All " + n + " waiting for rail instead", waves * turnsPerWave + " turn(s)"],
        ["All " + n + " on foot", segments + " turn(s)"]
      ];
      var t2 = el("table", "w-table");
      for (var j = 0; j < rows.length; j++) t2.appendChild(row(rows[j]));
      out.appendChild(wrapTable(t2));
      var rr = el("div", "w-row");
      rr.appendChild(el("span", null, "Share that moves by rail this turn: "));
      rr.appendChild(el("span", "w-out", Math.round((100 * byRail) / n) + "%"));
      out.appendChild(rr);
      out.appendChild(bar((100 * byRail) / n, "var(--accent)"));
    }
    lineSel.addEventListener("change", render);
    levelSel.addEventListener("change", render);
    armies.addEventListener("input", render);
    damaged.addEventListener("change", render);
    render();
  };

  /* ---------- city-yield (idea 4) ---------- */
  W["city-yield"] = function (root) {
    if (!root) return;
    // Base yields: the Economy cluster's illustrative table (research/economy.sections.md, idea 4-resources).
    // Funds per turn; Manpower in thousands of men per turn. Ports start at level 1 where a historical port existed.
    var CITIES = [
      { id: "barcelona", name: "Barcelona", funds: 4, men: 1, coastal: true },
      { id: "madrid", name: "Madrid", funds: 3, men: 1, coastal: false },
      { id: "bilbao", name: "Bilbao", funds: 3, men: 0, coastal: true },
      { id: "valencia", name: "Valencia", funds: 2, men: 1, coastal: true },
      { id: "seville", name: "Sevilla (river port)", funds: 2, men: 1, coastal: true },
      { id: "oviedo", name: "Oviedo", funds: 1, men: 0, coastal: false },
      { id: "cartagena", name: "Cartagena", funds: 1, men: 0, coastal: true },
      { id: "zaragoza", name: "Zaragoza", funds: 1, men: 0, coastal: false },
      { id: "malaga", name: "M\u00e1laga", funds: 1, men: 0, coastal: true }
    ];
    // Illustrative build catalogue (scenario data in the proposal): turns, Funds cost, effect.
    var BUILDINGS = [
      { id: "depot", name: "Depot", turns: 2, cost: 3, effect: "+1 recruit limit at this site" },
      { id: "workshop", name: "Workshop", turns: 3, cost: 4, effect: "+1 Funds a turn", funds: 1 },
      { id: "fort", name: "Fortifications", turns: 1, cost: 2, effect: "works start at +1; cap +1" },
      { id: "port", name: "Port upgrade", turns: 3, cost: 4, effect: "+1 army a turn by sea (coastal only)", coastalOnly: true },
      { id: "airfield", name: "Airfield (if idea 8)", turns: 2, cost: 3, effect: "bases aircraft" },
      { id: "railyard", name: "Rail yard (if idea 5)", turns: 2, cost: 3, effect: "+1 capacity on lines from here" }
    ];
    var citySel = select(CITIES.map(function (c) { return [c.id, c.name]; }), "barcelona");
    var r1 = el("div", "w-row");
    r1.appendChild(labelled("City", citySel));
    var supplied = document.createElement("input");
    supplied.type = "checkbox"; supplied.checked = true;
    r1.appendChild(labelled("Supplied (mismatch c)", supplied));
    root.appendChild(r1);
    var r2 = el("div", "w-row");
    var boxes = {};
    for (var i = 0; i < BUILDINGS.length; i++) {
      var cb = document.createElement("input");
      cb.type = "checkbox";
      boxes[BUILDINGS[i].id] = cb;
      r2.appendChild(labelled(BUILDINGS[i].name, cb));
    }
    boxes.workshop.checked = true;
    boxes.depot.checked = true;
    root.appendChild(r2);
    var out = el("div");
    root.appendChild(out);
    root.appendChild(el("p", "w-note", "Base yields are the Economy cluster's illustrative table (Funds; Manpower in thousands of men a turn). Building turns, costs and effects are illustrative. One build at a time per city, in the order listed, paid at reveal (Q-CITY-3). Unsupplied cities yield nothing and cannot recruit (mismatch c)."));

    function render() {
      clear(out);
      var city = CITIES.filter(function (c) { return c.id === citySel.value; })[0] || CITIES[0];
      boxes.port.disabled = !city.coastal;
      if (!city.coastal) boxes.port.checked = false;
      var t = el("table", "w-table");
      t.appendChild(row(["Build", "Starts turn", "Ready turn", "Cost (Funds)", "Effect"], true));
      var turn = 1, spent = 0, extraFunds = 0, payback = [];
      for (var i = 0; i < BUILDINGS.length; i++) {
        var b = BUILDINGS[i];
        if (!boxes[b.id].checked) continue;
        var start = turn, ready = turn + b.turns;
        turn = ready;
        spent += b.cost;
        if (b.funds) { extraFunds += b.funds; payback.push(b.name + " pays back its " + b.cost + " Funds by turn " + (ready + Math.ceil(b.cost / b.funds))); }
        t.appendChild(row([b.name, String(start), String(ready), String(b.cost), b.effect]));
      }
      if (spent === 0) t.appendChild(row(["(nothing queued)", "", "", "0", ""]));
      out.appendChild(wrapTable(t));
      var on = supplied.checked;
      var fundsNow = on ? city.funds : 0;
      var fundsAfter = on ? city.funds + extraFunds : 0;
      var men = on ? city.men : 0;
      var cards = el("div", "w-grid");
      function card(label, value, note) {
        var c = el("div", "w-card");
        c.appendChild(el("div", "w-label", label));
        c.appendChild(el("div", "w-out", value));
        if (note) c.appendChild(el("div", "w-note", note));
        cards.appendChild(c);
      }
      card("Funds a turn now", String(fundsNow), on ? "base yield" : "unsupplied: 0");
      card("Funds a turn when built", String(fundsAfter), "from turn " + turn);
      card("Manpower a turn", men + "k", "cities yield little Manpower; rural ground yields most");
      card("Queue finishes", "turn " + turn, (turn - 1) + " turns, " + spent + " Funds");
      out.appendChild(cards);
      for (var p = 0; p < payback.length; p++) out.appendChild(el("p", "w-note", payback[p]));
      out.appendChild(bar(fundsAfter ? (100 * fundsAfter) / 6 : 0, "var(--good)"));
      out.appendChild(el("p", "w-note", "Bar: Funds a turn once built, against an illustrative maximum of 6."));
    }
    citySel.addEventListener("change", render);
    supplied.addEventListener("change", render);
    for (var k in boxes) if (Object.prototype.hasOwnProperty.call(boxes, k)) boxes[k].addEventListener("change", render);
    render();
  };
})();
