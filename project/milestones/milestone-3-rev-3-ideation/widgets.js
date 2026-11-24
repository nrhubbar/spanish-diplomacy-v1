/* Milestone 3 Rev 3, economy widgets. Plain browser JS, no libraries. Numbers come from window.M3W_DATA (tools/econ-data.json). */
(function () {
  "use strict";
  var W = (window.M3W = window.M3W || {});

  /* ================= model: pure arithmetic, no battles ================= */
  var M = (window.M3W_ECON = {});
  var NEGATIVE = { "cannot-attack-alone": true };

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function data() { return window.M3W_DATA; }
  M.faction = function (id) { return data().factions.filter(function (f) { return f.id === id; })[0]; };

  /** The rules of a package: units, projects, upkeep and roll modifiers, today's with the package's changes on top. */
  M.rules = function (pkg) {
    var D = data(), p = D.proposals[pkg] || null;
    var units = {}, projects = {};
    D.units.forEach(function (u) { units[u.id] = Object.assign(clone(u), p && p.units[u.id] ? p.units[u.id] : {}); });
    D.projects.forEach(function (x) { projects[x.id] = Object.assign(clone(x), p && p.projects[x.id] ? p.projects[x.id] : {}); });
    return {
      id: p ? pkg : "today", name: p ? p.name : "Today", units: units, projects: projects,
      upkeep: p ? { kind: "share", rate: p.upkeep.share, free: p.upkeep.free, machineFunds: p.upkeep.machineFunds } : { kind: "none", rate: 0, free: 0, machineFunds: 0 },
      popularResistance: p ? p.popularResistance : D.d20.popularResistance,
      barricades: p ? p.barricades : D.d20.barricades
    };
  };

  M.isMachine = function (u) { return !u.foot; };

  /** One full-strength unit's Manpower and Funds upkeep a turn. "men" reads the unit's actual men (opening columns). */
  M.unitUpkeep = function (u, up, men) {
    var m = 0;
    if (u.upkeepM !== undefined) return { manpower: u.upkeepM, funds: M.isMachine(u) ? (up.machineFunds || 0) : 0 };
    if (up.kind === "flat") m = u.kind === "ground" ? up.rate : 0;
    else if (up.kind === "share" || up.kind === "split") m = up.rate * u.establishment / 1000;
    else if (up.kind === "men") m = up.rate * (men === undefined ? u.establishment : men) / 1000;
    return { manpower: m, funds: M.isMachine(u) ? (up.machineFunds || 0) : 0 };
  };

  /** A whole army's upkeep. counts: {unitId: n}. openingMen: {unitId: men} adds actual men for the "men" model. */
  M.armyUpkeep = function (rules, counts, faction, fill) {
    var up = rules.upkeep, m = 0, f = 0, ground = 0;
    fill = fill === undefined ? 1 : fill;
    Object.keys(counts).forEach(function (id) {
      var u = rules.units[id], n = counts[id];
      var open = faction.army[id];
      if (u.kind === "ground") ground += n;
      if (up.kind === "men" && open) {
        var early = Math.min(n, open.count);
        m += up.rate * (open.men * early / open.count + (n - early) * u.establishment) / 1000;
      } else m += n * M.unitUpkeep(u, up).manpower;
      f += n * M.unitUpkeep(u, up).funds;
    });
    if (up.kind === "softcap") m = Math.max(0, ground - up.perTerritory * faction.territories.length) * up.rate;
    return { manpower: Math.max(0, m * fill - (up.free || 0)), funds: f, gross: m * fill };
  };

  M.openingCounts = function (faction) {
    var c = {};
    Object.keys(faction.army).forEach(function (id) { c[id] = faction.army[id].count; });
    return c;
  };
  M.value = function (rules, counts) {
    var a = 0, d = 0, n = 0;
    Object.keys(counts).forEach(function (id) { var u = rules.units[id]; if (u.kind !== "ground") return; a += counts[id] * u.attack; d += counts[id] * u.defence; n += counts[id]; });
    return { attack: a, defence: d, units: n };
  };

  /** Income a turn, with the rules' industry yield on every level already standing. */
  M.income = function (rules, faction, settled) {
    var base = settled ? faction.incomeSettled : faction.income;
    var levels = settled ? faction.industryLevelsSettled : faction.industryLevels;
    return { funds: base.funds + levels * ((rules.projects.industry["yield"] || 1) - 1), manpower: base.manpower };
  };

  /** Engine timing: a build ordered on turn t with n turns pays first at the end of turn t+n-1. */
  M.payback = function (order, turns, cost, yields) {
    var first = order + turns - 1;
    return { first: first, even: first + Math.ceil(cost / yields) - 1, netBy: function (T) { return Math.max(0, T - first + 1) * yields - cost; } };
  };

  /**
   * A deterministic projection of one side that never fights. strategy: "militia" | "infantry" | "mix" | "none".
   * A mix raises militia up to opts.cap, then spends what is left on infantry. opts: turns, settleFrom (the turn from
   * which contested ground pays its majority holder; 0 = never), eco (share of opening Funds put into mines and
   * industry on turn 1), prudent (default true: never raises an army its income and stock cannot feed to the end).
   */
  M.project = function (rules, factionId, strategy, opts) {
    var f = M.faction(factionId), turns = opts.turns || 12, rows = [], D = data();
    var F = f.stock.funds, P = f.stock.manpower, counts = M.openingCounts(f), raised = {}, training = [], upgrades = [];
    var fill = 1, prudent = opts.prudent !== false, t, k;
    var mil = rules.units["militia-column"], inf = rules.units["infantry-regiment"];
    var cap = strategy === "militia" ? 999 : strategy === "mix" ? (opts.cap === undefined ? 10 : opts.cap) : 0;
    var incomeAt = function (x) { return M.income(rules, f, !!opts.settleFrom && x >= opts.settleFrom); };
    for (t = 1; t <= turns; t += 1) {
      var inc = incomeAt(t), ahead = 0, bought = { m: 0, i: 0, up: 0 };
      for (k = t; k <= turns; k += 1) ahead += incomeAt(k).manpower;
      if (t === 1 && opts.eco) {
        var purse = f.stock.funds * opts.eco;
        ["mines", "industry"].forEach(function (id) {
          var pr = rules.projects[id], sites = f.upgrades[id];
          while (sites > 0 && purse >= pr.funds) { purse -= pr.funds; F -= pr.funds; sites -= 1; bought.up += 1; upgrades.push({ from: t + pr.turns - 1, y: pr["yield"] || 1 }); }
        });
      }
      if (strategy !== "none") {
        var later = Object.assign({}, counts);
        training.forEach(function (x) { later[x.id] = (later[x.id] || 0) + 1; });
        var buy = function (u) {
          if (bought.m + bought.i >= f.slots || F < u.funds || P < u.manpower) return false;
          later[u.id] = (later[u.id] || 0) + 1;
          if (prudent) {
            var bill = M.armyUpkeep(rules, later, f, fill).manpower * (turns - t + 1);
            if (bill > P - u.manpower + ahead) { later[u.id] -= 1; return false; }
          }
          F -= u.funds; P -= u.manpower;
          training.push({ id: u.id, at: t + u.train - 1 });
          return true;
        };
        var pendingMil = training.filter(function (x) { return x.id === mil.id; }).length;
        while ((raised[mil.id] || 0) + pendingMil + bought.m < cap && buy(mil)) bought.m += 1;
        if (strategy !== "militia") while (buy(inf)) bought.i += 1;
      }
      training = training.filter(function (x) {
        if (x.at > t) return true;
        counts[x.id] = (counts[x.id] || 0) + 1; raised[x.id] = (raised[x.id] || 0) + 1;
        return false;
      });
      var extra = upgrades.reduce(function (s, u) { return s + (t >= u.from ? u.y : 0); }, 0);
      var up = M.armyUpkeep(rules, counts, f, fill), short = 0;
      F += inc.funds + extra - up.funds;
      P += inc.manpower - up.manpower;
      if (P < -1e-9) {
        short = -P; P = 0;
        var men = 0;
        Object.keys(counts).forEach(function (id) { men += counts[id] * rules.units[id].establishment / 1000; });
        fill = Math.max(0.5, fill - Math.min(0.1, short / Math.max(1, men)));
      }
      var fShort = F < -1e-9; if (F < 0) F = 0;
      var v = M.value(rules, counts);
      rows.push({ turn: t, funds: F, manpower: P, income: { funds: inc.funds + extra, manpower: inc.manpower }, upkeep: up, short: short, fundsShort: fShort, counts: Object.assign({}, counts), raised: Object.assign({}, raised), value: { attack: v.attack * fill, defence: v.defence * fill, units: v.units }, fill: fill, bought: bought });
    }
    return rows;
  };

  /** The militia cap whose mix has the most attack plus defence on the last turn. */
  M.bestMix = function (rules, factionId, opts) {
    var best = null;
    for (var cap = 0; cap <= 90; cap += 3) {
      var rows = M.project(rules, factionId, "mix", Object.assign({}, opts, { cap: cap }));
      var v = rows[rows.length - 1].value, score = v.attack + v.defence;
      if (!best || score > best.score + 1e-9) best = { cap: cap, score: score, rows: rows };
    }
    return best;
  };

  /** Unit types another type beats or matches on price, upkeep, training, combat and abilities, with no harder requirement. */
  M.dominated = function (rules, up) {
    var list = Object.keys(rules.units).map(function (k) { return rules.units[k]; });
    var out = [];
    list.forEach(function (a) {
      list.forEach(function (b) {
        if (a === b || a.kind !== b.kind) return;
        var ua = M.unitUpkeep(a, up || rules.upkeep), ub = M.unitUpkeep(b, up || rules.upkeep);
        var skills = a.abilities.every(function (x) { return NEGATIVE[x] || b.abilities.indexOf(x) >= 0; }) && !(b.abilities.some(function (x) { return NEGATIVE[x]; }) && !a.abilities.some(function (x) { return NEGATIVE[x]; }));
        var reach = b.requires.every(function (x) { return a.requires.indexOf(x) >= 0; }) && (!b.factionIds || (a.factionIds && a.factionIds.every(function (x) { return b.factionIds.indexOf(x) >= 0; })));
        if (!skills || !reach) return;
        var pairs = [[b.funds, a.funds], [b.manpower, a.manpower], [b.train, a.train], [ub.manpower, ua.manpower], [ub.funds, ua.funds], [-b.attack, -a.attack], [-b.defence, -a.defence]];
        if (pairs.every(function (p) { return p[0] <= p[1]; }) && pairs.some(function (p) { return p[0] < p[1]; })) out.push({ unit: a, by: b });
      });
    });
    return out;
  };

  /** The d20 table: take and gain chances for an odds column and a roll modifier. */
  M.odds = function (column, modifier) {
    var D = data().d20, take = 0, gain = 0;
    for (var die = 1; die <= 20; die += 1) {
      var g = D.grades[D.table[column][Math.min(20, Math.max(0, die + modifier))]];
      if (g.take) take += 0.05; if (g.gain) gain += 0.05;
    }
    return { take: take, gain: gain };
  };
  /* ---------------- tenets: each computed from the data ---------------- */
  var FACTIONS = ["republic", "north", "south"];
  function pct(x) { return Math.round(x * 100) + "%"; }
  function r1(x) { return Math.round(x * 10) / 10; }
  M.OPTS = { turns: 10, settleFrom: 3 };
  M.added = function (rules, id, rows) {
    var v = rows[rows.length - 1].value, o = M.value(rules, M.openingCounts(M.faction(id)));
    return { attack: v.attack - o.attack, defence: v.defence - o.defence };
  };
  M.tenets = function (rules) {
    var D = data(), out = [], mines = rules.projects.mines, ind = rules.projects.industry;
    var add = function (id, name, target, shown, ok) { out.push({ id: id, name: name, target: target, shown: shown, ok: ok }); };
    var even = [mines, ind].map(function (p) { return M.payback(1, p.turns, p.funds, p["yield"]).even; });
    add("payback", "A build started on turn 1 pays back by turn 7", "7 or sooner", "Mines turn " + even[0] + ", Industry turn " + even[1], Math.max.apply(null, even) <= 7);
    var late = [mines, ind].map(function (p) { return M.payback(3, p.turns, p.funds, p["yield"]).netBy(10); });
    add("late", "A build started on turn 3 still profits in a 10-turn game", "above 0 Funds by turn 10", "Mines " + signed(late[0]) + ", Industry " + signed(late[1]), Math.min.apply(null, late) > 0);
    // Economy opening against an army opening, the Republic, infantry with what is left.
    var army = M.project(rules, "republic", "infantry", M.OPTS), eco = M.project(rules, "republic", "infantry", Object.assign({ eco: 0.5 }, M.OPTS));
    var sum = function (rows, t) { var v = rows[t - 1].value; return v.attack + v.defence; };
    var lag = sum(eco, 5) / sum(army, 5) - 1, lead = sum(eco, 10) / sum(army, 10) - 1;
    add("tempo", "An economy opening is behind at turn 5 and ahead by turn 10", "behind, then at least 2% ahead", "turn 5 " + signed(Math.round(lag * 100)) + "%, turn 10 " + signed(Math.round(lead * 100)) + "%", lag < 0 && lead >= 0.02);
    var dom = M.dominated(rules);
    add("dominated", "No unit is strictly worse than another", "none", dom.length ? dom.map(function (x) { return x.unit.name + " (worse than " + x.by.name + ")"; }).join(", ") : "none", dom.length === 0);
    var champ = M.champion(rules);
    add("champion", "No foot unit leads on more than two of five measures", "2 or fewer", champ.name + " leads " + champ.wins + " (" + champ.on.join(", ") + ")", champ.wins <= 2);
    var ratios = FACTIONS.map(function (id) { return M.added(rules, id, M.project(rules, id, "militia", M.OPTS)).attack / M.added(rules, id, M.project(rules, id, "infantry", M.OPTS)).attack; });
    add("militia", "Militia alone adds less attack than regulars on the same income", "95% or less for every side", FACTIONS.map(function (id, i) { return short(id) + " " + pct(ratios[i]); }).join(", "), Math.max.apply(null, ratios) <= 0.95);
    var mixes = FACTIONS.map(function (id) { return M.bestMix(rules, id, M.OPTS); });
    var bite = mixes.map(function (m) { var last = m.rows[m.rows.length - 1]; return last.upkeep.manpower / last.income.manpower; });
    add("bite", "By turn 10 a full-size army eats at least 30% of its Manpower income", "30% to 100% for every side", FACTIONS.map(function (id, i) { return short(id) + " " + pct(bite[i]); }).join(", "), Math.min.apply(null, bite) >= 0.3 && Math.max.apply(null, bite) <= 1);
    var start = FACTIONS.map(function (id) { var f = M.faction(id), u = M.armyUpkeep(rules, M.openingCounts(f), f), rows = M.project(rules, id, "none", { turns: 4 }); return { share: u.manpower / Math.max(1, f.income.manpower), short: rows.some(function (x) { return x.short > 0; }) }; });
    add("broke", "Nobody starts broke", "opening upkeep under 40% of Manpower income, no shortage in 4 idle turns", rules.upkeep.kind === "none" ? "no upkeep to pay" : FACTIONS.map(function (id, i) { return short(id) + " " + pct(start[i].share) + (start[i].short ? " and runs short" : ""); }).join(", "), start.every(function (x) { return x.share <= 0.4 && !x.short; }));
    var p = D.proposals[rules.id];
    add("slope", "A shortage costs men gradually and can be undone", "at most 10% of strength a turn, never below half", p ? "cap " + pct(p.upkeep.lossCap) + " a turn, floor " + pct(p.upkeep.floor) : "no upkeep, so no shortage", p ? p.upkeep.lossCap <= 0.1 && p.upkeep.floor >= 0.5 : true);
    var used = FACTIONS.map(function (id) { var rows = M.project(rules, id, "infantry", M.OPTS), f = M.faction(id), total = f.stock.manpower; rows.forEach(function (x) { total += x.income.manpower; }); return 1 - rows[rows.length - 1].manpower / Math.max(1, total); });
    add("scarce", "Manpower is scarce enough to plan around", "a regular army uses at least 40% of it", FACTIONS.map(function (id, i) { return short(id) + " " + pct(used[i]); }).join(", "), Math.min.apply(null, used) >= 0.4);
    add("equal", "Sides differ by armies and land, not by a permanent die bonus", "0 off the enemy roll for one side only", rules.popularResistance ? "Republic " + rules.popularResistance + " (one odds column)" : "none", rules.popularResistance === 0);
    var al = p ? p.alarm : D.alarm, gap1 = 1 + Math.max(0, al.steps - 1) * al.perStep;
    add("leader", "The side one step from winning draws the fire", "attacking it is valued at least as much as guarding own ground (x" + (1 + al.critical) + ")", "x" + gap1, gap1 >= 1 + al.critical);
    return out;
  };
  function signed(n) { return (n > 0 ? "+" : n < 0 ? "\u2212" : "") + Math.abs(n); }
  function short(id) { return { republic: "Republic", north: "North", south: "South" }[id]; }
  M.signed = signed;

  /** Foot units measured on five axes; which type leads the most (ties share the lead). */
  M.champion = function (rules) {
    var up = rules.upkeep;
    var foot = Object.keys(rules.units).map(function (k) { return rules.units[k]; }).filter(function (u) { return u.kind === "ground" && u.foot; });
    var axes = {
      "attack per Fund": function (u) { return u.attack / u.funds; },
      "defence per Fund": function (u) { return u.defence / u.funds; },
      "attack per Manpower over 10 turns": function (u) { return u.attack / (u.manpower + 10 * M.unitUpkeep(u, up).manpower); },
      "defence per Manpower over 10 turns": function (u) { return u.defence / (u.manpower + 10 * M.unitUpkeep(u, up).manpower); },
      "training speed": function (u) { return 1 / u.train; }
    };
    var wins = {};
    Object.keys(axes).forEach(function (k) {
      var top = Math.max.apply(null, foot.map(axes[k]));
      var leaders = foot.filter(function (u) { return axes[k](u) >= top - 1e-9; });
      leaders.forEach(function (u) { (wins[u.id] = wins[u.id] || []).push(k); });
    });
    var best = Object.keys(wins).sort(function (a, b) { return wins[b].length - wins[a].length; })[0];
    return { name: rules.units[best].name, wins: wins[best].length, on: wins[best] };
  };
  /* ================= shared UI helpers ================= */
  var uid = 0;
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; }
  function put(parent) { for (var i = 1; i < arguments.length; i += 1) parent.appendChild(arguments[i]); return parent; }
  function field(text, control) { var l = el("label"); var s = el("span", "w-label", text); uid += 1; control.id = control.id || "econ-" + uid; l.htmlFor = control.id; return put(l, s, control); }
  function number(value, min, max, step, onChange) {
    var n = el("input"); n.type = "number"; n.value = value; n.min = min; n.max = max; n.step = step; n.style.width = "5.2em";
    n.addEventListener("input", function () { var v = parseFloat(n.value); if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v))); });
    return n;
  }
  function choose(options, value, onChange) {
    var s = el("select");
    options.forEach(function (o) { var x = el("option", null, o[1]); x.value = o[0]; s.appendChild(x); });
    s.value = value;
    s.addEventListener("change", function () { onChange(s.value); });
    return s;
  }
  function table(head, rows, caption) {
    var wrap = el("div", "w-scroll"), t = el("table", "w-table"), tr = el("tr"), thead = el("thead"), body = el("tbody");
    wrap.tabIndex = 0; wrap.setAttribute("role", "region"); wrap.setAttribute("aria-label", caption || "Table");
    if (caption) { var c = el("caption", "w-note", caption); c.style.textAlign = "left"; c.style.padding = "0 0 4px"; t.appendChild(c); }
    t.style.overflowWrap = "normal"; t.style.wordBreak = "normal";
    head.forEach(function (h) { var th = el("th", null, h); th.scope = "col"; tr.appendChild(th); });
    thead.appendChild(tr); t.appendChild(thead);
    rows.forEach(function (r) {
      var row = el("tr");
      r.forEach(function (cell, i) {
        var td = el(i === 0 ? "th" : "td"); if (i === 0) { td.scope = "row"; td.style.background = "transparent"; }
        if (cell && cell.nodeType) td.appendChild(cell); else td.textContent = String(cell);
        if (i > 0) td.style.fontVariantNumeric = "tabular-nums";
        row.appendChild(td);
      });
      body.appendChild(row);
    });
    t.appendChild(body); wrap.appendChild(t);
    return wrap;
  }
  function badge(ok, text) { var b = el("strong", null, (ok ? "✓ " : "✗ ") + text); b.style.color = ok ? "var(--good)" : "var(--bad)"; return b; }
  function svg(tag, attrs, text) { var n = document.createElementNS("http://www.w3.org/2000/svg", tag); Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); }); if (text !== undefined) n.textContent = text; return n; }
  /** Lines over turns 1..n, on one axis, direct-labelled, with a focusable readout per turn. series: {name, color, dash, values}. */
  function lines(root, series, opts) {
    var w = Math.max(260, Math.min(720, (root.clientWidth || 600) - 34)), h = 210, left = 40, right = 92, top = 10, bottom = 30;
    var n = series[0].values.length, all = [0];
    series.forEach(function (s) { all = all.concat(s.values); });
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all); if (hi === lo) hi = lo + 1;
    var X = function (i) { return left + (n < 2 ? 0 : i * (w - left - right) / (n - 1)); };
    var Y = function (v) { return top + (hi - v) * (h - top - bottom) / (hi - lo); };
    var g = svg("svg", { viewBox: "0 0 " + w + " " + h, width: w, height: h, role: "img", "aria-label": opts.title });
    (lo < 0 ? [lo, 0, hi] : [lo, (lo + hi) / 2, hi]).forEach(function (v) {
      g.appendChild(svg("line", { x1: left, x2: w - right, y1: Y(v), y2: Y(v), stroke: "var(--line)", "stroke-width": v === 0 ? 1.5 : 1 }));
      g.appendChild(svg("text", { x: left - 5, y: Y(v) + 4, "text-anchor": "end", "font-size": 11, fill: "var(--ink-soft)" }, String(Math.round(v))));
    });
    for (var i = 0; i < n; i += 1) if (i === 0 || i === n - 1 || (i + 1) % Math.ceil(n / 6) === 0) g.appendChild(svg("text", { x: X(i), y: h - 12, "text-anchor": "middle", "font-size": 11, fill: "var(--ink-soft)" }, (i === 0 ? "Turn " : "") + (i + 1)));
    var ends = series.map(function (s, k) { return { k: k, y: Y(s.values[n - 1]) }; }).sort(function (a, b) { return a.y - b.y; });
    for (i = 1; i < ends.length; i += 1) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
    series.forEach(function (s, k) {
      g.appendChild(svg("polyline", { points: s.values.map(function (v, j) { return X(j) + "," + Y(v); }).join(" "), fill: "none", stroke: s.color, "stroke-width": 2, "stroke-dasharray": s.dash || "", "stroke-linejoin": "round" }));
      s.values.forEach(function (v, j) { var dot = svg("circle", { cx: X(j), cy: Y(v), r: s.mark && s.mark[j] ? 5 : 3, fill: s.mark && s.mark[j] ? "var(--bad)" : s.color, stroke: "var(--surface)", "stroke-width": 1.5 }); dot.appendChild(svg("title", {}, s.name + ", turn " + (j + 1) + ": " + r1(v))); g.appendChild(dot); });
      var end = ends.filter(function (e) { return e.k === k; })[0];
      g.appendChild(svg("text", { x: X(n - 1) + 8, y: end.y + 4, "font-size": 11.5, fill: "var(--ink)" }, s.name));
    });
    var box = el("div"), read = el("div", "w-note"); read.setAttribute("aria-live", "polite");
    var slider = el("input"); slider.type = "range"; slider.min = 1; slider.max = n; slider.value = opts.at || n;
    var show = function () { var j = slider.value - 1; read.textContent = "Turn " + slider.value + ": " + series.map(function (s) { return s.name + " " + r1(s.values[j]); }).join("; ") + "."; };
    slider.addEventListener("input", show); show();
    var head = el("div", "w-label", opts.title);
    return put(box, head, g, put(el("div", "w-row"), field("Read turn", slider)), read);
  }
  function live(root, build) {
    var draw = function () { build(); }, width = root.clientWidth, timer;
    draw();
    window.addEventListener("resize", function () { clearTimeout(timer); timer = setTimeout(function () { if (root.clientWidth !== width) { width = root.clientWidth; draw(); } }, 150); });
    return draw;
  }
  var COLOR = { republic: "var(--rep)", north: "var(--nic)", south: "var(--sic)" };
  var PACKAGES = function () { return [["today", "Today"], ["measured", "Moderate (recommended)"], ["bold", "Bold"]]; };
  function fixed(n, d) { return n === Infinity || isNaN(n) ? "–" : n.toFixed(d === undefined ? 2 : d); }

  /* ================= upkeep-lab ================= */
  W["upkeep-lab"] = function (root) {
    if (!root) return;
    root.textContent = "";
    var D = data(), st = { pkg: "measured", preset: "share", rate: 0.5, free: 6, funds: 0, plan: "mix", settle: 3 };
    var controls = el("div", "w-row"), out = el("div");
    out.style.display = "grid"; out.style.gap = "10px"; out.style.minWidth = "0"; out.style.gridTemplateColumns = "minmax(0,1fr)";
    var rateIn = number(st.rate, 0, 3, 0.05, function (v) { st.rate = v; draw(); });
    var freeIn = number(st.free, 0, 30, 1, function (v) { st.free = v; draw(); });
    var fundsIn = number(st.funds, 0, 3, 0.25, function (v) { st.funds = v; draw(); });
    var preset = choose(D.upkeepPresets.map(function (p) { return [p.id, p.name]; }), st.preset, function (v) {
      var p = D.upkeepPresets.filter(function (x) { return x.id === v; })[0];
      st.preset = v; st.rate = p.rate; st.free = p.free || 0; st.funds = p.machineFunds || 0;
      rateIn.value = st.rate; freeIn.value = st.free; fundsIn.value = st.funds; draw();
    });
    put(controls,
      field("Upkeep model", preset), field("Rate", rateIn), field("Free Manpower a turn", freeIn), field("Funds per machine", fundsIn),
      field("Prices", choose(PACKAGES(), st.pkg, function (v) { st.pkg = v; draw(); })),
      field("Army", choose([["none", "Opening army, no recruits"], ["mix", "Best mix"], ["militia", "Militia only"], ["infantry", "Infantry only"]], st.plan, function (v) { st.plan = v; draw(); })),
      field("Contested ground pays", choose([["0", "Nobody"], ["3", "Its main holder, from turn 3"], ["5", "Its main holder, from turn 5"]], String(st.settle), function (v) { st.settle = Number(v); draw(); })));
    put(root, controls, out);
    var draw = live(root, function () {
      var rules = M.rules(st.pkg), p = D.upkeepPresets.filter(function (x) { return x.id === st.preset; })[0];
      rules.upkeep = { kind: p.kind, rate: st.rate, free: st.free, machineFunds: st.funds, perTerritory: p.perTerritory || 0 };
      var opts = { turns: 12, settleFrom: st.settle }, series = [], rows = [];
      FACTIONS.forEach(function (id) {
        var f = M.faction(id), run = st.plan === "mix" ? M.bestMix(rules, id, opts).rows : M.project(rules, id, st.plan, opts);
        var open = M.armyUpkeep(rules, M.openingCounts(f), f), zero = run.filter(function (x) { return x.short > 0; })[0], a = run[5], b = run[9];
        var eats = function (x) { return r1(x.upkeep.manpower) + " of " + r1(x.income.manpower) + (x.upkeep.funds ? ", " + r1(x.upkeep.funds) + " Funds" : ""); };
        rows.push([short(id), f.stock.funds + " F, " + f.stock.manpower + " M", f.income.funds + " F, " + f.income.manpower + " M", r1(open.manpower) + " M" + (open.funds ? ", " + r1(open.funds) + " F" : ""), signed(r1(f.income.manpower - open.manpower)) + " M", a.value.units + " units, " + eats(a), b.value.units + " units, " + eats(b), zero ? badge(false, "turn " + zero.turn) : badge(true, "never")]);
        series.push({ name: short(id), color: COLOR[id], dash: id === "north" ? "6 4" : id === "south" ? "2 4" : "", values: run.map(function (x) { return x.manpower; }), mark: run.map(function (x) { return x.short > 0; }) });
      });
      out.textContent = "";
      put(out, table(["Side", "Opening stock", "Opening income", "Opening upkeep", "Opening net", "Turn 6: upkeep of income", "Turn 10: upkeep of income", "Stock runs out"], rows, "F is Funds, M is Manpower (1 is about 1,000 men)."),
        lines(root, series, { title: "Manpower in stock at the end of each turn", at: 10 }),
        el("p", "w-note", "Red dots are turns when the stock runs out. This is arithmetic, not a game: nobody fights, loses men, replenishes or takes ground, and contested ground pays at most its main holder. The unit count leaves out aircraft and generals."));
    });
  };

  /* ================= unit-value ================= */
  W["unit-value"] = function (root) {
    if (!root) return;
    root.textContent = "";
    var pkg = "measured", rules, controls = el("div", "w-row"), out = el("div"), warn = el("div");
    out.style.minWidth = "0"; warn.setAttribute("aria-live", "polite");
    var metrics = {};
    function reset() {
      rules = M.rules(pkg);
      Object.keys(rules.units).forEach(function (k) { rules.units[k].upkeepM = r1(M.unitUpkeep(rules.units[k], rules.upkeep).manpower * 100) / 100; });
    }
    function update() {
      var list = Object.keys(rules.units).map(function (k) { return rules.units[k]; });
      list.forEach(function (u) {
        var ten = u.manpower + 10 * u.upkeepM;
        var cells = [fixed(u.attack / u.funds), fixed(u.defence / u.funds), fixed((u.attack + u.defence) / ten), fixed((u.attack + u.defence) / u.train, 1)];
        cells.forEach(function (c, i) { metrics[u.id][i].textContent = c; });
      });
      var dom = M.dominated(rules), champ = M.champion(rules);
      warn.textContent = "";
      if (!dom.length) put(warn, badge(true, "No unit is strictly worse than another."));
      dom.forEach(function (x) { put(warn, put(el("div"), badge(false, x.unit.name + " is never worth buying: " + x.by.name + " matches or beats it on everything."))); });
      put(warn, put(el("div"), badge(champ.wins <= 2, champ.name + " leads " + champ.wins + " of 5 foot-unit measures: " + champ.on.join(", ") + ".")));
    }
    function draw() {
      out.textContent = ""; metrics = {};
      var rows = Object.keys(rules.units).map(function (k) {
        var u = rules.units[k];
        var input = function (key, max, step) { var n = number(u[key], key === "train" || key === "funds" ? 1 : 0, max, step, function (v) { u[key] = v; update(); }); n.setAttribute("aria-label", u.name + " " + key); n.style.width = "4.4em"; return n; };
        metrics[u.id] = [0, 1, 2, 3].map(function () { var s = el("span", "w-out", ""); s.style.whiteSpace = "nowrap"; return s; });
        return [u.name, input("funds", 40, 1), input("manpower", 10, 1), input("upkeepM", 5, 0.05), input("attack", 12, 1), input("defence", 12, 1), input("train", 8, 1)].concat(metrics[u.id]);
      });
      put(out, table(["Unit", "Funds", "Man­power", "Upkeep a turn", "Attack", "Defence", "Turns to train", "Attack per Fund", "Defence per Fund", "Strength per Manpower, 10 turns", "Strength per training turn"], rows, "Edit any number. Upkeep is in Manpower (0.25 is about 250 men)."));
      update();
    }
    put(controls, field("Start from", choose(PACKAGES(), pkg, function (v) { pkg = v; reset(); draw(); })));
    put(root, controls, warn, out, el("p", "w-note", "Strength is attack plus defence. The figures leave out special effects: artillery and tanks add to the attack roll, trucks carry, aircraft fly missions, and cavalry marches further."));
    reset(); draw();
  };

  /* ================= payback ================= */
  W.payback = function (root) {
    if (!root) return;
    root.textContent = "";
    var D = data(), st = { cost: 8, turns: 3, yield: 1, order: 1, length: 13 }, out = el("div"), presets = el("div", "w-row"), controls = el("div", "w-row"), ins = {};
    out.style.minWidth = "0";
    [["cost", "Cost", 1, 40, 1], ["turns", "Turns to build", 1, 10, 1], ["yield", "Pays a turn", 1, 5, 1], ["order", "Ordered on turn", 1, 20, 1], ["length", "Game length", 4, 30, 1]].forEach(function (c) {
      ins[c[0]] = number(st[c[0]], c[2], c[3], c[4], function (v) { st[c[0]] = Math.round(v); draw(); });
      put(controls, field(c[1], ins[c[0]]));
    });
    [["today", "today"], ["measured", "proposed"]].forEach(function (k) {
      ["farms", "mines", "industry"].forEach(function (id) {
        var p = M.rules(k[0]).projects[id], b = el("button", null, p.name + ", " + k[1]); b.type = "button";
        b.addEventListener("click", function () { st.cost = p.funds; st.turns = p.turns; st.yield = p["yield"] || 1; ["cost", "turns", "yield"].forEach(function (x) { ins[x].value = st[x]; }); draw(); });
        presets.appendChild(b);
      });
    });
    put(root, presets, controls, out);
    var draw = live(root, function () {
      var p = M.payback(st.order, st.turns, st.cost, st.yield), values = [];
      for (var t = 1; t <= st.length; t += 1) values.push(t < st.order ? 0 : p.netBy(t));
      var net = values[st.length - 1];
      out.textContent = "";
      var grid = el("div", "w-grid");
      [["First pays", "end of turn " + p.first], ["Pays back", "end of turn " + p.even], ["Ahead by the last turn", signed(net)]].forEach(function (x, i) {
        var c = el("div", "w-card"); put(c, el("div", "w-label", x[0]));
        put(c, i === 1 ? badge(p.even <= st.length / 2 + 0.5, x[1]) : i === 2 ? badge(net > 0, x[1]) : el("strong", null, x[1])); grid.appendChild(c);
      });
      put(out, grid, lines(root, [{ name: "Running total", color: "var(--accent)", values: values }], { title: "What it has paid, less its cost, by turn" }),
        el("p", "w-note", "A tick on Pays back means by the middle of the game. Timing follows the engine: a build makes its first progress on the turn it is ordered, and pays on the turn it finishes. It assumes the site stays yours and uncontested. Farms cost Funds and pay Manpower, so read their result as how many Manpower the Funds bought."));
    });
  };

  /* ================= militia-vs-mixed ================= */
  W["militia-vs-mixed"] = function (root) {
    if (!root) return;
    root.textContent = "";
    var st = { side: "republic", turns: 10, settle: 3, show: "attack", pkg: "today" }, out = el("div"), controls = el("div", "w-row");
    out.style.display = "grid"; out.style.gap = "10px"; out.style.gridTemplateColumns = "minmax(0,1fr)"; out.style.minWidth = "0";
    put(controls,
      field("Side", choose([["republic", "Republic"], ["north", "North"], ["south", "South"]], st.side, function (v) { st.side = v; draw(); })),
      field("Rules", choose(PACKAGES(), st.pkg, function (v) { st.pkg = v; draw(); })),
      field("Turns", number(st.turns, 4, 16, 1, function (v) { st.turns = Math.round(v); draw(); })),
      field("Chart", choose([["attack", "Attack"], ["defence", "Defence"]], st.show, function (v) { st.show = v; draw(); })),
      field("Contested ground pays", choose([["0", "Nobody"], ["3", "Its main holder, from turn 3"]], "3", function (v) { st.settle = Number(v); draw(); })));
    put(root, controls, out);
    var draw = live(root, function () {
      var rules = M.rules(st.pkg), opts = { turns: st.turns, settleFrom: st.settle };
      var runs = [["Militia only", M.project(rules, st.side, "militia", opts), "var(--rep)", ""], ["Infantry only", M.project(rules, st.side, "infantry", opts), "var(--route)", "6 4"], ["Best mix", M.bestMix(rules, st.side, opts).rows, "var(--good)", "2 3"]];
      var rows = runs.map(function (r) {
        var x = r[1][r[1].length - 1];
        return [r[0], (x.raised["militia-column"] || 0) + " + " + (x.raised["infantry-regiment"] || 0), Math.round(x.value.attack), Math.round(x.value.defence), r1(x.upkeep.manpower) + " of " + r1(x.income.manpower), Math.round(x.funds) + " F, " + Math.round(x.manpower) + " M"];
      });
      out.textContent = "";
      put(out, table(["Plan", "Militia + infantry raised", "Attack", "Defence", "Upkeep of Manpower income", "Left unspent"], rows, "The whole army on turn " + st.turns + ", opening units included. Same income, same opening stock."),
        lines(root, runs.map(function (r) { return { name: r[0], color: r[2], dash: r[3], values: r[1].map(function (x) { return x.value[st.show]; }) }; }), { title: (st.show === "attack" ? "Attack" : "Defence") + " on the board at the end of each turn" }),
        el("p", "w-note", "Not modelled: battles, losses, Replenish, ground won or lost, where units stand, weather, artillery, tanks and aircraft. Each plan buys every unit it can afford and feed to the last turn. The best mix is the number of militia, in steps of 3, with the most attack plus defence at the end. A real game rewards having the army early, which this does not score."));
    });
  };

  /* ================= tenets ================= */
  W.tenets = function (root) {
    if (!root) return;
    root.textContent = "";
    var sets = PACKAGES().map(function (p) { return { id: p[0], name: p[0] === "measured" ? "Moderate" : p[1], list: M.tenets(M.rules(p[0])) }; });
    var score = el("div", "w-grid");
    sets.forEach(function (s) {
      var c = el("div", "w-card"), n = s.list.filter(function (t) { return t.ok; }).length;
      put(c, el("div", "w-label", s.name), el("strong", null, n + " of " + s.list.length + " pass")); score.appendChild(c);
    });
    var rows = sets[0].list.map(function (t, i) {
      var first = el("div"); first.style.minWidth = "8.5em"; first.style.fontWeight = "400"; put(first, el("strong", null, (i + 1) + ". " + t.name), el("div", "w-note", "Target: " + t.target));
      return [first].concat(sets.map(function (s) { var d = el("div"); d.style.minWidth = "6.5em"; put(d, badge(s.list[i].ok, s.list[i].ok ? "Pass" : "Fail"), el("div", "w-note", s.list[i].shown)); return d; }));
    });
    put(root, score, table(["Tenet"].concat(sets.map(function (s) { return s.name; })), rows, "Each result is computed from the scenario numbers. Passing is not proof of balance: the Moderate package was tuned against these tests."),
      el("p", "w-note", "Projections run 10 turns with no fighting; contested ground pays its main holder from turn 3. Today passes two upkeep tests only because it has no upkeep."));
  };

  /* ================= city-defence ================= */
  W["city-defence"] = function (root) {
    if (!root) return;
    root.textContent = "";
    var D = data().d20, st = { col: 2, works: 0, other: 0 }, controls = el("div", "w-row"), out = el("div");
    out.style.minWidth = "0";
    put(controls,
      field("Attack to defence", choose([1, 2, 3, 4, 5, 6].map(function (c) { return [String(c), c + ":1"]; }), "2", function (v) { st.col = Number(v); draw(); })),
      field("Dug-in turns", choose([0, 1, 2, 3].map(function (c) { return [String(c), String(c)]; }), "0", function (v) { st.works = Number(v); draw(); })),
      field("Other modifiers", number(0, -10, 10, 1, function (v) { st.other = Math.round(v); draw(); })));
    put(root, controls, out);
    function draw() {
      var base = st.other - Math.min(D.worksMax, st.works * D.worksPerTurn);
      var cases = [["Republic today: Popular Resistance and barricades", base - D.popularResistance - D.barricades], ["Any other side today: barricades only", base - D.barricades], ["Republic without Popular Resistance", base - D.barricades], ["Every side, barricades worth 2", base - 2], ["No city bonus at all", base]];
      out.textContent = "";
      var rows = cases.map(function (c) {
        var o = M.odds(st.col, c[1]);
        var bar = el("div", "w-bar-track"), fill = el("div", "w-bar"); fill.style.width = Math.round(o.take * 100) + "%"; bar.style.minWidth = "80px"; bar.title = Math.round(o.take * 100) + "%"; bar.appendChild(fill);
        return [c[0], signed(c[1]) || "0", Math.round(o.take * 100) + "%", bar, Math.round(o.gain * 100) + "%"];
      });
      put(out, table(["Defender in a city", "On the attacker’s die", "Attacker takes the territory", "", "Attacker gains some ground"], rows, "From the game’s own result table. Each 3 on the die is one odds column."));
    }
    draw();
  };

  /* ================= round 2: the owner's table on the bench ================= */
  var PLAIN = ["infantry-regiment", "militia-column", "colonial-veterans", "security-forces"];
  var ABILITY = { "artillery-group": "Attack bonus", "cavalry-regiment": "Moves +1", "tank-company": "Attack bonus, carries 1" };
  M.index = function (u, up, turns) { return ((u.attack + u.defence) / 2) / Math.max(0.01, u.funds + 0.5 * u.manpower + 0.5 * turns * M.unitUpkeep(u, up).manpower); };
  function copyButton(label, text) {
    var b = el("button", "w-btn", label); b.type = "button";
    b.addEventListener("click", function () {
      var t = text(), done = function (ok) { b.textContent = ok ? "Copied" : "Select the text below and copy it"; setTimeout(function () { b.textContent = label; }, 2500); };
      var fallback = function () { var a = el("textarea"); a.value = t; a.rows = 8; a.style.width = "100%"; b.parentNode.parentNode.appendChild(a); a.focus(); a.select(); done(false); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { done(true); }, fallback); else fallback();
    });
    return b;
  }
  function plainButton(label, run) { var b = el("button", "w-btn", label); b.type = "button"; b.addEventListener("click", run); return b; }
  function off(x) { return (x >= 0 ? "+" : "−") + Math.abs(Math.round(x * 100)) + "%"; }

  W["unit-bench"] = function (root) {
    if (!root) return;
    root.textContent = "";
    var st, inputs = el("div"), sides = el("div"), bar = el("div", "w-row"), readouts = {};
    var load = function (pkg) { var r = M.rules(pkg); st = { units: r.units, upkeep: r.upkeep, free: r.upkeep.free || 0 }; };
    var rules = function () { var r = M.rules("owner"); r.units = st.units; r.upkeep = { kind: "share", rate: st.upkeep.rate || 0, free: st.free, machineFunds: 0 }; return r; };
    var csv = function () {
      return "unit,funds,manpower,upkeep_manpower_per_turn,attack,defence,training_turns\n" + Object.keys(st.units).map(function (k) { var u = st.units[k]; return [u.name, u.funds, u.manpower, r1k(M.unitUpkeep(u, rules().upkeep).manpower), u.attack, u.defence, u.train].join(","); }).join("\n") + "\nfree_manpower_per_side," + st.free;
    };
    function r1k(x) { return Math.round(x * 1000) / 1000; }
    function build() {
      inputs.textContent = ""; bar.textContent = ""; readouts = {};
      put(bar, plainButton("Your table", function () { load("owner"); build(); }), plainButton("Moderate", function () { load("measured"); build(); }), plainButton("Today", function () { load("today"); build(); }), copyButton("Copy as CSV", csv),
        field("Free Manpower for each side", number(st.free, 0, 20, 0.5, function (v) { st.free = v; draw(); })));
      var rows = Object.keys(st.units).map(function (k) {
        var u = st.units[k], up = { kind: "share", rate: st.upkeep.rate || 0, free: 0 };
        if (u.upkeepM === undefined) u.upkeepM = r1k(M.unitUpkeep(u, up).manpower);
        var cell = function (key, max, step) { var n = number(u[key], 0, max, step, function (v) { u[key] = v; draw(); }); n.setAttribute("aria-label", u.name + ", " + key); n.style.width = "3.7em"; n.style.padding = "2px 3px"; return n; };
        readouts[k] = { now: el("span"), later: el("span"), verdict: el("span") };
        return [u.name, cell("funds", 30, 1), cell("manpower", 10, 1), cell("upkeepM", 5, 0.05), cell("attack", 12, 1), cell("defence", 12, 1), cell("train", 8, 1), readouts[k].now, readouts[k].later, readouts[k].verdict];
      });
      put(inputs, table(["Unit", "Funds", "Man\u00adpower", "Up\u00adkeep", "Att.", "Def.", "Turns", "Index", "After upkeep", "15% band"], rows, "Index is average of attack and defence, over Funds plus half of Manpower. The percentage is the gap to an infantry regiment. After upkeep adds ten turns of it. The band is checked before upkeep."));
      Array.prototype.forEach.call(inputs.querySelectorAll("th, td"), function (c) { c.style.padding = "4px"; c.style.verticalAlign = "middle"; });
      draw();
    }
    function draw() {
      var r = rules(), up = { kind: "share", rate: 0, free: 0 }, inf = st.units["infantry-regiment"], a = M.index(inf, up, 0), b = M.index(inf, up, 10);
      Object.keys(readouts).forEach(function (k) {
        var u = st.units[k], x = M.index(u, up, 0), y = M.index(u, up, 10), o = readouts[k];
        [[o.now, x, a], [o.later, y, b]].forEach(function (c) { c[0].textContent = fixed(c[1]); c[0].appendChild(el("br")); c[0].appendChild(document.createTextNode(off(c[1] / c[2] - 1))); });
        o.verdict.textContent = "";
        if (PLAIN.indexOf(k) >= 0) o.verdict.appendChild(badge(Math.abs(x / a - 1) <= 0.15, Math.abs(x / a - 1) <= 0.15 ? "inside" : "outside"));
        else o.verdict.textContent = ABILITY[k] ? "Ability: " + ABILITY[k] : "Judged by its job";
      });
      sides.textContent = "";
      var rowsOut = FACTIONS.map(function (id) {
        var f = M.faction(id), bill = M.armyUpkeep(r, M.openingCounts(f), f).manpower, idle = M.project(r, id, "none", { turns: 8 }), dry = idle.filter(function (x) { return x.short > 0; })[0];
        var mil = M.project(r, id, "militia", M.OPTS), reg = M.project(r, id, "infantry", M.OPTS), last = function (x) { var v = x[x.length - 1].value; return Math.round(v.attack) + " / " + Math.round(v.defence); };
        var best = M.bestMix(r, id, M.OPTS).rows, got = best[best.length - 1].raised;
        return [short(id), fixed(bill, 1) + " of " + f.income.manpower, dry ? badge(false, "turn " + dry.turn) : badge(true, "not in 8 turns"), last(mil), last(reg), (got["militia-column"] || 0) + " militia, " + (got["infantry-regiment"] || 0) + " infantry"];
      });
      put(sides, table(["Side", "Opening upkeep, of income", "Out of Manpower if it buys nothing", "Militia only, turn 10: attack / defence", "Infantry only, turn 10", "Strongest mix of the two by turn 10"], rowsOut, "Ten turns, no battles. Contested ground pays its main holder from turn 3, except in the third column, where it never does. Strongest means most attack plus defence. Guns, tanks and aircraft aren't in the mixes."));
    }
    load("owner"); put(root, bar, inputs, sides); build();
  };

  W["build-bench"] = function (root) {
    if (!root) return;
    root.textContent = "";
    var st, inputs = el("div"), chains = el("div"), bar = el("div", "w-row"), readouts = {};
    var load = function (pkg) { var keep = st || { length: 30, guns: "factory" }; st = { projects: M.rules(pkg).projects, length: keep.length, guns: keep.guns }; };
    var IDS = ["farms", "mines", "industry", "barracks", "factory", "depot", "fortifications", "hospital", "airfield", "paved-airfield", "rail-yard", "rail", "port", "road-upgrade", "rail-upgrade", "new-rail"];
    var csv = function () { return "building,funds,manpower,turns\n" + IDS.map(function (k) { var p = st.projects[k]; return [p.name, p.funds, p.manpower, p.turns].join(","); }).join("\n") + "\nartillery_needs,barracks+" + st.guns + "\ngame_length," + st.length; };
    function build() {
      inputs.textContent = ""; bar.textContent = ""; readouts = {};
      put(bar, plainButton("Moderate", function () { load("measured"); build(); }), plainButton("Fast chains", function () { load("measured"); [["industry", "funds", 5], ["barracks", "turns", 1], ["factory", "turns", 2], ["depot", "turns", 1]].forEach(function (c) { st.projects[c[0]][c[1]] = c[2]; }); st.guns = "depot"; build(); }), plainButton("Today", function () { load("today"); st.guns = "factory"; build(); }), copyButton("Copy as CSV", csv),
        field("Average game length", choose([["10", "10 turns"], ["15", "15 turns"], ["20", "20 turns"], ["30", "30 turns"]], String(st.length), function (v) { st.length = Number(v); draw(); })),
        field("Artillery needs", choose([["factory", "Barracks and Factory"], ["depot", "Barracks and Depot"]], st.guns, function (v) { st.guns = v; draw(); })));
      var rows = IDS.map(function (k) {
        var p = st.projects[k];
        var cell = function (key, max) { var n = number(p[key], key === "turns" ? 1 : 0, max, 1, function (v) { p[key] = v; draw(); }); n.setAttribute("aria-label", p.name + ", " + key); n.style.width = "4.4em"; return n; };
        readouts[k] = el("span");
        return [p.name, cell("funds", 40), cell("manpower", 12), cell("turns", 12), readouts[k]];
      });
      put(inputs, table(["Build", "Funds", "Manpower", "Turns", "Paid back, turns after ordering"], rows, "Manpower in a price isn't counted in payback."));
      draw();
    }
    function draw() {
      var limit = Math.max(1, Math.round(st.length * 0.15)), chainLimit = Math.max(1, Math.round(st.length * 0.1));
      IDS.forEach(function (k) {
        var p = st.projects[k]; readouts[k].textContent = "";
        if (p.resource === "funds") { var t = M.payback(1, p.turns, p.funds, p["yield"] || 1).even - 1; readouts[k].appendChild(badge(t <= limit, t + " (your limit is " + limit + ")")); }
        else readouts[k].textContent = k === "farms" ? "Pays Manpower" : "–";
      });
      chains.textContent = "";
      var R = M.rules("owner"), rows = [];
      Object.keys(R.units).forEach(function (k) {
        var u = R.units[k], need = k === "artillery-group" ? ["barracks", st.guns] : u.requires;
        if (!need.length) return;
        var build = need.reduce(function (s, x) { return s + st.projects[x].turns; }, 0), total = build + u.train;
        var now = FACTIONS.map(function (id) {
          if (u.factionIds && u.factionIds.indexOf(id) < 0) return "–";
          return String(data().territories.filter(function (x) { return x.holder === id && x.capitalHolder === id && need.every(function (n) { return x.capitalBuildings.indexOf(n) >= 0; }); }).length);
        });
        rows.push([u.name, need.map(function (x) { return st.projects[x].name + " " + st.projects[x].turns; }).join(" + ") + " + training " + u.train, badge(total <= chainLimit, "turn " + total)].concat(now));
      });
      put(chains, table(["Unit", "Chain from nothing", "First one, if ordered on turn 1 (limit " + chainLimit + ")", "Republic", "North", "South"], rows, "One after the other in one capital. The last three columns count the places each side can already train it on turn 1."));
    }
    load("measured"); put(root, bar, inputs, chains); build();
  };

  W["upkeep-runway"] = function (root) {
    if (!root) return;
    root.textContent = "";
    var st = { free: 0, extra: 0, settle: 0 }, controls = el("div", "w-row"), out = el("div");
    put(controls,
      field("Free Manpower for each side", number(0, 0, 12, 0.5, function (v) { st.free = v; draw(); })),
      field("Extra starting Manpower, South", number(0, 0, 20, 1, function (v) { st.extra = v; draw(); })),
      field("The South clears Andalucía", choose([["0", "never"], ["3", "on turn 3"], ["5", "on turn 5"]], "0", function (v) { st.settle = Number(v); draw(); })));
    put(root, controls, out);
    function draw() {
      out.textContent = "";
      var r = M.rules("owner"); r.upkeep = { kind: "share", rate: 0, free: st.free, machineFunds: 0 };
      var f = M.faction("south"), keep = f.stock.manpower; f.stock.manpower = keep + st.extra;
      var run = function (s) { return M.project(r, "south", s, { turns: 8, settleFrom: st.settle, prudent: false }); };
      var idle = run("none"), buy = run("infantry"); f.stock.manpower = keep;
      var flag = function (rows) { return rows.map(function (x) { return x.short > 0; }); };
      put(out, lines(out, [{ name: "Buys nothing", color: "var(--sic)", values: idle.map(function (x) { return x.manpower - x.short; }), mark: flag(idle) }, { name: "Buys infantry", color: "var(--ink)", dash: "5 4", values: buy.map(function (x) { return x.manpower - x.short; }), mark: flag(buy) }], { title: "The South's Manpower at the end of each turn (below zero is the shortage that turn)", at: 3 }));
    }
    live(root, draw);
  };

  /* ================= round 3: mixed armies and militia ================= */
  /** The engine's odds rule: floor(a / d):1 up to 6:1, each step beyond +3; below 1:1, 1:ceil(d / a), each halving -3. */
  M.battle = function (attack, defence, roll) {
    var m = roll, col = 0, label;
    if (attack <= 0) return { label: "–", roll: 0, take: 0, gain: 0 };
    if (attack >= defence) { var r = Math.floor(attack / defence); col = Math.min(6, r); m += 3 * Math.max(0, r - 6); label = r + ":1"; }
    else { var g = Math.ceil(defence / attack); m -= 3 * Math.floor(Math.log2(g)); label = "1:" + g; }
    var o = M.odds(col, m);
    return { label: label, roll: m, take: o.take, gain: o.gain };
  };
  W["arms-lab"] = function (root) {
    if (!root) return;
    root.textContent = "";
    var U = M.rules("owner").units; U["security-forces"].funds = 4; U["security-forces"].upkeepM = 1; U["colonial-veterans"].manpower = 1;
    var IDS = ["infantry-regiment", "colonial-veterans", "militia-column", "cavalry-regiment", "artillery-group", "tank-company", "fighter-squadron", "bomber-squadron"];
    var PRE = { "Mixed": { "infantry-regiment": 2, "artillery-group": 3, "tank-company": 2, "fighter-squadron": 1, "bomber-squadron": 1 }, "Mixed, no aircraft": { "infantry-regiment": 5, "artillery-group": 3, "tank-company": 2 }, "All infantry": { "infantry-regiment": 12 }, "All militia": { "militia-column": 20 } };
    var st = { n: {}, def: 24, barr: true, dug: 0, air: true, pay: 0.5 }, bar = el("div", "w-row"), army = el("div", "w-grid"), ground = el("div", "w-row"), out = el("div"), boxes = {};
    var set = function (p) { IDS.forEach(function (k) { st.n[k] = p[k] || 0; if (boxes[k]) boxes[k].value = st.n[k]; }); };
    Object.keys(PRE).forEach(function (k) { put(bar, plainButton(k, function () { set(PRE[k]); draw(); })); });
    set(PRE.Mixed);
    IDS.forEach(function (k) { boxes[k] = number(st.n[k], 0, 40, 1, function (v) { st.n[k] = Math.round(v); draw(); }); put(army, field(U[k].name, boxes[k])); });
    var tick = function (label, key) { var c = el("input"); c.type = "checkbox"; c.checked = st[key]; c.addEventListener("change", function () { st[key] = c.checked; draw(); }); return field(label, c); };
    put(ground, field("Defenders count", number(24, 1, 200, 1, function (v) { st.def = v; draw(); })), field("Dug-in turns", choose([["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"]], "0", function (v) { st.dug = Number(v); draw(); })), tick("They hold a city", "barr"), tick("You win the air", "air"));
    put(root, bar, army, ground, out);
    function rate(n) {
      var sum = function (f) { return IDS.reduce(function (s, k) { return s + (n[k] || 0) * f(U[k], k); }, 0); };
      var guns = Math.min(3, Math.floor((n["artillery-group"] || 0) * U["artillery-group"].attack / 2)), tanks = Math.min(2, Math.floor((n["tank-company"] || 0) * U["tank-company"].attack / 3));
      var planes = Math.min(2, (n["fighter-squadron"] || 0) + (n["bomber-squadron"] || 0));
      var front = (n["infantry-regiment"] || 0) + (n["colonial-veterans"] || 0) + (n["militia-column"] || 0) + (n["cavalry-regiment"] || 0) + (n["tank-company"] || 0);
      var bonus = front ? guns + tanks + (st.air ? 3 * planes : 0) : 0, roll = bonus - (st.barr ? 2 : 0) - Math.min(6, 2 * st.dug);
      var a = front ? sum(function (u) { return u.kind === "ground" ? u.attack : 0; }) : 0, b = M.battle(a, st.def, roll);
      return { funds: sum(function (u) { return u.funds; }), men: sum(function (u) { return u.upkeepM; }), pay: (n["militia-column"] || 0) * st.pay, attack: a, bonus: bonus, battle: b };
    }
    function draw() {
      out.textContent = "";
      var mine = rate(st.n), rows = [];
      var line = function (name, r) {
        var t = el("div", "w-bar-track"), fill = el("div", "w-bar"); fill.style.width = Math.round(r.battle.take * 100) + "%"; t.style.minWidth = "70px"; t.appendChild(fill);
        rows.push([name, Math.round(r.funds), fixed(r.men, 2) + (r.pay ? " + " + r.pay + " Funds" : ""), r.attack, "+" + r.bonus, r.battle.label, signed(r.battle.roll) || "0", Math.round(r.battle.take * 100) + "%", t, Math.round(r.battle.gain * 100) + "%"]);
      };
      line("Your army", mine);
      [["infantry-regiment", "Infantry only, same Funds"], ["militia-column", "Militia only, same Funds"]].forEach(function (c) { var n = {}; n[c[0]] = Math.floor(mine.funds / U[c[0]].funds); line(c[1] + " (" + n[c[0]] + ")", rate(n)); });
      put(out, table(["", "Funds", "Upkeep a turn", "Attack", "Bonus", "Odds", "Roll", "Takes it", "", "Gains ground"], rows, "Your numbers, the game's own odds rule and result table, full strength, no generals or weather. At most three guns, two tanks and two aircraft add to the roll."));
    }
    draw();
  };

  /** One side that never fights: factories, then mines, then militia up to a cap, then infantry, never more than its income can keep. */
  M.grow = function (id, v, plan, T) {
    var D = data(), f = M.faction(id), g = D.merged[id], F = f.stock.funds, P = f.stock.manpower, fixedU = 0, A = 0, De = 0, t, short = false;
    var up = { "infantry-regiment": 0.25, "colonial-veterans": 0.25, "security-forces": 1 }, val = { "infantry-regiment": [4, 6], "colonial-veterans": [6, 6], "security-forces": [2, 6] };
    var mil0 = (f.army["militia-column"] || { count: 0 }).count, nM = mil0, nI = 0, train = [], ups = [], built = 0, mines = 0;
    Object.keys(f.army).forEach(function (k) { if (k === "militia-column") return; var n = f.army[k].count; fixedU += n * (up[k] || 0.05); if (val[k]) { A += n * val[k][0]; De += n * val[k][1]; } });
    var pending = function (k) { return train.filter(function (x) { return x[0] === k; }).length; };
    for (t = 1; t <= T; t += 1) {
      var late = t >= 3, inc = late ? g.settled : g.start, sites = late ? g.sites : g.sitesNow;
      while (built < Math.min(plan.factories, sites) && F >= 6 && P >= 4) { F -= 6; P -= 4; built += 1; ups.push([t + 1, 1.5]); }
      if (built >= Math.min(plan.factories, sites)) while (mines < plan.mines && F >= 5) { F -= 5; mines += 1; ups.push([t + 1, 1]); }
      if (built >= Math.min(plan.factories, g.sites) && mines >= plan.mines) {
        var extra = ups.reduce(function (s, x) { return s + x[1]; }, 0);
        var fits = function (k) { var m = nM + pending("m") + (k === "m" ? 1 : 0), i = nI + pending("i") + (k === "i" ? 1 : 0); return fixedU + m * v.upkeep + i * 0.25 <= g.settled.manpower && m * v.pay <= g.settled.funds + extra; };
        while (nM - mil0 + pending("m") < plan.cap && F >= v.price && P >= 3 && fits("m")) { F -= v.price; P -= 3; train.push(["m", t]); }
        if (!plan.only) while (F >= 5 && P >= 1 && fits("i")) { F -= 5; P -= 1; train.push(["i", t + 1]); }
      }
      train = train.filter(function (x) { if (x[1] > t) return true; if (x[0] === "m") nM += 1; else nI += 1; return false; });
      F += inc.funds + ups.reduce(function (s, x) { return s + (t >= x[0] ? x[1] : 0); }, 0) - nM * v.pay; P += inc.manpower - fixedU - nM * v.upkeep - nI * 0.25;
      if (P < 0) { short = true; P = 0; } if (F < 0) { short = true; F = 0; }
    }
    return { militia: nM - mil0, infantry: nI, attack: A + nM * v.attack + nI * 4, defence: De + nM * v.defence + nI * 6, short: short, factories: built, mines: mines };
  };
  M.growBest = function (id, v, T, kind) {
    var best = null, g = data().merged[id], mines = M.faction(id).upgrades.mines, pick = function (r) { if (!r.short && (!best || r.attack + r.defence > best.attack + best.defence)) best = r; };
    for (var k = 0; k <= g.sites; k += 1) [0, 2, 4, 6, 8, 10].forEach(function (m) {
      if (m > mines) return;
      if (kind === "militia") pick(M.grow(id, v, { factories: k, mines: m, cap: 99, only: true }, T));
      else if (kind === "infantry") pick(M.grow(id, v, { factories: k, mines: m, cap: 0 }, T));
      else for (var c = 0; c <= 40; c += 1) pick(M.grow(id, v, { factories: k, mines: m, cap: c }, T));
    });
    return best;
  };
  W["militia-lab"] = function (root) {
    if (!root) return;
    root.textContent = "";
    var st = { price: 3, upkeep: 1.5, pay: 0, attack: 2, defence: 5 }, controls = el("div", "w-row"), bar = el("div", "w-row"), out = el("div"), box = {}, timer;
    var P = [["Your table", { price: 3, upkeep: 1.5, pay: 0, attack: 2, defence: 5 }], ["Half a Fund of pay", { price: 3, upkeep: 1.5, pay: 0.5, attack: 2, defence: 5 }], ["Upkeep 3", { price: 3, upkeep: 3, pay: 0, attack: 2, defence: 5 }], ["Price 4", { price: 4, upkeep: 1.5, pay: 0, attack: 2, defence: 5 }]];
    P.forEach(function (p) { put(bar, plainButton(p[0], function () { Object.assign(st, p[1]); Object.keys(box).forEach(function (k) { box[k].value = st[k]; }); draw(); })); });
    [["price", "Price in Funds", 8, 1], ["upkeep", "Manpower a turn", 6, 0.25], ["pay", "Funds a turn", 3, 0.25], ["attack", "Attack", 8, 1], ["defence", "Defence", 10, 1]].forEach(function (c) { box[c[0]] = number(st[c[0]], c[0] === "price" ? 1 : 0, c[2], c[3], function (v) { st[c[0]] = v; clearTimeout(timer); timer = setTimeout(draw, 250); }); put(controls, field(c[1], box[c[0]])); });
    put(root, bar, controls, out);
    function say(r) { return r ? r.militia + " militia, " + r.infantry + " infantry: " + r.attack + " / " + r.defence : "can't pay for the army it starts with"; }
    function draw() {
      out.textContent = "";
      var rows = [];
      FACTIONS.forEach(function (id) { [10, 15].forEach(function (T) { rows.push([short(id) + ", turn " + T, say(M.growBest(id, st, T, "mix")), say(M.growBest(id, st, T, "militia")), say(M.growBest(id, st, T, "infantry"))]); }); });
      put(out, table(["", "Strongest army it can keep", "Militia only", "Infantry only"], rows, "Units raised, then whole-army attack / defence. Strongest means most attack plus defence. It may build merged Factories and mines first, and never keeps more than its income feeds. No battles; contested ground pays its main holder from turn 3."));
    }
    draw();
  };

  /* ================= round 3: end-turn sounds ================= */
  function link(text, href) { if (!href) return document.createTextNode(text); var a = el("a", null, text); a.href = href; a.target = "_blank"; a.rel = "noopener"; return a; }
  W["endturn-board"] = function (root) {
    if (!root) return;
    root.textContent = "";
    var rows = (window.M3W_AUDIO3 || []).filter(function (x) { return x.kind === "candidate"; }).map(function (x) {
      var name = el("div"), audio = el("audio"), from = el("div");
      audio.controls = true; audio.preload = "none"; audio.src = "audio-candidates/" + x.file; audio.style.width = "230px"; audio.style.height = "40px";
      put(name, el("div", null, x.label + ", " + x.seconds + " s"), audio);
      x.parts.forEach(function (p, i) {
        if (i) from.appendChild(el("br"));
        var source = p.source.indexOf("VSCO 2") === 0 ? "VSCO 2 Community Edition" : p.source;
        put(from, link(source, p.url), document.createTextNode(" by " + p.author + ", "), link(p.licence, p.licenceUrl));
      });
      put(from, el("div", "w-note", "Changed: trimmed, mixed, light echo added, levelled."));
      return [name, from];
    });
    var t = table(["Sound", "Recorded by"], rows, "Nobody has listened to these yet. Levels, waveforms and spectrograms were checked.");
    put(root, t);
  };

  W["endturn-mixer"] = function (root) {
    if (!root) return;
    root.textContent = "";
    var stems = (window.M3W_AUDIO3 || []).filter(function (x) { return x.kind === "stem"; }).map(function (x) { return { id: x.id, label: x.label, file: x.file }; });
    stems.push({ id: "recruit-a", label: "Snare roll", file: "recruit-a.mp3" }, { id: "battle-a", label: "Distant cannon", file: "battle-a.mp3" });
    var QUIET = { "stem-ledger-shut": 2, "stem-kettledrum-hit": 1.3, "stem-low-drum": 1.3 };
    var st = { length: 2.4, on: {}, at: {}, vol: {} }, ctx = null, master = null, buffers = {}, playing = [], boxes = {}, note = el("div", "w-note"), bar = el("div", "w-row");
    stems.forEach(function (s) { st.on[s.id] = false; st.at[s.id] = 0; st.vol[s.id] = 80; });
    var PRE = {
      "Bugle and drums": { "stem-field-drum": [0, 60], "stem-bugle": [0.2, 90] },
      "Kettledrum and brass": { "stem-kettledrum-roll": [0, 80], "stem-kettledrum-hit": [1.35, 100], "stem-brass-chord": [1.35, 70] },
      "Bell and low drum": { "stem-bell": [0, 90], "stem-low-drum": [0, 80] },
      "Ledger, stamp, drum": { "stem-ledger-shut": [0, 100], "stem-stamp": [0.55, 90], "stem-low-drum": [0.55, 70] }
    };
    note.setAttribute("aria-live", "polite");
    function use(p) { stems.forEach(function (s) { var v = p[s.id]; st.on[s.id] = !!v; st.at[s.id] = v ? v[0] : 0; st.vol[s.id] = v ? v[1] : 80; var b = boxes[s.id]; b.on.checked = st.on[s.id]; b.at.value = st.at[s.id]; b.vol.value = st.vol[s.id]; b.show(); }); }
    function stop() { playing.forEach(function (n) { try { n.stop(); } catch (e) { /* already ended */ } }); playing = []; }
    function load(s) {
      if (buffers[s.id]) return Promise.resolve(buffers[s.id]);
      return fetch("audio-candidates/" + s.file).then(function (r) { if (!r.ok) throw new Error(s.label); return r.arrayBuffer(); }).then(function (b) { return ctx.decodeAudioData(b); }).then(function (b) { buffers[s.id] = b; return b; });
    }
    function play() {
      var chosen = stems.filter(function (s) { return st.on[s.id]; });
      if (!chosen.length) { note.textContent = "Tick at least one sound."; return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { note.textContent = "This browser can't mix sounds."; return; }
      if (!ctx) { ctx = new AC(); var limit = ctx.createDynamicsCompressor(); limit.threshold.value = -6; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.12; limit.connect(ctx.destination); master = limit; }
      if (ctx.state === "suspended") ctx.resume();
      stop(); note.textContent = "Loading…";
      Promise.all(chosen.map(load)).then(function (list) {
        var start = ctx.currentTime + 0.06, out = ctx.createGain(); out.connect(master);
        out.gain.setValueAtTime(1, start + Math.max(0.2, st.length - 0.6)); out.gain.linearRampToValueAtTime(0, start + st.length);
        chosen.forEach(function (s, i) { var node = ctx.createBufferSource(), g = ctx.createGain(); node.buffer = list[i]; g.gain.value = st.vol[s.id] / 100 * (QUIET[s.id] || 1); node.connect(g); g.connect(out); node.start(start + st.at[s.id]); node.stop(start + st.length + 0.05); playing.push(node); });
        note.textContent = "Playing " + chosen.map(function (s) { return s.label; }).join(", ") + ".";
      }).catch(function (e) { note.textContent = "Couldn't load " + (e && e.message ? e.message : "a sound") + "."; });
    }
    function recipe() { return "End-turn mix, " + st.length + " s\n" + stems.filter(function (s) { return st.on[s.id]; }).map(function (s) { return "- " + s.label + ": starts at " + st.at[s.id] + " s, volume " + st.vol[s.id]; }).join("\n"); }
    Object.keys(PRE).forEach(function (k) { put(bar, plainButton(k, function () { use(PRE[k]); play(); })); });
    var rows = stems.map(function (s) {
      var b = boxes[s.id] = { on: el("input"), at: el("input"), vol: el("input") }, shown = el("span", "w-note");
      b.on.type = "checkbox"; b.at.type = b.vol.type = "range"; b.at.min = 0; b.at.max = 2.5; b.at.step = 0.05; b.at.value = 0; b.vol.min = 0; b.vol.max = 100; b.vol.step = 5; b.vol.value = 80;
      b.on.setAttribute("aria-label", "Use " + s.label); b.at.setAttribute("aria-label", s.label + ", start"); b.vol.setAttribute("aria-label", s.label + ", volume");
      b.at.style.width = b.vol.style.width = "120px";
      b.show = function () { shown.textContent = Number(st.at[s.id]).toFixed(2) + " s, " + st.vol[s.id] + "%"; };
      b.on.addEventListener("change", function () { st.on[s.id] = b.on.checked; });
      b.at.addEventListener("input", function () { st.at[s.id] = Number(b.at.value); b.show(); });
      b.vol.addEventListener("input", function () { st.vol[s.id] = Number(b.vol.value); b.show(); });
      b.show();
      return [s.label, b.on, b.at, b.vol, shown];
    });
    put(root, bar, table(["Sound", "Use", "Starts", "Volume", ""], rows, "Layer sounds into your own end turn. The buttons above load a starting mix and play it."),
      put(el("div", "w-row"), plainButton("Play", play), plainButton("Stop", stop), copyButton("Copy my mix", recipe), field("Length in seconds", number(2.4, 1, 4, 0.1, function (v) { st.length = v; }))), note);
    use(PRE["Bugle and drums"]);
  };
})();
