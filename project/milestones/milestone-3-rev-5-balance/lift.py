"""Lift of each lineup's persona over the same seat in the baseline (review tooling, not game code).

    python3 lift.py RUN_DIR [BASE_RUN_DIR]
Each cell must seat one persona; the baseline cell (or BASE_RUN_DIR) gives each seat's normal rate.
"""
import collections, json, math, sys
run = sys.argv[1]; base = sys.argv[2] if len(sys.argv) > 2 else run
load = lambda d: [json.loads(x) for x in open(d + "/games.jsonl")]
cells = collections.defaultdict(list)
for g in load(run): cells[g["variant"]].append(g)
b = collections.defaultdict(list)
for g in load(base): b[g["variant"]].append(g)
bg = b["baseline"]; bn = len(bg)
rate = lambda gs, s: sum(g["winners"][0] == s for g in gs if g["end"] == "decided") / len(gs)
norm = {s: rate(bg, s) for s in bg[0]["inventory"]["sides"]} if "inventory" in bg[0] else {s: rate(bg, s) for s in ("republic", "north", "south")}
print("normal:", {s: f"{100*v:.1f}%" for s, v in norm.items()}, f"({bn} games)")
print("| Lineup | Seat rate | Normal | Lift | +-95% | Games |\n|---|---|---|---|---|---|")
for v, gs in cells.items():
    if v == "baseline": continue
    for seat in norm:
        if f"{seat}-" not in v: continue
        r = rate(gs, seat); n = len(gs); se = math.sqrt(r * (1 - r) / n + norm[seat] * (1 - norm[seat]) / bn)
        flag = " FLAG" if r - norm[seat] > 0.05 else ""
        print(f"| {v} | {100*r:.1f}% | {100*norm[seat]:.1f}% | {100*(r-norm[seat]):+.1f} | {196*se:.1f} | {n} |{flag}")
