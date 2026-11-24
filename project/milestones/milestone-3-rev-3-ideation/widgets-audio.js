/* Sound widgets for the Revision 3 plan: "sfx-board" (listen to the candidates) and "mix-lab"
   (three volume sliders, and ten quick orders with and without the sound rules).
   Vanilla JS. Nothing plays until a button is pressed. Uses window.M3W_AUDIO when the page
   embeds the manifest (an entry may carry `src`, for example a data URL); otherwise it reads
   audio-candidates/manifest.json, and the lab falls back to made-up tones. */
(function () {
  "use strict";
  window.M3W = window.M3W || {};

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "class") node.className = attrs[key];
      else if (key.slice(0, 2) === "on") node.addEventListener(key.slice(2), attrs[key]);
      else node.setAttribute(key, attrs[key]);
    });
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function srcOf(entry) { return entry.src || "audio-candidates/" + entry.file; }
  var manifestPromise;
  function manifest() {
    if (window.M3W_AUDIO) return Promise.resolve(window.M3W_AUDIO);
    if (!manifestPromise) {
      manifestPromise = fetch("audio-candidates/manifest.json").then(function (r) {
        if (!r.ok) throw new Error("no manifest");
        return r.json();
      }).catch(function () { return []; });
    }
    return manifestPromise;
  }
  /* Every slider in the plan uses one curve: loudness feels roughly even, so half way is -12 dB. */
  function curve(percent) { var v = percent / 100; return v * v; }
  function db(gain) { return gain <= 0.00001 ? "silent" : (20 * Math.log10(gain)).toFixed(0) + " dB"; }
  var uid = 0;
  function slider(label, value, onInput) {
    var id = "m3w-audio-" + (uid += 1);
    var out = el("output", { class: "w-out", for: id }, value + "%");
    var input = el("input", { id: id, type: "range", min: "0", max: "100", step: "5", value: String(value), style: "flex:1 1 140px;min-width:120px;accent-color:var(--accent)" });
    input.addEventListener("input", function () { out.textContent = input.value + "%"; onInput(Number(input.value)); });
    var row = el("div", { class: "w-row" });
    row.append(el("label", { class: "w-label", for: id, style: "flex:0 0 72px" }, label), input, out);
    return { input: input, row: row };
  }

  /* ---------------------------------------------------------------- sfx-board */
  window.M3W["sfx-board"] = function (root) {
    root.append(el("h4", {}, "Listen to the candidate sounds"));
    root.append(el("p", { class: "w-note" }, "Each one is trimmed, mono and levelled to the same peak. Loudness in the game is set by the mix, not by these files. Nothing plays until you press a button."));
    var volume = 0.36, playing;
    var vol = slider("Volume", 60, function (v) { volume = curve(v); if (playing) playing.audio.volume = volume; });
    root.append(vol.row);
    var status = el("p", { class: "w-note", role: "status", "aria-live": "polite" }, "Loading the list.");
    var list = el("div", { role: "list", style: "display:grid;gap:8px" });
    root.append(list, status);

    function stop() {
      if (!playing) return;
      playing.audio.pause();
      playing.button.textContent = "Play";
      playing.button.setAttribute("aria-label", "Play " + playing.label);
      playing = undefined;
    }
    manifest().then(function (entries) {
      status.textContent = entries.length ? entries.length + " sounds. One plays at a time." : "The audition files are not next to this page, so there is nothing to play here.";
      entries.forEach(function (entry) {
        var row = el("div", { role: "listitem", class: "w-row", style: "border-top:1px solid var(--line);padding-top:8px" });
        var button = el("button", { type: "button", class: "btn secondary", "aria-label": "Play " + entry.label, style: "min-width:72px;min-height:40px" }, "Play");
        button.addEventListener("click", function () {
          var wasThis = playing && playing.button === button;
          stop();
          if (wasThis) return;
          var audio = new Audio(srcOf(entry));
          audio.volume = volume;
          playing = { audio: audio, button: button, label: entry.label };
          button.textContent = "Stop";
          button.setAttribute("aria-label", "Stop " + entry.label);
          audio.addEventListener("ended", function () { if (playing && playing.audio === audio) stop(); });
          audio.play().then(function () { status.textContent = "Playing: " + entry.label; }, function () {
            if (playing && playing.audio === audio) { stop(); status.textContent = "Could not load " + entry.label + "."; }
          });
        });
        var text = el("div", { style: "flex:1 1 220px" });
        text.append(el("div", { style: "font-weight:600" }, entry.action + ": " + entry.label));
        var credit = el("div", { class: "w-note" }, entry.seconds.toFixed(1) + " s. " + entry.author + ", " + entry.licence + ". ");
        if (entry.licenceUrl) credit.append(el("a", { href: entry.licenceUrl, target: "_blank", rel: "noreferrer" }, "Licence"), " ");
        if (entry.modified) credit.append("Changed: " + entry.modified + ". ");
        if (entry.url2) credit.append(el("a", { href: entry.url2, target: "_blank", rel: "noreferrer" }, "Second source"), " ");
        if (entry.url) credit.append(el("a", { href: entry.url, target: "_blank", rel: "noreferrer" }, "Source"));
        text.append(credit);
        row.append(button, text);
        list.append(row);
      });
    });
  };

  /* ------------------------------------------------------------------ mix-lab */
  /* The sound table and the decision are plain data and a pure function, the shape the game would use. */
  var SOUNDS = {
    order:   { label: "Order tick", file: "order-a",   group: "tick", priority: 1, cooldown: 150,  gain: -14, length: 0.5 },
    recruit: { label: "Recruit",    file: "recruit-a", group: "action", priority: 2, cooldown: 1200, gain: -10, length: 0.9 },
    build:   { label: "Build",      file: "build-a",   group: "action", priority: 2, cooldown: 1200, gain: -10, length: 1.1 },
    air:     { label: "Aircraft",   file: "air-a",     group: "action", priority: 3, cooldown: 4000, gain: -9,  length: 2.4 },
    rail:    { label: "Train",      file: "rail-a",    group: "action", priority: 3, cooldown: 4000, gain: -12, length: 2.7 },
    truck:   { label: "Truck",      file: "truck-a",   group: "action", priority: 3, cooldown: 4000, gain: -10, length: 2.2 },
    march:   { label: "Marching",   file: "march-a",   group: "action", priority: 3, cooldown: 4000, gain: -6,  length: 2.0 },
    endTurn: { label: "End turn",   file: "end-a",     group: "event", priority: 5, cooldown: 2000, gain: -6,  length: 2.0 }
  };
  var LIMITS = { coalesceMs: 120, total: 4, perGroup: { tick: 1, action: 2, event: 1 } };
  function dbGain(value) { return Math.pow(10, value / 20); }

  /* events: [{at, kind}] in ms. Returns one line per event: what plays, and why not. */
  function decide(events, limited) {
    var last = {}, seen = {}, voices = [];
    return events.map(function (event) {
      var sound = SOUNDS[event.kind];
      if (!limited) return { at: event.at, kind: event.kind, plays: event.kind, gain: sound.gain, why: "" };
      voices = voices.filter(function (v) { return v.ends > event.at; });
      var lastAt = last[event.kind], seenAt = seen[event.kind];
      seen[event.kind] = event.at;
      if (seenAt !== undefined && event.at - seenAt < LIMITS.coalesceMs) return { at: event.at, kind: event.kind, plays: null, why: "joined with the one before" };
      var kind = event.kind, why = "";
      if (lastAt !== undefined && event.at - lastAt < sound.cooldown) { kind = "order"; why = "heard recently, so a tick instead"; }
      var use = SOUNDS[kind];
      if (kind !== event.kind && last.order !== undefined && event.at - last.order < SOUNDS.order.cooldown) return { at: event.at, kind: event.kind, plays: null, why: "heard recently" };
      var same = voices.filter(function (v) { return v.group === use.group; });
      if (same.length >= LIMITS.perGroup[use.group]) {
        var weakest = same.slice().sort(function (a, b) { return a.priority - b.priority || a.ends - b.ends; })[0];
        if (weakest.priority >= use.priority) {
          if (use.group === "tick") return { at: event.at, kind: event.kind, plays: null, why: "a tick is already playing" };
          return { at: event.at, kind: event.kind, plays: null, why: "two action sounds already playing" };
        }
        voices.splice(voices.indexOf(weakest), 1);
        weakest.line.cutAt = event.at + 60; /* the quieter-ranked sound fades out in 60 ms */
      }
      if (voices.length >= LIMITS.total) return { at: event.at, kind: event.kind, plays: null, why: "four sounds already playing" };
      last[kind] = event.at;
      var line = { at: event.at, kind: event.kind, plays: kind, gain: use.gain, why: why };
      voices.push({ group: use.group, line: line, priority: use.priority, ends: event.at + use.length * 1000 });
      return line;
    });
  }
  function lengthOf(line) { return line.cutAt === undefined ? SOUNDS[line.plays].length * 1000 : line.cutAt - line.at; }
  function stats(lines) {
    var played = lines.filter(function (l) { return l.plays; }), most = 0, peak = 0;
    played.forEach(function (line) {
      var now = played.filter(function (o) { return o.at <= line.at && o.at + lengthOf(o) > line.at; });
      most = Math.max(most, now.length);
      peak = Math.max(peak, now.reduce(function (sum, o) { return sum + dbGain(o.gain) * 0.7; }, 0));
    });
    return { played: played.length, most: most, peak: peak };
  }
  window.M3W_AUDIO_LAB = { decide: decide, stats: stats };

  var BURSTS = {
    group: { label: "Order ten armies at once (all by rail)", events: ["rail", "rail", "rail", "rail", "rail", "rail", "rail", "rail", "rail", "rail"], gap: 60 },
    ticks: { label: "Give ten plain orders quickly", events: ["order", "order", "order", "order", "order", "order", "order", "order", "order", "order"], gap: 90 },
    mixed: { label: "Ten mixed actions in three seconds", events: ["recruit", "recruit", "build", "march", "march", "rail", "truck", "air", "air", "order"], gap: 300 }
  };

  window.M3W["mix-lab"] = function (root) {
    root.append(el("h4", {}, "Mix lab: three volumes, and ten orders at once"));
    root.append(el("p", { class: "w-note" }, "Start with your device volume low. The version without limits is loud on purpose."));
    var levels = { master: 80, music: 60, sfx: 80 };
    var ctx, master, music, sfx, duck, pad, buffers = {}, live = [], timers = [];
    var sum = el("p", { class: "w-note" });
    function effective() {
      var m = curve(levels.master);
      sum.textContent = "Music plays at " + db(m * curve(levels.music)) + ", effects at " + db(m * curve(levels.sfx)) + ". Each slider works on its own; Master multiplies both.";
      if (!ctx) return;
      var t = ctx.currentTime;
      master.gain.setTargetAtTime(m, t, 0.02);
      music.gain.setTargetAtTime(curve(levels.music), t, 0.02);
      sfx.gain.setTargetAtTime(curve(levels.sfx), t, 0.02);
    }
    [["Master", "master"], ["Music", "music"], ["Effects", "sfx"]].forEach(function (pair) {
      root.append(slider(pair[0], levels[pair[1]], function (v) { levels[pair[1]] = v; effective(); }).row);
    });
    root.append(sum);

    var pickId = "m3w-audio-" + (uid += 1);
    var pick = el("select", { id: pickId, style: "max-width:100%;min-height:40px" });
    Object.keys(BURSTS).forEach(function (key) { pick.append(el("option", { value: key }, BURSTS[key].label)); });
    var pickRow = el("div", { class: "w-row" });
    pickRow.append(el("label", { class: "w-label", for: pickId }, "Test"), pick);
    var buttons = el("div", { class: "w-row" });
    var bMusic = el("button", { type: "button", class: "btn secondary", "aria-pressed": "false" }, "Start music");
    var bRaw = el("button", { type: "button", class: "btn secondary" }, "Trigger 10 orders: no limits");
    var bLim = el("button", { type: "button", class: "btn" }, "Trigger 10 orders: with the rules");
    var bEnd = el("button", { type: "button", class: "btn secondary" }, "End turn (ducks the music)");
    buttons.append(bMusic, bRaw, bLim, bEnd);
    var chart = el("div", {});
    var result = el("p", { class: "w-note", role: "status", "aria-live": "polite" });
    root.append(pickRow, buttons, chart, result);

    function ready() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { result.textContent = "This browser has no Web Audio, so only the picture works."; return Promise.resolve(false); }
        ctx = new AC();
        master = ctx.createGain(); music = ctx.createGain(); sfx = ctx.createGain(); duck = ctx.createGain();
        music.connect(duck); duck.connect(master); sfx.connect(master); master.connect(ctx.destination);
        master.gain.value = 0; music.gain.value = curve(levels.music); sfx.gain.value = curve(levels.sfx);
        effective();
        manifest().then(function (entries) {
          entries.forEach(function (entry) {
            var src = srcOf(entry), data = /^data:[^,]*;base64,/.exec(src), bytes;
            if (data) {
              var bin = atob(src.slice(data[0].length)), array = new Uint8Array(bin.length);
              for (var i = 0; i < bin.length; i += 1) array[i] = bin.charCodeAt(i);
              bytes = Promise.resolve(array.buffer);
            } else bytes = fetch(src).then(function (r) { if (!r.ok) throw new Error("missing"); return r.arrayBuffer(); });
            bytes.then(function (b) { return ctx.decodeAudioData(b); }).then(function (buffer) { buffers[entry.id] = buffer; }).catch(function () { /* the tone stands in */ });
          });
        });
      }
      return ctx.resume().then(function () { return true; }, function () { return false; });
    }
    var TONES = { order: [880, "square", 0.08], recruit: [196, "triangle", 0.5], build: [1320, "triangle", 0.5], air: [92, "sawtooth", 2.2], rail: [622, "sine", 1.6], truck: [58, "sawtooth", 2.0], march: [110, "square", 0.18], endTurn: [55, "triangle", 1.9] };
    function start(kind, gainDb, maxMs) {
      var t = ctx.currentTime, sound = SOUNDS[kind], gain = ctx.createGain(), source, length;
      var buffer = buffers[sound.file];
      if (buffer) {
        source = ctx.createBufferSource(); source.buffer = buffer; length = buffer.duration;
        source.playbackRate.value = 0.97 + Math.random() * 0.06;
      } else {
        var tone = TONES[kind];
        source = ctx.createOscillator(); source.type = tone[1]; source.frequency.value = tone[0] * (0.97 + Math.random() * 0.06); length = tone[2];
      }
      if (maxMs !== undefined) length = Math.min(length, maxMs / 1000);
      var level = dbGain(gainDb) * (buffer ? 1 : 0.5);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(level, t + 0.006);
      gain.gain.setValueAtTime(level, t + Math.max(0.01, length - 0.06));
      gain.gain.linearRampToValueAtTime(0.0001, t + length);
      source.connect(gain); gain.connect(sfx);
      source.start(t); source.stop(t + length + 0.02);
      live.push({ gain: gain, source: source, ends: t + length });
    }
    function silence() {
      timers.forEach(clearTimeout); timers = [];
      var t = ctx ? ctx.currentTime : 0;
      live.forEach(function (v) {
        if (v.ends < t) return;
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setTargetAtTime(0, t, 0.02);
        try { v.source.stop(t + 0.1); } catch (e) { /* already stopped */ }
      });
      live = [];
    }
    function duckMusic() {
      var t = ctx.currentTime;
      duck.gain.cancelScheduledValues(t);
      duck.gain.setTargetAtTime(0.4, t, 0.06);
      duck.gain.setTargetAtTime(1, t + 1.8, 0.5);
    }
    function draw(lines) {
      var total = Math.max.apply(null, lines.map(function (l) { return l.at + (l.plays ? lengthOf(l) : 0); })) + 100;
      var h = lines.length * 18 + 6, ns = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", "0 0 600 " + h); svg.setAttribute("role", "img"); svg.setAttribute("width", "100%");
      svg.setAttribute("aria-label", "Timeline of ten actions. Filled bars are sounds that play; outlined dots are actions that stay silent.");
      lines.forEach(function (line, i) {
        var x = 96 + line.at / total * 496, y = i * 18 + 4;
        var label = document.createElementNS(ns, "text");
        label.setAttribute("x", "0"); label.setAttribute("y", String(y + 11)); label.setAttribute("font-size", "12"); label.setAttribute("fill", "var(--ink)");
        label.textContent = SOUNDS[line.kind].label;
        svg.append(label);
        if (line.plays) {
          var bar = document.createElementNS(ns, "rect");
          bar.setAttribute("x", String(x)); bar.setAttribute("y", String(y)); bar.setAttribute("height", "13"); bar.setAttribute("rx", "2");
          bar.setAttribute("width", String(Math.max(4, lengthOf(line) / total * 496)));
          bar.setAttribute("fill", "var(--accent)"); if (line.plays !== line.kind) bar.setAttribute("opacity", "0.55");
          svg.append(bar);
        } else {
          var dot = document.createElementNS(ns, "circle");
          dot.setAttribute("cx", String(x + 4)); dot.setAttribute("cy", String(y + 7)); dot.setAttribute("r", "4");
          dot.setAttribute("fill", "none"); dot.setAttribute("stroke", "var(--line)"); dot.setAttribute("stroke-width", "2");
          var why = document.createElementNS(ns, "text");
          why.setAttribute("x", String(x + 14)); why.setAttribute("y", String(y + 11)); why.setAttribute("font-size", "11"); why.setAttribute("fill", "var(--ink-soft, var(--ink))");
          why.textContent = line.why;
          svg.append(dot, why);
          if (x > 420) { why.setAttribute("x", String(x - 8)); why.setAttribute("text-anchor", "end"); }
        }
      });
      chart.replaceChildren(svg);
    }
    function run(limited) {
      var burst = BURSTS[pick.value];
      var lines = decide(burst.events.map(function (kind, i) { return { at: i * burst.gap, kind: kind }; }), limited);
      var s = stats(lines), loud = 20 * Math.log10(s.peak);
      draw(lines);
      result.textContent = s.played + " of " + lines.length + " sounds play, at most " + s.most + " together. Estimated worst peak " + (loud > 0 ? "+" : "") + loud.toFixed(0) + " dB at full volume" + (loud > 0 ? ", which clips and crackles." : ", below clipping.");
      ready().then(function (ok) {
        if (!ok) return;
        silence();
        lines.forEach(function (line) { if (line.plays) timers.push(setTimeout(function () { start(line.plays, line.gain, line.cutAt === undefined ? undefined : lengthOf(line)); }, line.at)); });
      });
    }
    bRaw.addEventListener("click", function () { run(false); });
    bLim.addEventListener("click", function () { run(true); });
    bEnd.addEventListener("click", function () { ready().then(function (ok) { if (ok) { silence(); start("endTurn", SOUNDS.endTurn.gain); duckMusic(); result.textContent = "End turn plays once and the music dips by 8 dB for about two seconds."; } }); });
    bMusic.addEventListener("click", function () {
      ready().then(function (ok) {
        if (!ok) return;
        if (pad) {
          pad.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
          pad.voices.forEach(function (v) { v.stop(ctx.currentTime + 1); });
          pad = undefined; bMusic.textContent = "Start music"; bMusic.setAttribute("aria-pressed", "false");
          return;
        }
        var gain = ctx.createGain(); gain.gain.value = 0; gain.connect(music);
        var voices = [110, 164.8, 220, 277.2].map(function (f, i) {
          var o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; o.detune.value = i * 3 - 4; o.connect(gain); o.start(); return o;
        });
        gain.gain.setTargetAtTime(0.09, ctx.currentTime, 0.8);
        pad = { gain: gain, voices: voices }; bMusic.textContent = "Stop music"; bMusic.setAttribute("aria-pressed", "true");
      });
    });
    effective();
    run0();
    function run0() {
      var burst = BURSTS.group;
      draw(decide(burst.events.map(function (kind, i) { return { at: i * burst.gap, kind: kind }; }), true));
      result.textContent = "Shown: ten rail orders with the rules on. Press a button to hear it.";
    }
  };
})();
