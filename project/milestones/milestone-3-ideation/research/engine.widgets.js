/* Engine cluster widgets: harness-estimator (idea 11) and data-or-code (idea 13). Plain ES2019. */
(function () {
  "use strict";

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function labelled(labelText, control) {
    var label = el("label", "w-label");
    label.appendChild(document.createTextNode(labelText + " "));
    label.appendChild(control);
    return label;
  }

  function numberInput(value, min, max, step) {
    var input = document.createElement("input");
    input.type = "number";
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.style.width = "6em";
    return input;
  }

  function readNumber(input, fallback, min, max) {
    var v = parseFloat(input.value);
    if (!isFinite(v)) v = fallback;
    if (v < min) v = min;
    if (v > max) v = max;
    return v;
  }

  /* Wilson score interval, 95 percent. Returns [low, high] as shares 0..1. */
  function wilson(p, n) {
    if (n <= 0) return [0, 1];
    var z = 1.96;
    var d = 1 + (z * z) / n;
    var c = p + (z * z) / (2 * n);
    var h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
  }

  function pct(x) {
    return (x * 100).toFixed(1) + "%";
  }

  function formatSeconds(s) {
    if (s < 1) return Math.round(s * 1000) + " ms";
    if (s < 120) return s.toFixed(1) + " s";
    if (s < 7200) return (s / 60).toFixed(1) + " min";
    return (s / 3600).toFixed(1) + " h";
  }

  /* ---------------------------------------------------------------- harness-estimator */
  (window.M3W = window.M3W || {})["harness-estimator"] = function (root) {
    if (!root) return;
    var MEASURED_MS = 12; // one soak run: about 2.4 s for 200 Spain games at a 30-turn cap
    var STARTUP_S = 0.5; // estimate: load bundle and parse the scenario in the parent
    var WORKER_START_S = 0.3; // estimate: each worker loads the bundle and scenario (in parallel)
    var EFFICIENCY = 0.9; // estimate: merge and scheduling overhead when workers > 1

    var controls = el("div", "w-row");
    var presets = el("div", "w-row");
    var games = numberInput(200, 1, 100000, 1);
    var turns = numberInput(30, 1, 300, 1);
    var workers = document.createElement("input");
    workers.type = "range";
    workers.min = "1";
    workers.max = "10"; // this machine's core count
    workers.step = "1";
    workers.value = "8";
    var workersOut = el("span", "w-out", "8");
    var ms = numberInput(MEASURED_MS, 0.1, 10000, 0.1);
    var slowdown = document.createElement("select");
    [["1", "1x (today's m2-strength)"], ["2", "2x"], ["3", "3x"], ["5", "5x"], ["10", "10x"]].forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = o[0];
      opt.textContent = o[1];
      slowdown.appendChild(opt);
    });
    var share = numberInput(13, 0.1, 99.9, 0.1);
    var decided = numberInput(51.5, 1, 100, 0.5);

    [10, 200, 1000].forEach(function (n) {
      var b = el("button", null, n + " games");
      b.type = "button";
      b.addEventListener("click", function () {
        games.value = String(n);
        update();
      });
      presets.appendChild(b);
    });

    controls.appendChild(labelled("Games", games));
    controls.appendChild(labelled("Turn cap", turns));
    var wl = labelled("Workers", workers);
    wl.appendChild(document.createTextNode(" "));
    wl.appendChild(workersOut);
    controls.appendChild(wl);
    controls.appendChild(labelled("ms per 30-turn game", ms));
    controls.appendChild(labelled("Milestone 3 slowdown", slowdown));

    var controls2 = el("div", "w-row");
    controls2.appendChild(labelled("Faction win share %", share));
    controls2.appendChild(labelled("Decided games %", decided));

    var outRow = el("div", "w-grid");
    function card(title) {
      var c = el("div", "w-card");
      c.appendChild(el("div", "w-label", title));
      var v = el("div", "w-out", "-");
      c.appendChild(v);
      var sub = el("div", "w-note", "");
      c.appendChild(sub);
      outRow.appendChild(c);
      return { value: v, sub: sub };
    }
    var wallCard = card("Wall time");
    var cpuCard = card("CPU time (one core)");
    var ciCard = card("95% interval for the share");
    var abCard = card("Smallest freeze-rate change detectable");

    var scroll = el("div", "w-scroll");
    var table = el("table", "w-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Games", "Decided", "Interval", "Width", ""].forEach(function (h) {
      hr.appendChild(el("th", null, h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    scroll.appendChild(table);

    var note = el(
      "p",
      "w-note",
      "ms per game: measured once on this machine (10 cores, Node 24): 200 Spain games x 30-turn cap took about 2.4 s inside one Vitest run (2.66 s import phase less module loading), so about 12 ms per game. Workers are capped at the machine's 10 cores. Start-up (0.5 s + 0.3 s per worker) and 90% parallel efficiency are estimates. Intervals are Wilson 95% over decided games; today's soak: Southern 13 of 103 decided. Detectable change: baseline freeze rate 58%, two-sided 5%, 80% power, unpaired (pairing seeds does better)."
    );

    root.appendChild(presets);
    root.appendChild(controls);
    root.appendChild(controls2);
    root.appendChild(outRow);
    root.appendChild(scroll);
    root.appendChild(note);

    function update() {
      var g = Math.round(readNumber(games, 200, 1, 100000));
      var t = readNumber(turns, 30, 1, 300);
      var w = Math.round(readNumber(workers, 8, 1, 10));
      var m = readNumber(ms, MEASURED_MS, 0.1, 10000);
      var f = parseFloat(slowdown.value) || 1;
      var p = readNumber(share, 13, 0.1, 99.9) / 100;
      var dShare = readNumber(decided, 51.5, 1, 100) / 100;
      workersOut.textContent = String(w);

      var perGameS = (m / 1000) * (t / 30) * f;
      var cpu = g * perGameS;
      var effective = Math.min(w, g);
      var wall = STARTUP_S + (effective > 1 ? WORKER_START_S + cpu / (effective * EFFICIENCY) : cpu);
      wallCard.value.textContent = formatSeconds(wall);
      wallCard.sub.textContent = effective + " worker" + (effective === 1 ? "" : "s") + ", about " + Math.round(g / Math.max(wall, 0.001)) + " games/s";
      cpuCard.value.textContent = formatSeconds(cpu);
      cpuCard.sub.textContent = (perGameS * 1000).toFixed(1) + " ms per game";

      var nd = Math.max(1, Math.round(g * dShare));
      var ci = wilson(p, nd);
      ciCard.value.textContent = pct(ci[0]) + " to " + pct(ci[1]);
      ciCard.sub.textContent = "about " + nd + " decided games; width " + ((ci[1] - ci[0]) * 100).toFixed(1) + " points";

      var d = (1.96 + 0.8416) * Math.sqrt((2 * 0.58 * 0.42) / g);
      abCard.value.textContent = (d * 100).toFixed(1) + " points";
      abCard.sub.textContent = "from 58% baseline, " + g + " games per variant";

      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      var rows = [10, 200, 1000];
      if (rows.indexOf(g) < 0) rows.push(g);
      rows.sort(function (a, b) { return a - b; });
      rows.forEach(function (n) {
        var ndn = Math.max(1, Math.round(n * dShare));
        var iv = wilson(p, ndn);
        var tr = el("tr");
        tr.appendChild(el("td", null, n === g ? n + " (yours)" : n));
        tr.appendChild(el("td", null, ndn));
        tr.appendChild(el("td", null, pct(iv[0]) + " to " + pct(iv[1])));
        tr.appendChild(el("td", null, ((iv[1] - iv[0]) * 100).toFixed(1) + " pts"));
        var cell = el("td");
        var track = el("div", "w-bar-track");
        track.style.minWidth = "80px";
        var bar = el("div", "w-bar");
        bar.style.width = Math.min(100, ((iv[1] - iv[0]) * 100) / 0.6) + "%";
        bar.style.background = n === g ? "var(--accent)" : "var(--sic)";
        track.appendChild(bar);
        cell.appendChild(track);
        tr.appendChild(cell);
        tbody.appendChild(tr);
      });
    }

    [games, turns, workers, ms, slowdown, share, decided].forEach(function (c) {
      c.addEventListener("input", update);
      c.addEventListener("change", update);
    });
    update();
  };

  /* ---------------------------------------------------------------- data-or-code */
  (window.M3W = window.M3W || {})["data-or-code"] = function (root) {
    if (!root) return;
    var MODES = [
      { id: "ww1", name: "WW1" },
      { id: "ww2", name: "WW2" },
      { id: "rcw", name: "Russian Revolution" },
      { id: "syw", name: "Seven Years' War" },
      { id: "nap", name: "Napoleonic" }
    ];
    /* need: 0 not needed, 1 same mechanism with new numbers, 2 a new variant of the mechanism.
       fields and tests are rough estimates (schema fields; test cases) per choice: [data, module, code]. */
    var ELEMENTS = [
      { id: "unit-values", name: "Unit types and values", algo: false, today: "data", rec: "data", fields: [6, 6, 0], tests: [2, 4, 6], need: { ww1: 1, ww2: 1, rcw: 1, syw: 1, nap: 1 } },
      { id: "unit-effects", name: "Unit special effects", algo: true, today: "code", rec: "module", fields: [10, 4, 0], tests: [25, 8, 6], need: { ww1: 2, ww2: 2, rcw: 2, syw: 1, nap: 1 } },
      { id: "combat-table", name: "Combat table and modifiers", algo: false, today: "data", rec: "data", fields: [8, 8, 0], tests: [3, 5, 8], need: { ww1: 1, ww2: 1, rcw: 1, syw: 1, nap: 1 } },
      { id: "dice", name: "Dice and battle resolution", algo: true, today: "code", rec: "module", fields: [15, 1, 0], tests: [40, 12, 12], need: { ww1: 1, ww2: 2, rcw: 1, syw: 1, nap: 2 } },
      { id: "resources", name: "Resource types, costs, yields", algo: false, today: "code", rec: "data", fields: [8, 8, 0], tests: [2, 4, 6], need: { ww1: 1, ww2: 1, rcw: 1, syw: 1, nap: 1 } },
      { id: "economy", name: "Economy rules (earning, spending)", algo: true, today: "code", rec: "module", fields: [12, 3, 0], tests: [30, 10, 10], need: { ww1: 1, ww2: 2, rcw: 1, syw: 1, nap: 1 } },
      { id: "recruitment", name: "Recruitment and replacements", algo: true, today: "code", rec: "module", fields: [10, 3, 0], tests: [25, 8, 8], need: { ww1: 1, ww2: 1, rcw: 1, syw: 1, nap: 1 } },
      { id: "weather-table", name: "Weather odds by month and zone", algo: false, today: "code", rec: "data", fields: [4, 4, 0], tests: [2, 4, 6], need: { ww1: 1, ww2: 1, rcw: 1, syw: 1, nap: 1 } },
      { id: "weather-effects", name: "Weather and season effects", algo: true, today: "code", rec: "module", fields: [8, 2, 0], tests: [20, 6, 6], need: { ww1: 1, ww2: 1, rcw: 1, syw: 2, nap: 1 } },
      { id: "calendar", name: "Turn calendar (start, 14-day turns)", algo: false, today: "code", rec: "data", fields: [2, 2, 0], tests: [1, 2, 3], need: { ww1: 1, ww2: 1, rcw: 1, syw: 1, nap: 1 } },
      { id: "supply", name: "Supply", algo: true, today: "code", rec: "module", fields: [10, 3, 0], tests: [30, 10, 10], need: { ww1: 1, ww2: 1, rcw: 1, syw: 2, nap: 2 } },
      { id: "rail", name: "Rail movement and capacity", algo: true, today: "code", rec: "module", fields: [8, 3, 0], tests: [25, 8, 8], need: { ww1: 1, ww2: 1, rcw: 2, syw: 0, nap: 0 } },
      { id: "leaders", name: "Leaders and generals", algo: true, today: "code", rec: "module", fields: [8, 3, 0], tests: [20, 6, 6], need: { ww1: 0, ww2: 0, rcw: 1, syw: 2, nap: 2 } },
      { id: "air", name: "Air power", algo: true, today: "code", rec: "module", fields: [10, 3, 0], tests: [25, 8, 8], need: { ww1: 1, ww2: 2, rcw: 0, syw: 0, nap: 0 } },
      { id: "victory", name: "Victory conditions", algo: false, today: "data", rec: "data", fields: [4, 4, 0], tests: [2, 4, 6], need: { ww1: 1, ww2: 1, rcw: 1, syw: 1, nap: 1 } },
      { id: "ai-weights", name: "Computer-player weights", algo: false, today: "code", rec: "data", fields: [18, 18, 0], tests: [2, 3, 4], need: { ww1: 1, ww2: 1, rcw: 1, syw: 1, nap: 1 } },
      { id: "ai-strategy", name: "Computer-player strategy logic", algo: true, today: "code", rec: "module", fields: [20, 1, 0], tests: [40, 10, 10], need: { ww1: 1, ww2: 2, rcw: 1, syw: 1, nap: 1 } },
      { id: "factions", name: "Factions, board, briefings", algo: false, today: "data", rec: "data", fields: [20, 20, 0], tests: [5, 5, 8], need: { ww1: 1, ww2: 1, rcw: 1, syw: 1, nap: 1 } }
    ];
    var CHOICES = [["data", "Data"], ["module", "Named module"], ["code", "Code"]];
    var INDEX = { data: 0, module: 1, code: 2 };
    var state = {};

    var presets = el("div", "w-row");
    [["Recommended", "rec"], ["Today", "today"], ["All data", "data"], ["All code", "code"]].forEach(function (p) {
      var b = el("button", null, p[0]);
      b.type = "button";
      b.addEventListener("click", function () {
        ELEMENTS.forEach(function (e) {
          state[e.id] = p[1] === "rec" ? e.rec : p[1] === "today" ? e.today : p[1];
        });
        syncSelects();
        update();
      });
      presets.appendChild(b);
    });

    var scroll = el("div", "w-scroll");
    var table = el("table", "w-table");
    var thead = el("thead");
    var hr = el("tr");
    ["Element", "Where it lives"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    var selects = {};
    ELEMENTS.forEach(function (e) {
      state[e.id] = e.rec;
      var tr = el("tr");
      tr.appendChild(el("td", null, e.name));
      var td = el("td");
      var sel = document.createElement("select");
      sel.setAttribute("aria-label", e.name);
      CHOICES.forEach(function (c) {
        var opt = document.createElement("option");
        opt.value = c[0];
        opt.textContent = c[1];
        sel.appendChild(opt);
      });
      sel.value = e.rec;
      sel.addEventListener("change", function () {
        state[e.id] = sel.value;
        update();
      });
      selects[e.id] = sel;
      td.appendChild(sel);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);

    function syncSelects() {
      ELEMENTS.forEach(function (e) { selects[e.id].value = state[e.id]; });
    }

    var totals = el("div", "w-grid");
    function card(title) {
      var c = el("div", "w-card");
      c.appendChild(el("div", "w-label", title));
      var v = el("div", "w-out", "-");
      c.appendChild(v);
      var sub = el("div", "w-note", "");
      c.appendChild(sub);
      totals.appendChild(c);
      return { box: c, value: v, sub: sub };
    }
    var fieldsCard = card("Schema fields (estimate)");
    var testsCard = card("Test cases (estimate)");
    var riskCard = card("Algorithms written as data");

    var modesGrid = el("div", "w-grid");
    var modeCards = {};
    MODES.forEach(function (m) {
      var c = el("div", "w-card");
      c.appendChild(el("div", "w-label", m.name));
      var v = el("div", "w-out", "-");
      var sub = el("div", "w-note", "");
      c.appendChild(v);
      c.appendChild(sub);
      modesGrid.appendChild(c);
      modeCards[m.id] = { box: c, value: v, sub: sub };
    });

    var note = el(
      "p",
      "w-note",
      "Data: numbers and names in the scenario JSON. Named module: an algorithm in code that the JSON selects and tunes, with its own spec rules and tests. Code: hard-wired. An era's need per element comes from this cluster's rulebook check (Paths of Glory, Reds!, Frederick II, The Sun of Austerlitz, Strategic Command WWI; WW2 from recall). A 'new variant' means a different algorithm: with a module that is one new module, with code an engine edit, with data a rules language Revision 6 section 1.6 called untestable. Field and test counts are rough estimates for comparison only."
    );

    root.appendChild(presets);
    root.appendChild(scroll);
    root.appendChild(totals);
    root.appendChild(el("div", "w-label", "Next era: what loading it would take"));
    root.appendChild(modesGrid);
    root.appendChild(note);

    function update() {
      var fields = 0;
      var tests = 0;
      var risky = [];
      ELEMENTS.forEach(function (e) {
        var i = INDEX[state[e.id]];
        fields += e.fields[i];
        tests += e.tests[i];
        if (state[e.id] === "data" && e.algo) risky.push(e.name);
      });
      fieldsCard.value.textContent = String(fields);
      fieldsCard.sub.textContent = "in scenario.json";
      testsCard.value.textContent = String(tests);
      testsCard.sub.textContent = "unit and contract tests to write and keep";
      riskCard.value.textContent = String(risky.length);
      riskCard.sub.textContent = risky.length ? risky.join(", ") : "none: every algorithm is coded and tested";
      riskCard.box.style.borderLeft = "4px solid " + (risky.length ? "var(--bad)" : "var(--good)");

      MODES.forEach(function (m) {
        var newModules = [];
        var codeEdits = [];
        var dataRules = [];
        ELEMENTS.forEach(function (e) {
          var need = e.need[m.id] || 0;
          if (need === 0) return;
          var choice = state[e.id];
          if (choice === "code") codeEdits.push(e.name);
          else if (need === 2 && choice === "module") newModules.push(e.name);
          else if (need === 2 && choice === "data" && e.algo) dataRules.push(e.name);
        });
        var card = modeCards[m.id];
        var colour;
        if (codeEdits.length) {
          card.value.textContent = "Engine edits in " + codeEdits.length + " areas";
          card.sub.textContent = codeEdits.join(", ");
          colour = "var(--bad)";
        } else if (newModules.length) {
          card.value.textContent = "JSON + " + newModules.length + " new module" + (newModules.length === 1 ? "" : "s");
          card.sub.textContent = newModules.join(", ");
          colour = "var(--warn)";
        } else {
          card.value.textContent = "JSON and images only";
          card.sub.textContent = dataRules.length ? "but new rules written as data: " + dataRules.join(", ") : "every need is new numbers";
          colour = dataRules.length ? "var(--warn)" : "var(--good)";
        }
        card.box.style.borderLeft = "4px solid " + colour;
      });
    }

    update();
  };
})();
