"""Writes Round 2 variant files: win target x South Manpower at Republic Funds 30, plus no-build seats (review tooling).

South starting Manpower was approved by the owner after Round 1 (see owner-answers.md); no other side's is.
"""
import json, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "variants")
SHARE = {10: None, 12: 0.66}
def patch(target, funds, south_mp, seat=None):
    p = [{"op": "replace", "path": "/victory/territoryShare", "value": SHARE[target]}] if SHARE[target] else []
    for i, (f, v) in enumerate(zip(("republic", "north", "south"), funds)):
        p += [{"op": "test", "path": f"/factions/{i}/id", "value": f}, {"op": "replace", "path": f"/factions/{i}/startingStock/funds", "value": v}]
    p += [{"op": "replace", "path": "/factions/2/startingStock/manpower", "value": south_mp}]
    if seat: p += [{"op": "add", "path": f"/ai/seats/{seat[0]}", "value": seat[1]}]
    return p
def write(folder, name, desc, p):
    os.makedirs(f"{D}/{folder}", exist_ok=True)
    json.dump({"name": name, "description": desc, "patch": p}, open(f"{D}/{folder}/{name}.json", "w"), indent=1)
for t in (10, 12):
    for mp in (5, 10, 15, 20):
        write("round2", f"t{t}-mp{mp}", f"{t} territories; Funds (30, 15, 15); South Manpower {mp}", patch(t, (30, 15, 15), mp))
    write("round2", f"t{t}-mp15-f35", f"{t} territories; Funds (30, 15, 35); South Manpower 15", patch(t, (30, 15, 35), 15))
    for s in ("republic", "north", "south"):
        write("nobuild", f"t{t}-{s}-no-build", f"{t} territories; Funds (30, 15, 15); {s} never builds", patch(t, (30, 15, 15), 5, (s, "no-build")))
