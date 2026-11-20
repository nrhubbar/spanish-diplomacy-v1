/* Cluster "time": widgets for idea 3 (timer-sim) and idea 12 (weather-months). Plain ES2019. */
(function () {
  var W = (window.M3W = window.M3W || {});

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function labelled(labelText, control) {
    var wrap = el("label", "w-label");
    wrap.appendChild(document.createTextNode(labelText + " "));
    wrap.appendChild(control);
    return wrap;
  }
  function select(options, value) {
    var s = document.createElement("select");
    options.forEach(function (o) {
      var opt = document.createElement("option");
      opt.value = String(o.value);
      opt.textContent = o.label;
      if (o.disabled) opt.disabled = true;
      s.appendChild(opt);
    });
    s.value = String(value);
    return s;
  }
  function bar(pct, color) {
    var track = el("div", "w-bar-track");
    var b = el("div", "w-bar");
    b.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + "%";
    if (color) b.style.background = "var(" + color + ")";
    track.appendChild(b);
    return track;
  }
  function clock(seconds) {
    var s = Math.round(seconds);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var r = s % 60;
    var mm = (h > 0 && m < 10 ? "0" : "") + m;
    return (h > 0 ? h + ":" : "") + mm + ":" + (r < 10 ? "0" : "") + r;
  }

  /* ---------------- Idea 3: timer-sim ---------------- */
  W["timer-sim"] = function (root) {
    // Spain scenario armies at the 31 July 1936 snapshot (scenario.json units[]).
    var factions = [
      { name: "Republic", armies: 15, color: "--rep" },
      { name: "Northern Insurgent Command", armies: 12, color: "--nic" },
      { name: "Southern Insurgent Command", armies: 8, color: "--sic" }
    ];
    var timerSel = select([
      { value: 0, label: "Not timed" },
      { value: 60, label: "1 min" },
      { value: 300, label: "5 min" },
      { value: 600, label: "10 min" },
      { value: 1800, label: "30 min" },
      { value: 3600, label: "1 hr" }
    ], 300);
    var humansSel = select([
      { value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }
    ], 2);
    var compSel = document.createElement("select");
    var handoffIn = document.createElement("input");
    handoffIn.type = "number"; handoffIn.min = "0"; handoffIn.max = "600"; handoffIn.step = "5"; handoffIn.value = "20";
    var paceIn = document.createElement("input");
    paceIn.type = "range"; paceIn.min = "5"; paceIn.max = "60"; paceIn.step = "5"; paceIn.value = "20";
    var paceOut = el("span", "w-out", "20 s");
    var clockSel = select([
      { value: "planning", label: "Only while planning (recommended)" },
      { value: "handoff", label: "From the handoff screen" }
    ], "planning");
    var policySel = select([
      { value: "draft", label: "Submit planned orders, rest hold (recommended)" },
      { value: "hold", label: "Discard draft, every army holds" },
      { value: "grace", label: "One grace extension, then planned orders" },
      { value: "computer", label: "Computer plans the unordered armies" }
    ], "draft");

    function fillComputers() {
      var humans = Number(humansSel.value);
      var max = factions.length - humans;
      var prev = compSel.value === "" ? max : Number(compSel.value);
      while (compSel.firstChild) compSel.removeChild(compSel.firstChild);
      for (var i = 0; i <= max; i++) {
        var o = document.createElement("option");
        o.value = String(i); o.textContent = String(i);
        compSel.appendChild(o);
      }
      compSel.value = String(Math.min(prev, max));
    }
    fillComputers();

    var r1 = el("div", "w-row");
    r1.appendChild(labelled("Timer", timerSel));
    r1.appendChild(labelled("Local humans", humansSel));
    r1.appendChild(labelled("Computer players", compSel));
    var r2 = el("div", "w-row");
    r2.appendChild(labelled("Handoff (s)", handoffIn));
    var paceWrap = labelled("Seconds per army order", paceIn);
    paceWrap.appendChild(paceOut);
    r2.appendChild(paceWrap);
    var r3 = el("div", "w-row");
    r3.appendChild(labelled("Clock runs", clockSel));
    r3.appendChild(labelled("On timeout", policySel));
    var out = el("div");
    var note = el("p", "w-note",
      "Army counts are the Spain scenario's (Republic 15, Northern 12, Southern 8). Seconds per order is an assumption, not a measurement. " +
      "Humans plan one after another on a shared PC (handoff screen before each when there are two or more); computer players submit instantly, as advance() does today.");
    root.appendChild(r1); root.appendChild(r2); root.appendChild(r3); root.appendChild(out); root.appendChild(note);

    function run() {
      var limit = Number(timerSel.value);
      var humans = Number(humansSel.value);
      var comps = Number(compSel.value);
      var handoff = Math.max(0, Number(handoffIn.value) || 0);
      var pace = Math.max(5, Math.min(60, Number(paceIn.value) || 20));
      var policy = policySel.value;
      var clockFromHandoff = clockSel.value === "handoff";
      paceOut.textContent = pace + " s";

      var t = 0;
      var rows = [];
      var longest = 0;
      for (var i = 0; i < humans + comps; i++) {
        var f = factions[i];
        var human = i < humans;
        if (!human) {
          rows.push({ f: f, human: false, start: t, end: t, used: 0, limit: 0, status: "Computer: all " + f.armies + " armies ordered instantly", kind: "good" });
          continue;
        }
        var hand = humans > 1 ? handoff : 0;
        var need = f.armies * pace;
        var start = t + hand;
        var used, status, kind, planned;
        if (limit === 0) {
          used = need; planned = f.armies; kind = "good";
          status = "Untimed: all " + f.armies + " ordered after " + clock(need);
        } else {
          var avail = Math.max(0, limit - (clockFromHandoff ? hand : 0));
          if (need <= avail) {
            used = need; planned = f.armies; kind = "good";
            status = "Ended turn with " + clock(avail - need) + " to spare; all " + f.armies + " ordered";
          } else if (policy === "grace") {
            var avail2 = avail + limit;
            used = Math.min(need, avail2);
            planned = Math.min(f.armies, Math.floor(avail2 / pace));
            kind = "warn";
            status = (need <= avail2 ? "Finished in grace time: " : "Grace used, then timed out: ") +
              planned + " ordered, " + (f.armies - planned) + " hold";
          } else {
            used = avail;
            planned = Math.min(f.armies, Math.floor(avail / pace));
            kind = "bad";
            if (policy === "hold") {
              status = "Timed out: draft of " + planned + " discarded, all " + f.armies + " hold";
            } else if (policy === "computer") {
              status = "Timed out: " + planned + " planned by player, " + (f.armies - planned) + " by computer";
            } else {
              status = "Timed out: " + planned + " ordered, " + (f.armies - planned) + " hold";
            }
          }
        }
        longest = Math.max(longest, used);
        rows.push({ f: f, human: true, start: start, end: start + used, used: used, limit: limit === 0 ? need : (policy === "grace" && kind === "warn" ? 2 * limit : limit), status: status, kind: kind, hand: hand });
        t = start + used;
      }

      while (out.firstChild) out.removeChild(out.firstChild);
      var wrap = el("div", "w-scroll");
      var table = el("table", "w-table");
      var head = el("tr");
      ["Faction", "Clock starts", "Ends", "Clock used", "What is submitted"].forEach(function (h) { head.appendChild(el("th", null, h)); });
      table.appendChild(head);
      rows.forEach(function (r) {
        var tr = el("tr");
        var name = el("td", null, r.f.name + (r.human ? " (local)" : " (computer)"));
        name.style.color = "var(" + r.f.color + ")";
        tr.appendChild(name);
        tr.appendChild(el("td", null, r.human ? clock(r.start) : "-"));
        tr.appendChild(el("td", null, r.human ? clock(r.end) : "-"));
        var cell = el("td");
        if (r.human) {
          cell.appendChild(bar(r.limit > 0 ? (100 * r.used) / r.limit : 0, r.kind === "good" ? "--good" : r.kind === "warn" ? "--warn" : "--bad"));
        } else {
          cell.textContent = "0:00";
        }
        tr.appendChild(cell);
        tr.appendChild(el("td", null, r.status));
        table.appendChild(tr);
      });
      wrap.appendChild(table);
      out.appendChild(wrap);

      var sum = el("div", "w-row");
      sum.appendChild(el("span", "w-label", "Turn wall time on one PC"));
      sum.appendChild(el("span", "w-out", clock(t)));
      sum.appendChild(el("span", "w-label", "Same turn online (clocks in parallel)"));
      sum.appendChild(el("span", "w-out", clock(longest)));
      out.appendChild(sum);
      if (limit >= 1800 && humans > 1) {
        out.appendChild(el("p", "w-note", "Long timers add up on a shared PC: " + humans + " humans x " + clock(limit) + " can be a " + clock(humans * limit) + " turn. These values suit online play."));
      }
    }

    [timerSel, compSel, policySel, clockSel].forEach(function (c) { c.addEventListener("change", run); });
    humansSel.addEventListener("change", function () { fillComputers(); run(); });
    handoffIn.addEventListener("input", run);
    paceIn.addEventListener("input", run);
    run();
  };

  /* ---------------- Idea 12: weather-months ---------------- */
  W["weather-months"] = function (root) {
    var outcomes = [
      { id: "clear", name: "Clear", color: "--c7", std: 0, soft: 0, extra: "No effect." },
      { id: "hot", name: "Hot", color: "--c5", std: -1, soft: 0, extra: "Heat and water shortage (Ebro, Aug 1938). Hook for exhaustion (idea 6)." },
      { id: "rain", name: "Rain", color: "--c4", std: -1, soft: 0, extra: "Aircraft reduced (hook for idea 8)." },
      { id: "mud", name: "Mud", color: "--c2", std: -2, soft: -1, extra: "Aircraft grounded except from paved city fields; motorised bonus lost (hooks, idea 8, Guadalajara)." },
      { id: "snow", name: "Snow", color: "--c3", std: -2, soft: -1, extra: "No digging-in gain this turn (M22)." },
      { id: "cold", name: "Severe cold", color: "--c1", std: -2, soft: -2, extra: "No digging-in gain (M22); frostbite hook (Teruel, Jan 1938)." }
    ];
    // Weights out of 20, order: clear, hot, rain, mud, snow, cold. Derived by script from AEMET normals (see time.md 2.5).
    var zones = {
      cantabrian: { name: "Cantabrian (Galicia, Asturias, Cantabria, Pais Vasco)", station: "Santander 1981-2010",
        w: [[7,0,6,6,1,0],[9,0,5,6,0,0],[10,0,5,5,0,0],[8,0,8,4,0,0],[10,0,10,0,0,0],[12,0,8,0,0,0],[13,0,7,0,0,0],[12,0,8,0,0,0],[11,0,9,0,0,0],[9,0,7,4,0,0],[7,0,7,6,0,0],[8,0,6,6,0,0]] },
      meseta: { name: "Meseta (Castilla y Leon, La Rioja, Navarra, Aragon, Madrid, Castilla-La Mancha)", station: "mean of Madrid Retiro and Teruel 1991-2020",
        w: [[12,0,2,2,3,1],[12,0,2,2,3,1],[13,0,3,2,2,0],[13,0,4,2,1,0],[13,0,7,0,0,0],[16,0,4,0,0,0],[12,6,2,0,0,0],[13,4,3,0,0,0],[16,0,4,0,0,0],[14,0,4,2,0,0],[13,0,3,3,1,0],[12,0,3,2,2,1]] },
      mediterranean: { name: "Mediterranean (Cataluna, Valencia, Murcia, Islas Baleares)", station: "Valencia 1991-2020",
        w: [[16,0,2,2,0,0],[16,0,2,2,0,0],[16,0,2,2,0,0],[16,0,3,1,0,0],[16,0,4,0,0,0],[18,0,2,0,0,0],[19,0,1,0,0,0],[16,2,2,0,0,0],[15,0,5,0,0,0],[15,0,3,2,0,0],[16,0,2,2,0,0],[16,0,2,2,0,0]] },
      south: { name: "South (Andalucia, Extremadura, Ceuta, Melilla)", station: "Seville airport 1991-2020",
        w: [[14,0,3,3,0,0],[15,0,3,2,0,0],[14,0,3,3,0,0],[14,0,4,2,0,0],[16,0,4,0,0,0],[12,7,1,0,0,0],[12,8,0,0,0,0],[12,8,0,0,0,0],[13,4,3,0,0,0],[14,0,4,2,0,0],[14,0,3,3,0,0],[14,0,3,3,0,0]] }
    };
    var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    var monthIn = document.createElement("input");
    monthIn.type = "range"; monthIn.min = "1"; monthIn.max = "12"; monthIn.step = "1"; monthIn.value = "1";
    var monthOut = el("span", "w-out", "January");
    var zoneSel = select([
      { value: "cantabrian", label: "Cantabrian" },
      { value: "meseta", label: "Meseta" },
      { value: "mediterranean", label: "Mediterranean" },
      { value: "south", label: "South" }
    ], "meseta");
    var setSel = select([
      { value: "soft", label: "Soft effects (recommended)" },
      { value: "std", label: "Standard effects" }
    ], "soft");
    var oddsSel = select([
      { value: 1, label: "1:1" }, { value: 2, label: "2:1" }, { value: 3, label: "3:1" },
      { value: 4, label: "4:1" }, { value: 5, label: "5:1" }, { value: 6, label: "6:1" }
    ], 2);

    var r1 = el("div", "w-row");
    var mWrap = labelled("Month", monthIn);
    mWrap.appendChild(monthOut);
    r1.appendChild(mWrap);
    r1.appendChild(labelled("Zone", zoneSel));
    var r2 = el("div", "w-row");
    r2.appendChild(labelled("Effect set", setSel));
    r2.appendChild(labelled("Attack odds", oddsSel));
    var out = el("div");
    var note = el("p", "w-note",
      "Illustrative values, not 1936-39 observations: weights out of 20 derived from modern AEMET climate normals quoted on Wikipedia " +
      "(rain days, snow days, mean highs and lows). Chances use the shipped d6 table: column k succeeds when k + row >= 6, row = die + modifier clamped 0..6 (M15), with no other modifiers.");
    root.appendChild(r1); root.appendChild(r2); root.appendChild(out); root.appendChild(note);

    function pSuccess(k, mod) {
      var wins = 0;
      for (var die = 1; die <= 6; die++) {
        var row = Math.max(0, Math.min(6, die + mod));
        if (k + row >= 6) wins++;
      }
      return wins / 6;
    }
    function turnsIn(monthIndex) {
      var start = Date.UTC(1936, 6, 31);
      var byYear = {};
      for (var n = 1; n <= 70; n++) {
        var mid = new Date(start + (14 * (n - 1) + 7) * 86400000);
        if (mid.getUTCMonth() === monthIndex) {
          var y = mid.getUTCFullYear();
          (byYear[y] = byYear[y] || []).push(n);
        }
      }
      return Object.keys(byYear).map(function (y) { return y + ": " + byYear[y].join(", "); }).join("; ");
    }

    function run() {
      var m = Math.max(0, Math.min(11, Math.round(Number(monthIn.value) || 1) - 1));
      var zone = zones[zoneSel.value];
      var key = setSel.value;
      var k = Number(oddsSel.value);
      var weights = zone.w[m];
      var total = weights.reduce(function (a, b) { return a + b; }, 0);
      monthOut.textContent = months[m];

      while (out.firstChild) out.removeChild(out.firstChild);
      out.appendChild(el("p", "w-note", zone.name + ". Station: " + zone.station + "."));
      var wrap = el("div", "w-scroll");
      var table = el("table", "w-table");
      var head = el("tr");
      ["Weather", "Odds", "", "Attack roll", "Other effects"].forEach(function (h) { head.appendChild(el("th", null, h)); });
      table.appendChild(head);
      var expMod = 0, expP = 0;
      outcomes.forEach(function (o, i) {
        var w = weights[i];
        var p = w / total;
        var mod = o[key];
        expMod += p * mod;
        expP += p * pSuccess(k, mod);
        var tr = el("tr");
        tr.appendChild(el("td", null, o.name));
        tr.appendChild(el("td", null, w + "/20 (" + Math.round(p * 100) + "%)"));
        var cell = el("td");
        cell.appendChild(bar(p * 100, o.color));
        tr.appendChild(cell);
        tr.appendChild(el("td", null, mod === 0 ? "0" : String(mod) + " (d20 " + String(mod * 3) + ")"));
        tr.appendChild(el("td", null, o.extra));
        table.appendChild(tr);
      });
      wrap.appendChild(table);
      out.appendChild(wrap);

      var cards = el("div", "w-grid");
      function card(label, value) {
        var c = el("div", "w-card");
        c.appendChild(el("div", "w-label", label));
        c.appendChild(el("div", "w-out", value));
        cards.appendChild(c);
      }
      card("Expected attack modifier", (expMod <= 0 ? "" : "+") + expMod.toFixed(2));
      card("Take territory at " + k + ":1, clear", Math.round(pSuccess(k, 0) * 100) + "%");
      card("Take territory at " + k + ":1, this month", Math.round(expP * 100) + "%");
      out.appendChild(cards);
      out.appendChild(el("p", "w-note", "Turns whose midpoint falls in " + months[m] + " (two-week turns from 31 July 1936): " + turnsIn(m) + "."));
    }

    [zoneSel, setSel, oddsSel].forEach(function (c) { c.addEventListener("change", run); });
    monthIn.addEventListener("input", run);
    run();
  };
})();
