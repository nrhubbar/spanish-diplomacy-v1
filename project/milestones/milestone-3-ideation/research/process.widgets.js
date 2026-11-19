(window.M3W = window.M3W || {})["process-planner"] = function (root) {
  // Observed setups only, from the Milestone 2 decision logs and commit timestamps. No extrapolation.
  var ROWS = [
    { key: "streams", label: "Parallel streams" },
    { key: "slicing", label: "How work was split" },
    { key: "gate", label: "Gate per merge" },
    { key: "baselines", label: "Visual baselines" },
    { key: "size", label: "Squash on main" },
    { key: "red", label: "Red commits recorded" },
    { key: "conflicts", label: "Conflicts" },
    { key: "fixups", label: "Integration fix-ups" },
    { key: "verify", label: "Final verify" },
    { key: "time", label: "Wall-clock (commit times)" },
    { key: "soak", label: "Soak freezes (S2, budget 20%)" }
  ];
  var SETUPS = {
    r5: {
      name: "Rev 5",
      insertions: 16744, minutes: 194,
      streams: "1 agent for the main pass, then 3 parallel feedback branches",
      slicing: "Sequential plan steps; the core rewrite landed as one combined commit (D14)",
      gate: "Prose rule only; gated on exit codes after D30",
      baselines: "Once, after all merges (D61)",
      size: "166 files, +16,744 / -5,445",
      red: 4,
      redText: "At least 4: ebba659, 1ada094 (D30); merges 6ac44ca, c02ba3d (D63); plus terrain-branch commits",
      conflicts: "Not recorded; 2 of 3 feedback merges failed checks until a follow-up",
      fixups: "2 follow-up commits after merges (1b6a3cd, 306acd4)",
      verify: "Passed from a clean checkout",
      time: "10:22 plan to 13:36 last merge (194 min); branch done 13:54",
      soak: "79% (D36, movement-only rules)"
    },
    r6: {
      name: "Rev 6",
      red: 0, insertions: 15148, minutes: 126,
      streams: "8 (A to H) in two phases (D4)",
      slicing: "Contract first (D5), then mostly by layer: engine, presentation, data and AI, art",
      gate: "Every merge green, with fix-ups and changed baselines inside it (D8)",
      baselines: "Inside each merge (D8)",
      size: "194 files, +15,148 / -1,506",
      redText: "0 on the integration line; one stream skipped the gate on intermediate commits (R13)",
      conflicts: "Not recorded; 2 back-merges into streams; data and AI had to land together (D42)",
      fixups: "About 7 integration findings (D21, D29, D38, D43, D54, D55, D59); every game froze after merge (D52)",
      verify: "Passed from a clean checkout (D61)",
      time: "15:18 tasks to 17:24 last merge (126 min); branch done 17:47",
      soak: "70% (D60), after 100% at first merge (D52)"
    },
    r7: {
      name: "Rev 7",
      red: 0, insertions: 2465, minutes: 42,
      streams: "4 at once (D1)",
      slicing: "One stream per feature (orders, odds, map, focus); no contract stream",
      gate: "Lint, typecheck, unit plus each stream's browser specs before every merge (D20)",
      baselines: "Once, at the end (I.2, D31)",
      size: "69 files, +2,465 / -179",
      redText: "0 on the integration line (D20)",
      conflicts: "1 textual (D28, CampaignMap.tsx); about 3 semantic (D24, D25, D27)",
      fixups: "9 folded into 4 merges (D21 to D29)",
      verify: "Waived by the owner (D34)",
      time: "19:55 tasks to 20:37 last merge (42 min); baselines 20:40, declog done 21:25",
      soak: "58% (D32)"
    }
  };

  var row = document.createElement("div");
  row.className = "w-row";
  var lab = document.createElement("label");
  lab.className = "w-label";
  lab.textContent = "Observed setup";
  var sel = document.createElement("select");
  [["r5", "Rev 5: sequential, then 3 branches"], ["r6", "Rev 6: contract first, 8 layer streams"], ["r7", "Rev 7: 4 feature streams"]].forEach(function (o) {
    var opt = document.createElement("option");
    opt.value = o[0];
    opt.textContent = o[1];
    sel.appendChild(opt);
  });
  sel.value = "r7";
  lab.appendChild(sel);
  row.appendChild(lab);
  root.appendChild(row);

  var scroll = document.createElement("div");
  scroll.className = "w-scroll";
  var table = document.createElement("table");
  table.className = "w-table";
  var tbody = document.createElement("tbody");
  table.appendChild(tbody);
  scroll.appendChild(table);
  root.appendChild(scroll);

  var bars = document.createElement("div");
  bars.className = "w-grid";
  root.appendChild(bars);

  function barCard(title, key, max, fmt) {
    var card = document.createElement("div");
    card.className = "w-card";
    var h = document.createElement("div");
    h.className = "w-label";
    h.textContent = title;
    card.appendChild(h);
    var parts = [];
    ["r5", "r6", "r7"].forEach(function (id) {
      var s = SETUPS[id];
      var line = document.createElement("div");
      line.className = "w-note";
      line.textContent = s.name + ": " + fmt(s[key]);
      var track = document.createElement("div");
      track.className = "w-bar-track";
      var bar = document.createElement("div");
      bar.className = "w-bar";
      bar.style.width = Math.max(2, Math.round((s[key] / max) * 100)) + "%";
      track.appendChild(bar);
      card.appendChild(line);
      card.appendChild(track);
      parts.push({ id: id, bar: bar });
    });
    bars.appendChild(card);
    return parts;
  }

  var barSets = [
    barCard("Red commits recorded", "red", 4, function (v) { return v === 4 ? "4 or more" : String(v); }),
    barCard("Lines inserted on main", "insertions", 16744, function (v) { return v.toLocaleString("en-US"); }),
    barCard("Minutes from plan to last merge", "minutes", 194, function (v) { return v + " min"; })
  ];

  function render() {
    var s = SETUPS[sel.value];
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    ROWS.forEach(function (r) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.textContent = r.label;
      var td = document.createElement("td");
      td.textContent = r.key === "red" ? s.redText : s[r.key];
      if (r.key === "red" || r.key === "verify") {
        var bad = (r.key === "red" && s.red > 0) || (r.key === "verify" && /Waived/.test(s.verify));
        td.style.color = bad ? "var(--bad)" : "var(--good)";
      }
      tr.appendChild(th);
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    barSets.forEach(function (set) {
      set.forEach(function (p) {
        p.bar.style.background = p.id === sel.value ? "var(--accent)" : "var(--ink-soft)";
      });
    });
  }
  sel.addEventListener("change", render);
  render();

  var note = document.createElement("p");
  note.className = "w-note";
  note.textContent = "Source: milestone-2-rev-5, rev-6, and rev-7 decision logs and branch commit times (18 November 2026). Three revisions only, and confounded: size, stream count, slicing, and gate all changed together, so read this as evidence, not a model. Minutes run from the plan or tasks commit to the last merge commit and include owner interaction.";
  root.appendChild(note);
};
