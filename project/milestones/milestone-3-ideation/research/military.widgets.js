/* Military cluster widgets: d20-explorer (idea 9), unit-effects (idea 8), exhaustion-sim (idea 6).
 * Plain ES2019, no libraries, no network, no storage. Only global: window.M3W. */
(function () {
  "use strict";
  var M3W = (window.M3W = window.M3W || {});

  /* ---------- shared data ---------- */

  // combat.table from src/main/scenarios/spain-1936-07-31/scenario.json, table[column][row].
  var D6_TABLE = [
    ["attacker-eliminated", "attacker-eliminated", "attacker-attrition", "attacker-demoralized", "both-demoralized", "both-demoralized", "defender-demoralized"],
    ["attacker-eliminated", "attacker-attrition", "attacker-demoralized", "both-demoralized", "both-demoralized", "defender-demoralized", "defender-exchange"],
    ["attacker-attrition", "attacker-demoralized", "both-demoralized", "both-demoralized", "defender-demoralized", "defender-exchange", "defender-eliminated"],
    ["attacker-demoralized", "both-demoralized", "both-demoralized", "defender-demoralized", "defender-exchange", "defender-eliminated", "defender-eliminated"],
    ["both-demoralized", "both-demoralized", "defender-demoralized", "defender-exchange", "defender-eliminated", "defender-eliminated", "defender-eliminated"],
    ["both-demoralized", "defender-demoralized", "defender-exchange", "defender-eliminated", "defender-eliminated", "defender-eliminated", "defender-eliminated"],
    ["defender-demoralized", "defender-exchange", "defender-eliminated", "defender-eliminated", "defender-eliminated", "defender-eliminated", "defender-eliminated"]
  ];
  // M16 results, worst for the attacker first; colour ramp --c1..--c7.
  var D6_RESULTS = [
    { id: "attacker-eliminated", short: "Attacker eliminated", c: "--c1", take: false },
    { id: "attacker-attrition", short: "Attacker attrition", c: "--c2", take: false },
    { id: "attacker-demoralized", short: "Attacker demoralized", c: "--c3", take: false },
    { id: "both-demoralized", short: "Both demoralized", c: "--c4", take: false },
    { id: "defender-demoralized", short: "Defender demoralized (retreats)", c: "--c5", take: true },
    { id: "defender-exchange", short: "Defender exchange", c: "--c6", take: true },
    { id: "defender-eliminated", short: "Defender eliminated", c: "--c7", take: true }
  ];
  // Proposed d20 ladder. score = clamp(d20 + modifiers, 0, 20) + COLUMN_STEP x column.
  // aLoss/dLoss: share of each army's current men lost. aDem/dDem: share of the side demoralized.
  // ground: sub-regions changing hands (99 = the whole territory; the defenders retreat, M21).
  var COLUMN_STEP = 3;
  var LADDER = [
    { id: "attacker-routed", name: "Attacker routed", min: -999, c: "--c1", aLoss: 35, aDem: "all", dLoss: 0, dDem: "none", ground: 0 },
    { id: "attacker-broken", name: "Attacker broken", min: 3, c: "--c2", aLoss: 20, aDem: "half", dLoss: 0, dDem: "none", ground: 0 },
    { id: "attacker-repulsed", name: "Attacker repulsed", min: 6, c: "--c2", aLoss: 10, aDem: "half", dLoss: 0, dDem: "none", ground: 0 },
    { id: "attack-stalled", name: "Attack stalled", min: 9, c: "--c3", aLoss: 10, aDem: "none", dLoss: 10, dDem: "none", ground: 0 },
    { id: "both-shaken", name: "Both shaken", min: 11, c: "--c3", aLoss: 10, aDem: "half", dLoss: 10, dDem: "half", ground: 0 },
    { id: "defender-gives-ground", name: "Defender gives ground", min: 13, c: "--c4", aLoss: 10, aDem: "none", dLoss: 10, dDem: "none", ground: 1 },
    { id: "defender-pushed-back", name: "Defender pushed back", min: 15, c: "--c4", aLoss: 10, aDem: "none", dLoss: 20, dDem: "half", ground: 2 },
    { id: "defender-driven-out", name: "Defender driven out", min: 17, c: "--c5", aLoss: 10, aDem: "none", dLoss: 10, dDem: "half", ground: 99 },
    { id: "costly-breakthrough", name: "Costly breakthrough", min: 20, c: "--c6", aLoss: 20, aDem: "none", dLoss: 35, dDem: "all", ground: 99 },
    { id: "defender-routed", name: "Defender routed", min: 23, c: "--c7", aLoss: 0, aDem: "none", dLoss: 35, dDem: "all", ground: 99 },
    { id: "defender-destroyed", name: "Defender destroyed", min: 27, c: "--c7", aLoss: 0, aDem: "none", dLoss: 100, dDem: "none", ground: 99 }
  ];
  var FIRST_TAKE = 7; // index of defender-driven-out
  var FIRST_GROUND = 5; // index of defender-gives-ground

  // Unit types: the four from scenario.json, then three proposals (values are proposals only).
  var TYPES = [
    { id: "infantry-regiment", name: "Infantry regiment", attack: 4, defence: 6, real: true },
    { id: "militia-column", name: "Militia column", attack: 3, defence: 4, real: true },
    { id: "colonial-veterans", name: "Colonial veterans", attack: 6, defence: 5, real: true },
    { id: "security-forces", name: "Security forces", attack: 3, defence: 5, real: true },
    { id: "artillery-group", name: "Artillery group (proposal)", attack: 3, defence: 2, real: false, artillery: true },
    { id: "cavalry-regiment", name: "Cavalry regiment (proposal)", attack: 4, defence: 3, real: false },
    { id: "tank-battalion", name: "Tank battalion (proposal)", attack: 5, defence: 3, real: false }
  ];

  /* ---------- helpers ---------- */

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }
  function pct(p) {
    return (Math.round(p * 1000) / 10).toFixed(1) + "%";
  }
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function labelled(text, control) {
    var l = el("label", "w-label");
    l.appendChild(document.createTextNode(text + " "));
    l.appendChild(control);
    return l;
  }
  function select(options, value) {
    var s = el("select");
    options.forEach(function (o) {
      var opt = el("option", null, o.label);
      opt.value = o.value;
      s.appendChild(opt);
    });
    s.value = value;
    return s;
  }
  function numberInput(min, max, value) {
    var i = el("input");
    i.type = "number";
    i.min = String(min);
    i.max = String(max);
    i.value = String(value);
    i.style.width = "4.5em";
    return i;
  }
  function range(min, max, value) {
    var i = el("input");
    i.type = "range";
    i.min = String(min);
    i.max = String(max);
    i.step = "1";
    i.value = String(value);
    return i;
  }
  function intOf(input, lo, hi) {
    var v = parseInt(input.value, 10);
    if (isNaN(v)) v = lo;
    return clamp(v, lo, hi);
  }
  function barRow(label, p, colorVar, maxP) {
    var row = el("div");
    row.style.margin = "2px 0";
    var top = el("div", "w-row");
    top.style.justifyContent = "space-between";
    top.appendChild(el("span", "w-label", label));
    top.appendChild(el("span", null, pct(p)));
    row.appendChild(top);
    var track = el("div", "w-bar-track");
    var bar = el("div", "w-bar");
    var scale = maxP > 0 ? p / maxP : 0;
    bar.style.width = Math.max(0, Math.min(100, scale * 100)) + "%";
    bar.style.background = "var(" + colorVar + ")";
    track.appendChild(bar);
    row.appendChild(track);
    return row;
  }
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /* ---------- combat maths ---------- */

  // M13: odds from side values, rounded in the defender's favour.
  function oddsFor(attack, defence) {
    if (attack >= defence) {
      var ratio = Math.floor(attack / defence);
      return { column: Math.min(ratio, 6), halvings: 0, overflow: Math.max(0, ratio - 6), label: ratio + ":1" };
    }
    var against = Math.ceil(defence / attack);
    return { column: 0, halvings: Math.floor(Math.log(against) / Math.log(2) + 1e-9), overflow: 0, label: "1:" + against };
  }
  // Odds from a label like "3:1" or "1:4".
  function oddsFromLabel(label) {
    var parts = label.split(":");
    var a = parseInt(parts[0], 10);
    var d = parseInt(parts[1], 10);
    return oddsFor(a, d);
  }
  // M14 odds modifiers on the d6 scale (rollPenalty 1 per halving, +1 per step beyond 6:1).
  function oddsMod(odds) {
    return odds.overflow - odds.halvings;
  }
  // M15: exact d6 distribution, row = clamp(die + mod, 0, 6).
  function d6Dist(column, mod) {
    var out = {};
    D6_RESULTS.forEach(function (r) {
      out[r.id] = 0;
    });
    for (var d = 1; d <= 6; d++) {
      var row = clamp(d + mod, 0, 6);
      out[D6_TABLE[column][row]] += 1 / 6;
    }
    return out;
  }
  function gradeOf(score) {
    var g = 0;
    for (var i = 0; i < LADDER.length; i++) if (score >= LADDER[i].min) g = i;
    return g;
  }
  function d20Dist(column, mod) {
    var out = LADDER.map(function () {
      return 0;
    });
    for (var d = 1; d <= 20; d++) {
      var row = clamp(d + mod, 0, 20);
      out[gradeOf(row + COLUMN_STEP * column)] += 1 / 20;
    }
    return out;
  }
  function d6Take(dist) {
    return D6_RESULTS.reduce(function (s, r) {
      return s + (r.take ? dist[r.id] : 0);
    }, 0);
  }
  function sumFrom(arr, start) {
    var s = 0;
    for (var i = start; i < arr.length; i++) s += arr[i];
    return s;
  }
  function groundText(g) {
    if (g === 0) return "none";
    if (g === 99) return "whole territory; defenders retreat (M21)";
    return g + " sub-region" + (g > 1 ? "s" : "");
  }

  /* ---------- d20-explorer (idea 9) ---------- */

  M3W["d20-explorer"] = function (root) {
    var oddsLabels = ["1:8", "1:4", "1:3", "1:2", "1:1", "2:1", "3:1", "4:1", "5:1", "6:1", "7:1", "8:1"];
    var oddsSel = select(
      oddsLabels.map(function (l) {
        return { label: l, value: l };
      }),
      "2:1"
    );
    var modIn = range(-3, 3, 0);
    var modOut = el("span", "w-out", "0");
    var scaleSel = select(
      [
        { label: "x3 (restated in d20 units)", value: "3" },
        { label: "x1 (left at d6 size)", value: "1" }
      ],
      "3"
    );

    var controls = el("div", "w-row");
    controls.appendChild(labelled("Odds", oddsSel));
    var modWrap = labelled("Other roll modifiers, d6 units", modIn);
    modWrap.appendChild(modOut);
    controls.appendChild(modWrap);
    controls.appendChild(labelled("d20 modifier scale", scaleSel));
    root.appendChild(controls);
    root.appendChild(
      el("div", "w-note", "Modifier examples on today's d6 scale: dug in -1 to -3 (M22), Popular resistance -1 (M24). Odds below 1:1 and above 6:1 add their own M14 modifier automatically.")
    );

    var summary = el("div", "w-row");
    root.appendChild(summary);
    var grid = el("div", "w-grid");
    root.appendChild(grid);
    var checks = el("div", "w-note");
    root.appendChild(checks);

    // Ladder reference table.
    root.appendChild(el("div", "w-label", "Proposed d20 ladder: score = clamp(d20 + modifiers, 0, 20) + 3 x odds column"));
    var ladderWrap = el("div", "w-scroll");
    var lt = el("table", "w-table");
    var lh = el("tr");
    ["", "Grade", "Score", "Attacker", "Defender", "Ground"].forEach(function (h) {
      lh.appendChild(el("th", null, h));
    });
    lt.appendChild(lh);
    LADDER.forEach(function (g, i) {
      var tr = el("tr");
      var sw = el("td");
      var chip = el("div", "w-bar");
      chip.style.width = "14px";
      chip.style.background = "var(" + g.c + ")";
      sw.appendChild(chip);
      tr.appendChild(sw);
      tr.appendChild(el("td", null, i + 1 + ". " + g.name));
      var hi = i + 1 < LADDER.length ? LADDER[i + 1].min - 1 : null;
      var lo = i === 0 ? null : g.min;
      tr.appendChild(el("td", null, lo === null ? "up to " + hi : hi === null ? lo + "+" : lo + "-" + hi));
      tr.appendChild(el("td", null, "-" + g.aLoss + "% men, demoralize " + g.aDem + (g.ground === 99 ? ", occupies" : ", returns")));
      tr.appendChild(el("td", null, g.dLoss === 100 ? "destroyed" : "-" + g.dLoss + "% men, demoralize " + g.dDem));
      tr.appendChild(el("td", null, groundText(g.ground)));
      lt.appendChild(tr);
    });
    ladderWrap.appendChild(lt);
    root.appendChild(ladderWrap);

    // Today's table, inline.
    root.appendChild(el("div", "w-label", "Today's d6 table (scenario.json combat.table, rows = modified roll 0-6)"));
    var tWrap = el("div", "w-scroll");
    var tt = el("table", "w-table");
    tWrap.appendChild(tt);
    root.appendChild(tWrap);
    var shortCode = {
      "attacker-eliminated": "AE",
      "attacker-attrition": "AA",
      "attacker-demoralized": "AD",
      "both-demoralized": "BD",
      "defender-demoralized": "DD",
      "defender-exchange": "DX",
      "defender-eliminated": "DE"
    };
    function drawTable(column) {
      clear(tt);
      var h = el("tr");
      h.appendChild(el("th", null, "Row"));
      ["<1:1", "1:1", "2:1", "3:1", "4:1", "5:1", "6:1"].forEach(function (c, ci) {
        var th = el("th", null, c);
        if (ci === column) th.style.background = "var(--surface-2)";
        h.appendChild(th);
      });
      tt.appendChild(h);
      for (var r = 0; r <= 6; r++) {
        var tr = el("tr");
        tr.appendChild(el("td", null, String(r)));
        for (var c = 0; c <= 6; c++) {
          var td = el("td", null, shortCode[D6_TABLE[c][r]]);
          if (c === column) td.style.background = "var(--surface-2)";
          tr.appendChild(td);
        }
        tt.appendChild(tr);
      }
    }
    root.appendChild(
      el("div", "w-note", "AE attacker eliminated, AA attacker attrition, AD attacker demoralized, BD both demoralized, DD defender demoralized, DX defender exchange, DE defender eliminated. The d20 ladder thresholds are this cluster's proposal, calibrated so the chance to take a territory stays within 5 points of today's at every column.")
    );

    function update() {
      var odds = oddsFromLabel(oddsSel.value);
      var extra = intOf(modIn, -3, 3);
      modOut.textContent = (extra > 0 ? "+" : "") + extra;
      var m6 = extra + oddsMod(odds);
      var scale = parseInt(scaleSel.value, 10);
      var m20 = m6 * scale;
      var a = d6Dist(odds.column, m6);
      var b = d20Dist(odds.column, m20);

      clear(summary);
      summary.appendChild(el("span", "w-label", "Column " + odds.column + ", d6 modifier " + m6 + ", d20 modifier " + m20 + "."));
      summary.appendChild(el("span", "w-label", "Take territory:"));
      summary.appendChild(el("span", "w-out", "d6 " + pct(d6Take(a)) + " / d20 " + pct(sumFrom(b, FIRST_TAKE))));
      summary.appendChild(el("span", "w-label", "Any ground changes hands (d20):"));
      summary.appendChild(el("span", "w-out", pct(sumFrom(b, FIRST_GROUND))));
      var expA = 0;
      var expD = 0;
      b.forEach(function (p, i) {
        expA += p * LADDER[i].aLoss;
        expD += p * LADDER[i].dLoss;
      });
      summary.appendChild(el("span", "w-label", "Expected men lost (d20): attacker " + expA.toFixed(1) + "%, defender " + expD.toFixed(1) + "%."));

      clear(grid);
      var c1 = el("div", "w-card");
      c1.appendChild(el("div", "w-label", "Today: d6, exact from the scenario table"));
      var maxA = 0;
      D6_RESULTS.forEach(function (r) {
        maxA = Math.max(maxA, a[r.id]);
      });
      D6_RESULTS.forEach(function (r) {
        c1.appendChild(barRow(r.short, a[r.id], r.c, 1));
      });
      c1.appendChild(el("div", "w-note", "Destroyed outright: attacker " + pct(a["attacker-eliminated"]) + ", defender " + pct(a["defender-exchange"] + a["defender-eliminated"]) + "."));
      grid.appendChild(c1);

      var c2 = el("div", "w-card");
      c2.appendChild(el("div", "w-label", "Proposal: d20 graded ladder (11 grades)"));
      LADDER.forEach(function (g, i) {
        c2.appendChild(barRow(i + 1 + ". " + g.name, b[i], g.c, 1));
      });
      c2.appendChild(el("div", "w-note", "Destroyed outright: attacker 0.0% (only by surrender or falling under the strength floor), defender " + pct(b[LADDER.length - 1]) + "."));
      grid.appendChild(c2);

      drawTable(odds.column);

      var chk1 = d6Take(d6Dist(2, 0));
      var chk2 = d6Take(d6Dist(3, -3));
      checks.textContent =
        "Self-check against M15: 2:1 with no modifiers takes the territory " + pct(chk1) + " (spec: one time in two); 3:1 against works at +3 takes it " + pct(chk2) + " (spec: one time in six).";
    }
    [oddsSel, modIn, scaleSel].forEach(function (c) {
      c.addEventListener("input", update);
      c.addEventListener("change", update);
    });
    update();
  };

  /* ---------- unit-effects (idea 8) ---------- */

  M3W["unit-effects"] = function (root) {
    root.appendChild(el("div", "w-label", "Attacking stack (armies of each type)"));
    var counts = {};
    var stackRow = el("div", "w-row");
    TYPES.forEach(function (t) {
      var def = t.id === "infantry-regiment" || t.id === "artillery-group" ? 1 : 0;
      counts[t.id] = numberInput(0, 6, def);
      stackRow.appendChild(labelled(t.name + " " + t.attack + "-" + t.defence, counts[t.id]));
    });
    root.appendChild(stackRow);

    var strIn = range(25, 100, 100);
    var strOut = el("span", "w-out", "100%");
    var r2 = el("div", "w-row");
    var sw = labelled("Attackers' strength / fullStrength", strIn);
    sw.appendChild(strOut);
    r2.appendChild(sw);
    root.appendChild(r2);

    var realTypes = TYPES.filter(function (t) {
      return t.real;
    });
    var defType = select(
      realTypes.map(function (t) {
        return { label: t.name + " " + t.attack + "-" + t.defence, value: t.id };
      }),
      "infantry-regiment"
    );
    var defCount = numberInput(1, 4, 1);
    var digSel = select(
      [0, 1, 2, 3].map(function (v) {
        return { label: v === 0 ? "none" : "+" + v, value: String(v) };
      }),
      "0"
    );
    var prBox = el("input");
    prBox.type = "checkbox";
    var r3 = el("div", "w-row");
    r3.appendChild(labelled("Defender", defType));
    r3.appendChild(labelled("Count", defCount));
    r3.appendChild(labelled("Dug in", digSel));
    r3.appendChild(labelled("Popular resistance", prBox));
    root.appendChild(r3);

    var ruleSel = select(
      [
        { label: "No artillery rule (value only)", value: "none" },
        { label: "Owner's rule, literal", value: "owner" },
        { label: "Proposal", value: "proposal" }
      ],
      "owner"
    );
    var dieSel = select(
      [
        { label: "d6 (today's table)", value: "d6" },
        { label: "d20 (proposed ladder)", value: "d20" }
      ],
      "d6"
    );
    var r4 = el("div", "w-row");
    r4.appendChild(labelled("Artillery rule", ruleSel));
    r4.appendChild(labelled("Die", dieSel));
    root.appendChild(r4);

    var out = el("div");
    root.appendChild(out);
    root.appendChild(
      el("div", "w-note", "Infantry 4-6, militia 3-4, colonial 6-5 and security 3-5 come from scenario.json unitTypes; artillery 3-2, cavalry 4-3 and tank 5-3 are this cluster's proposals. Army values follow M12 (type value x strength / fullStrength, rounded, minimum 1); odds follow M13; modifiers M14. Owner's rule: artillery attack points count toward attack, and floor(artillery points / 3) adds 1 to the roll. Proposal: the same on the d20 scale with the bonus capped at +3 and no attack by artillery alone; on the d6 scale artillery counts as value only.")
    );

    function probTake(die, column, mod) {
      if (die === "d6") return { take: d6Take(d6Dist(column, mod)), ground: null };
      var b = d20Dist(column, mod);
      return { take: sumFrom(b, FIRST_TAKE), ground: sumFrom(b, FIRST_GROUND) };
    }

    function update() {
      var s = intOf(strIn, 25, 100) / 100;
      strOut.textContent = Math.round(s * 100) + "%";
      var attack = 0;
      var arty = 0;
      var armies = 0;
      var nonArty = 0;
      TYPES.forEach(function (t) {
        var n = intOf(counts[t.id], 0, 6);
        var v = Math.max(1, Math.round(t.attack * s));
        attack += n * v;
        armies += n;
        if (t.artillery) arty += n * v;
        else nonArty += n;
      });
      var dt = realTypes.filter(function (t) {
        return t.id === defType.value;
      })[0];
      var defence = intOf(defCount, 1, 4) * dt.defence;
      var dig = parseInt(digSel.value, 10);
      var pr = prBox.checked ? 1 : 0;
      var rule = ruleSel.value;
      var die = dieSel.value;
      var scale = die === "d20" ? 3 : 1;

      clear(out);
      if (armies === 0) {
        out.appendChild(el("div", "w-out", "Add at least one attacking army."));
        return;
      }
      var odds = oddsFor(attack, defence);
      var parts = [];
      var base = 0;
      if (odds.overflow) parts.push("odds beyond 6:1 +" + odds.overflow * scale);
      if (odds.halvings) parts.push("odds below 1:1 -" + odds.halvings * scale);
      if (dig) parts.push("works -" + dig * scale);
      if (pr) parts.push("Popular resistance -" + scale);
      base = (oddsMod(odds) - dig - pr) * scale;
      var artyBonus = 0;
      var blocked = false;
      if (rule === "owner") artyBonus = Math.floor(arty / 3);
      if (rule === "proposal") {
        artyBonus = die === "d20" ? Math.min(3, Math.floor(arty / 3)) : 0;
        if (nonArty === 0) blocked = true;
      }
      if (artyBonus) parts.push("artillery +" + artyBonus);
      var mod = base + artyBonus;

      var grid = el("div", "w-grid");
      function card(title, value) {
        var c = el("div", "w-card");
        c.appendChild(el("div", "w-label", title));
        c.appendChild(el("div", "w-out", value));
        grid.appendChild(c);
      }
      card("Attack value", String(attack) + (arty ? " (artillery " + arty + ")" : ""));
      card("Defence value", String(defence));
      card("Odds", odds.label + " (column " + odds.column + ")");
      card("Roll modifier (" + die + ")", (mod > 0 ? "+" : "") + mod);
      out.appendChild(grid);
      out.appendChild(el("div", "w-note", parts.length ? "Modifiers: " + parts.join(", ") + "." : "No roll modifiers."));

      if (blocked) {
        out.appendChild(el("div", "w-out", "Proposal: artillery cannot attack alone. Add a ground unit."));
        return;
      }
      var withRule = probTake(die, odds.column, mod);
      // Same stack without any artillery, for comparison.
      var attackNoArty = attack - arty;
      var line = el("div", "w-row");
      line.appendChild(el("span", "w-label", "Chance to take the territory:"));
      line.appendChild(el("span", "w-out", pct(withRule.take)));
      if (withRule.ground !== null) {
        line.appendChild(el("span", "w-label", "any ground:"));
        line.appendChild(el("span", "w-out", pct(withRule.ground)));
      }
      out.appendChild(line);
      if (arty > 0 && attackNoArty > 0) {
        var o2 = oddsFor(attackNoArty, defence);
        var m2 = (oddsMod(o2) - dig - pr) * scale;
        var without = probTake(die, o2.column, m2);
        var l2 = el("div", "w-row");
        l2.appendChild(el("span", "w-label", "Same stack without its artillery: " + attackNoArty + " vs " + defence + " at " + o2.label + ", take"));
        l2.appendChild(el("span", "w-out", pct(without.take)));
        l2.appendChild(el("span", "w-label", "so the artillery adds " + Math.round((withRule.take - without.take) * 100) + " points."));
        out.appendChild(l2);
      }
      if (rule === "owner" && die === "d6" && artyBonus > 0) {
        out.appendChild(el("div", "w-note", "On the d6, +1 to the roll is worth a whole odds column, so the literal rule counts the same artillery twice: once in the odds and once as a column."));
      }
    }
    var inputs = [strIn, defType, defCount, digSel, prBox, ruleSel, dieSel];
    TYPES.forEach(function (t) {
      inputs.push(counts[t.id]);
    });
    inputs.forEach(function (c) {
      c.addEventListener("input", update);
      c.addEventListener("change", update);
    });
    update();
  };

  /* ---------- exhaustion-sim (idea 6) ---------- */

  M3W["exhaustion-sim"] = function (root) {
    var TURNS = 10;
    var ACTIONS = [
      { label: "Attack", value: "attack" },
      { label: "March", value: "march" },
      { label: "Defend", value: "defend" },
      { label: "Hold", value: "hold" }
    ];
    var PRESETS = {
      drive: ["attack", "attack", "attack", "attack", "attack", "attack", "attack", "attack", "attack", "attack"],
      pulse: ["attack", "attack", "hold", "attack", "attack", "hold", "attack", "attack", "hold", "attack"],
      march: ["march", "march", "attack", "march", "attack", "attack", "hold", "march", "attack", "attack"],
      front: ["defend", "defend", "hold", "defend", "defend", "defend", "hold", "defend", "attack", "hold"]
    };
    var ruleSel = select(
      [
        { label: "A. Offensive exhaustion (consecutive attacks)", value: "A" },
        { label: "D. Fatigue track 0-3 with a value penalty", value: "D" }
      ],
      "A"
    );
    var nIn = range(2, 4, 3);
    var nOut = el("span", "w-out", "3");
    var lossSel = select(
      [
        { label: "0% (morale only)", value: "0" },
        { label: "10% per battle (faded)", value: "10" },
        { label: "20% per battle", value: "20" }
      ],
      "10"
    );
    var c1 = el("div", "w-row");
    c1.appendChild(labelled("Rule", ruleSel));
    var nw = labelled("Attack turns before exhaustion (A)", nIn);
    nw.appendChild(nOut);
    c1.appendChild(nw);
    c1.appendChild(labelled("Men lost per battle", lossSel));
    root.appendChild(c1);

    var presetRow = el("div", "w-row");
    [
      { k: "drive", t: "Attack every turn" },
      { k: "pulse", t: "Attack, attack, hold" },
      { k: "march", t: "March and strike" },
      { k: "front", t: "Static front" }
    ].forEach(function (p) {
      var b = el("button", null, p.t);
      b.type = "button";
      b.addEventListener("click", function () {
        PRESETS[p.k].forEach(function (a, i) {
          sels[i].value = a;
        });
        update();
      });
      presetRow.appendChild(b);
    });
    root.appendChild(presetRow);

    var sels = [];
    var planRow = el("div", "w-row");
    for (var i = 0; i < TURNS; i++) {
      var s = select(ACTIONS, PRESETS.pulse[i]);
      sels.push(s);
      planRow.appendChild(labelled("T" + (i + 1), s));
    }
    root.appendChild(planRow);

    var summary = el("div", "w-row");
    root.appendChild(summary);
    var wrap = el("div", "w-scroll");
    var table = el("table", "w-table");
    wrap.appendChild(table);
    root.appendChild(wrap);
    root.appendChild(
      el("div", "w-note", "One infantry regiment, attack 4 (scenario.json), 1,270 men at full establishment (Revision 6 research yardstick). Value = 4 x strength / fullStrength x morale (0.5 when demoralized, combat.demoralizationFactor) x fatigue factor (rule D only: 0.75 at fatigue 2), rounded, minimum 1, as M12. Hold = no move order: it entrenches when healthy (M22, +1 works to 3) and rests when demoralized (M23, one turn recovers). A demoralized army cannot attack (M23), so its Attack becomes Hold. Turns are two weeks (owner's statement; scenario.json does not record a turn length). Moves are the sub-region allowance if idea 7 lands: 2 normally, 1 when worn or demoralized (proposal).")
    );

    function update() {
      var rule = ruleSel.value;
      var N = intOf(nIn, 2, 4);
      nOut.textContent = String(N);
      var loss = parseInt(lossSel.value, 10) / 100;
      var full = 1270;
      var men = full;
      var dem = false;
      var count = 0; // A: consecutive attack turns; D: fatigue level
      var works = 0;
      var demTurns = 0;
      var valueSum = 0;
      var rows = [];
      for (var t = 0; t < TURNS; t++) {
        var act = sels[t].value;
        var note = "";
        if (dem && act === "attack") {
          act = "hold";
          note = "cannot attack (M23)";
        }
        var fatigueFactor = rule === "D" && count === 2 && !dem ? 0.75 : 1;
        var value = Math.max(1, Math.round(4 * (men / full) * (dem ? 0.5 : 1) * fatigueFactor));
        var moves = dem || (rule === "D" && count === 2) ? 1 : 2;
        valueSum += value;
        if (dem) demTurns += 1;
        var startDem = dem;
        if (act === "attack" || act === "defend") {
          men = Math.round(men * (1 - loss));
          works = act === "attack" ? 0 : works;
        }
        if (act === "march") works = 0;
        if (rule === "A") {
          if (act === "attack") {
            count += 1;
            if (count >= N) {
              dem = true;
              count = 0;
              note = note || "exhausted: demoralized";
            }
          } else {
            count = 0;
          }
        } else {
          if (act === "attack" || act === "defend") count += 1;
          if (act === "hold") count = Math.max(0, count - 1);
          if (count >= 3 && !dem) {
            dem = true;
            note = note || "fatigue 3: demoralized";
          }
          if (count > 3) count = 3;
        }
        if (act === "hold") {
          if (startDem) {
            dem = false;
            note = note || "rested: recovers (M23)";
          } else if (!dem) {
            works = Math.min(3, works + 1);
          }
        }
        rows.push({ t: t + 1, act: act, note: note, count: count, dem: dem, men: men, value: value, works: works, moves: moves });
      }

      clear(table);
      var h = el("tr");
      ["Turn", "Order", rule === "A" ? "Attack streak" : "Fatigue", "Morale (end)", "Men (end)", "Attack value (start)", "Works", "Moves", "Note"].forEach(function (x) {
        h.appendChild(el("th", null, x));
      });
      table.appendChild(h);
      rows.forEach(function (r) {
        var tr = el("tr");
        tr.appendChild(el("td", null, String(r.t)));
        tr.appendChild(el("td", null, r.act));
        tr.appendChild(el("td", null, String(r.count)));
        tr.appendChild(el("td", null, r.dem ? "demoralized" : "steady"));
        tr.appendChild(el("td", null, String(r.men)));
        var vc = el("td");
        var track = el("div", "w-bar-track");
        track.style.minWidth = "60px";
        var bar = el("div", "w-bar");
        bar.style.width = (r.value / 4) * 100 + "%";
        bar.style.background = r.value >= 4 ? "var(--c6)" : r.value >= 3 ? "var(--c5)" : r.value >= 2 ? "var(--c3)" : "var(--c1)";
        track.appendChild(bar);
        vc.appendChild(el("span", null, String(r.value)));
        vc.appendChild(track);
        tr.appendChild(vc);
        tr.appendChild(el("td", null, r.works ? "+" + r.works : "-"));
        tr.appendChild(el("td", null, String(r.moves)));
        tr.appendChild(el("td", null, r.note));
        table.appendChild(tr);
      });

      clear(summary);
      summary.appendChild(el("span", "w-label", "Turns spent demoralized:"));
      summary.appendChild(el("span", "w-out", String(demTurns)));
      summary.appendChild(el("span", "w-label", "Men left:"));
      summary.appendChild(el("span", "w-out", men + " of " + full + " (" + Math.round((men / full) * 100) + "%)"));
      summary.appendChild(el("span", "w-label", "Average attack value:"));
      summary.appendChild(el("span", "w-out", (valueSum / TURNS).toFixed(2) + " of 4"));
    }
    [ruleSel, nIn, lossSel].concat(sels).forEach(function (c) {
      c.addEventListener("input", update);
      c.addEventListener("change", update);
    });
    update();
  };
})();
