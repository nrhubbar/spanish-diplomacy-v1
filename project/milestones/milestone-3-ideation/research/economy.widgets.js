/* Economy cluster widgets: recruit-cost (idea 1) and resource-picker (idea 2). Plain ES2019, no libraries. */
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

  /* ---------- recruit-cost ---------- */
  W["recruit-cost"] = function (root) {
    if (!root) return;
    // Real armies and unit types from src/main/scenarios/spain-1936-07-31/scenario.json.
    var TYPES = {
      "infantry-regiment": { name: "Infantry regiment", attack: 4, defence: 6, train: 2 },
      "militia-column": { name: "Militia column", attack: 3, defence: 4, train: 1 },
      "colonial-veterans": { name: "Colonial veterans", attack: 6, defence: 5, train: 2 },
      "security-forces": { name: "Security forces", attack: 3, defence: 5, train: 2 }
    };
    var ARMIES = [
      { id: "rep-castilla-3", name: "Castilla Infantry Regiment No. 3 (Republic)", type: "infantry-regiment", full: 740 },
      { id: "north-america-23", name: "Am\u00e9rica Infantry Regiment No. 23 (Northern)", type: "infantry-regiment", full: 700 },
      { id: "rep-durruti-column", name: "Durruti Column (Republic)", type: "militia-column", full: 2500 },
      { id: "north-navarre-requetes", name: "Navarrese Requet\u00e9 Tercios (Northern)", type: "militia-column", full: 5000 },
      { id: "south-legion", name: "Tercio Legion No. 2 (Southern)", type: "colonial-veterans", full: 1800 },
      { id: "rep-madrid-security", name: "Madrid Assault and Civil Guards (Republic)", type: "security-forces", full: 3000 }
    ];
    var DEMORALIZATION = 0.5; // combat.demoralizationFactor in the Spain scenario

    // M12: type value x strength / fullStrength x factor, rounded once, halves up, never below 1.
    function m12(base, strength, full, demoralized) {
      var x = (base * strength) / full;
      if (demoralized) x = x * DEMORALIZATION;
      x = Math.round(x * 1e9) / 1e9;
      return Math.max(1, Math.floor(x + 0.5));
    }

    root.textContent = "";
    var armySel = el("select");
    ARMIES.forEach(function (a, i) {
      var o = el("option", null, a.name);
      o.value = String(i);
      armySel.appendChild(o);
    });
    var nowIn = el("input");
    nowIn.type = "range";
    var restoreIn = el("input");
    restoreIn.type = "range";
    var priceIn = el("input");
    priceIn.type = "number";
    priceIn.min = "1";
    priceIn.max = "10";
    priceIn.step = "1";
    priceIn.value = "2";
    var capSel = el("select");
    [["25", "25% of establishment"], ["50", "50% of establishment"], ["100", "No cap"]].forEach(function (c) {
      var o = el("option", null, c[1]);
      o.value = c[0];
      if (c[0] === "50") o.selected = true;
      capSel.appendChild(o);
    });
    var demIn = el("input");
    demIn.type = "checkbox";

    var r1 = el("div", "w-row");
    r1.appendChild(labelled("Army", armySel));
    var r2 = el("div", "w-row");
    var nowOut = el("span", "w-out");
    var restoreOut = el("span", "w-out");
    r2.appendChild(labelled("Men now", nowIn));
    r2.appendChild(nowOut);
    r2.appendChild(labelled("Men to restore", restoreIn));
    r2.appendChild(restoreOut);
    var r3 = el("div", "w-row");
    r3.appendChild(labelled("Funds per value point", priceIn));
    r3.appendChild(labelled("Most men per turn", capSel));
    r3.appendChild(labelled("Demoralized", demIn));
    root.appendChild(r1);
    root.appendChild(r2);
    root.appendChild(r3);

    var cards = el("div", "w-grid");
    function card(title) {
      var c = el("div", "w-card");
      c.appendChild(el("div", "w-label", title));
      var v = el("div", "w-out", "-");
      c.appendChild(v);
      cards.appendChild(c);
      return v;
    }
    var fundsOut = card("Replenish cost (Funds)");
    var menOut = card("Manpower used (men)");
    var turnsOut = card("Turns to deliver");
    var newOut = card("Recruit new instead");
    root.appendChild(cards);

    var table = el("table", "w-table");
    var thead = el("thead");
    thead.appendChild(row(["", "Men", "Attack", "Defence"], true));
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    root.appendChild(wrapTable(table));

    var note = el("p", "w-note");
    note.textContent =
      "Armies, types (attack-defence) and the 0.5 demoralization factor are from the Spain scenario.json. " +
      "One value point = fullStrength / attack men, as in M16 attrition (740 / 4 = 185 men for Castilla No. 3). " +
      "Funds prices, the per-turn cap, the 2x price of a new army (a Strategic Command forum claim) and training turns are illustrative, not tuned. " +
      "Men arrive after battles (proposed M26 step 8a), so they fight from the next turn.";
    root.appendChild(note);

    var lastArmy = -1;
    function update() {
      var a = ARMIES[Number(armySel.value) || 0];
      var t = TYPES[a.type];
      if (lastArmy !== Number(armySel.value)) {
        lastArmy = Number(armySel.value);
        nowIn.min = "1";
        nowIn.max = String(a.full);
        nowIn.step = "1";
        nowIn.value = String(Math.round(a.full / 2));
      }
      var now = Math.min(a.full, Math.max(1, Number(nowIn.value) || 1));
      var room = a.full - now;
      restoreIn.min = "0";
      restoreIn.max = String(room);
      restoreIn.step = "1";
      if (Number(restoreIn.value) > room) restoreIn.value = String(room);
      var restore = Math.min(room, Math.max(0, Number(restoreIn.value) || 0));
      var price = Math.min(10, Math.max(1, Number(priceIn.value) || 1));
      var capShare = Number(capSel.value) / 100;
      var dem = demIn.checked;

      nowOut.textContent = String(now);
      restoreOut.textContent = String(restore);

      var menPerPoint = a.full / t.attack;
      var points = restore / menPerPoint;
      var funds = Math.ceil(points * price - 1e-9);
      var perTurn = Math.floor(a.full * capShare);
      var turns = restore === 0 ? 0 : Math.ceil(restore / perTurn);
      fundsOut.textContent = funds + " (" + points.toFixed(2) + " pts)";
      menOut.textContent = String(restore);
      turnsOut.textContent = restore === 0 ? "-" : turns + (turns === 1 ? " turn" : " turns");
      var newFunds = t.attack * price * 2;
      newOut.textContent = newFunds + " Funds, " + a.full + " men, " + t.train + (t.train === 1 ? " turn" : " turns");

      var after = now + restore;
      tbody.textContent = "";
      tbody.appendChild(row(["Now", now + " / " + a.full, m12(t.attack, now, a.full, dem), m12(t.defence, now, a.full, dem)]));
      tbody.appendChild(row(["After", after + " / " + a.full, m12(t.attack, after, a.full, dem), m12(t.defence, after, a.full, dem)]));
      tbody.appendChild(row(["Full strength", a.full + " / " + a.full, m12(t.attack, a.full, a.full, dem), m12(t.defence, a.full, a.full, dem)]));
    }
    [armySel, nowIn, restoreIn, priceIn, capSel, demIn].forEach(function (c) {
      c.addEventListener("input", update);
      c.addEventListener("change", update);
    });
    update();
    restoreIn.value = String(Math.min(185, Number(restoreIn.max) || 0));
    update();
  };

  /* ---------- resource-picker ---------- */
  W["resource-picker"] = function (root) {
    if (!root) return;
    // Estimates by the Economy research agent. decisions = new choices per faction per turn;
    // counters = new numbers on the planning screen; fields = new scenario.json fields; weight = complexity points.
    var RES = [
      { id: "funds", name: "Funds", precedent: "Axis & Allies IPCs; Strategic Command MPPs", decisions: 1, counters: 2, fields: 5, weight: 2,
        why: "What to buy: recruit or replenish, and where." },
      { id: "manpower", name: "Manpower", precedent: "Hearts of Iron IV; Call of War", decisions: 1, counters: 2, fields: 4, weight: 2,
        why: "Which armies get the men; the Republic's men-but-no-arms." },
      { id: "materiel", name: "Materiel / Production", precedent: "Hearts of Iron IV factories; A&A industrial complexes", decisions: 1, counters: 2, fields: 4, weight: 3,
        why: "Overlaps Funds unless only some types need it." },
      { id: "oil", name: "Oil", precedent: "Supremacy 1914; Call of War; HOI4 fuel", decisions: 1, counters: 2, fields: 3, weight: 4,
        why: "Needs per-unit upkeep rules; Spain imported nearly all of it." },
      { id: "food", name: "Food", precedent: "Supremacy 1914 grain and fish; Call of War", decisions: 0.5, counters: 2, fields: 3, weight: 3,
        why: "Mostly passive upkeep; players call such resources useless." },
      { id: "political", name: "Political capital", precedent: "Hearts of Iron IV political power; Arriba Espana support", decisions: 1, counters: 1, fields: 5, weight: 5,
        why: "Needs an event or decision catalogue to spend it on." },
      { id: "ap", name: "Action points", precedent: "Twilight Struggle and Paths of Glory ops", decisions: 2, counters: 1, fields: 2, weight: 4,
        why: "Changes every order; overlaps idea 6 (movement)." }
    ];
    var MAX = 5;
    root.textContent = "";
    var boxes = [];
    var controls = el("div", "w-row");
    RES.forEach(function (r) {
      var b = el("input");
      b.type = "checkbox";
      b.value = r.id;
      if (r.id === "funds" || r.id === "manpower") b.checked = true;
      boxes.push(b);
      var l = el("label", "w-label");
      l.appendChild(b);
      l.appendChild(document.createTextNode(" " + r.name));
      controls.appendChild(l);
    });
    root.appendChild(controls);
    var limitNote = el("p", "w-note", "");
    root.appendChild(limitNote);

    var cards = el("div", "w-grid");
    function card(title) {
      var c = el("div", "w-card");
      c.appendChild(el("div", "w-label", title));
      var v = el("div", "w-out", "-");
      c.appendChild(v);
      cards.appendChild(c);
      return v;
    }
    var decOut = card("Extra decisions per turn");
    var cntOut = card("New on-screen counters");
    var fldOut = card("New schema fields");
    var cxOut = card("Complexity");
    root.appendChild(cards);

    var track = el("div", "w-bar-track");
    var bar = el("div", "w-bar");
    track.appendChild(bar);
    root.appendChild(track);

    var table = el("table", "w-table");
    var thead = el("thead");
    thead.appendChild(row(["Resource", "Precedent", "Why it costs complexity"], true));
    table.appendChild(thead);
    var tbody = el("tbody");
    table.appendChild(tbody);
    root.appendChild(wrapTable(table));

    var note = el("p", "w-note");
    note.textContent =
      "All counts are the Economy agent's estimates, not measurements. Counters include a balance and its per-turn change. " +
      "Fields count scenario.json additions such as yields, starting amounts, aid and unit costs. " +
      "Bands: up to 4 light, 5 to 8 medium, 9 to 12 heavy, above 12 overloaded. Designers cite about seven options as the limit a player can hold in mind (designer-notes.com).";
    root.appendChild(note);

    function update() {
      var chosen = [];
      boxes.forEach(function (b, i) {
        if (b.checked) chosen.push(RES[i]);
      });
      if (chosen.length === 0) {
        boxes[0].checked = true;
        chosen.push(RES[0]);
      }
      boxes.forEach(function (b) {
        b.disabled = !b.checked && chosen.length >= MAX;
      });
      limitNote.textContent = chosen.length >= MAX ? "Five is the most this picker allows." : "Pick 1 to 5 resources.";
      var d = 0, c = 0, f = 0, w = 0;
      tbody.textContent = "";
      chosen.forEach(function (r) {
        d += r.decisions;
        c += r.counters;
        f += r.fields;
        w += r.weight;
        tbody.appendChild(row([r.name, r.precedent, r.why]));
      });
      // Every extra resource also adds a pairwise trade-off the player must weigh.
      var pairs = (chosen.length * (chosen.length - 1)) / 2;
      var score = w + pairs;
      decOut.textContent = String(d);
      cntOut.textContent = String(c);
      fldOut.textContent = String(f);
      var band, colour;
      if (score <= 4) { band = "Light"; colour = "var(--good)"; }
      else if (score <= 8) { band = "Medium"; colour = "var(--accent)"; }
      else if (score <= 12) { band = "Heavy"; colour = "var(--warn)"; }
      else { band = "Overloaded"; colour = "var(--bad)"; }
      cxOut.textContent = band + " (" + score + ")";
      bar.style.width = Math.min(100, Math.round((score / 30) * 100)) + "%";
      bar.style.background = colour;
    }
    boxes.forEach(function (b) {
      b.addEventListener("change", function () {
        var n = boxes.filter(function (x) { return x.checked; }).length;
        if (n > MAX) b.checked = false;
        update();
      });
    });
    update();
  };
})();
