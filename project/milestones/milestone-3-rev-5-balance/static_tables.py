"""Rev 5 static tables from scenario data (review tooling, not game code): no games are played.

    python3 static_tables.py [scenario.json]
"""
import json, math, sys, collections
S = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "src/scenarios/spanish-civil-war-1936/scenario.json"))
U = {u["id"]: u for u in S["unitTypes"]}
T = S["d20"]["table"]; G = {g["id"]: g for g in S["d20"]["grades"]}
MP = 1  # Manpower is counted as 1 Fund unless said otherwise


def cost(t):
    c = t.get("recruit", {}).get("cost", {})
    return c.get("funds", 0), c.get("manpower", 0)


def eff(t, kind):
    return [e for e in t.get("effects", []) if e["@type"] == kind]


def col(att, dfn):
    if att >= dfn:
        r = att // dfn
        return min(r, 6), max(0, r - 6) * 3, 0
    a = math.ceil(dfn / att); h = 0
    while 2 ** (h + 1) <= a: h += 1
    return 0, 0, -3 * h


def odds(att, dfn, mod=0):
    c, over, half = col(att, dfn); m = mod + over + half
    take = loss_a = loss_d = 0
    for die in range(1, 21):
        g = G[T[c][min(20, max(0, die + m))]]
        take += g["ground"] == "all"
        loss_a += g["attacker"]["lossPercent"]; loss_d += g["defender"]["lossPercent"]
    return 100 * take / 20, loss_a / 20, loss_d / 20


print("## 1. Price per roll point (attack side)")
print("| Source | Roll | Funds | Manpower | Funds per +1 |\n|---|---|---|---|---|")
for t in U.values():
    f, m = cost(t); fn = t["name"]
    for e in eff(t, "battle-support"): print(f"| {fn} on Ground Support (unopposed, max 2) | +{e['@data']['roll']} | {f} | {m} | {f/e['@data']['roll']:.1f} |")
    for e in eff(t, "roll-bonus-per-points"):
        d = e["@data"]
        if d["role"] == "attack":
            n = math.ceil(d["per"] / t["attack"]); print(f"| {fn} (first +1 takes {n}) | +{d['bonus']} (max {d['max']}) | {f*n} | {m*n} | {f*n/d['bonus']:.1f} |")
for b in S["buildings"]:
    for e in [e for e in b.get("effects", []) if e["@type"] == "defence-roll"]:
        print(f"| {b['name']} (defence) | -{e['@data']['roll']} to the attacker | {b['cost'].get('funds',0)} | {b['cost'].get('manpower',0)} | {b['cost'].get('funds',0)/e['@data']['roll']:.1f} |")
print("Dig in: -2 a pip to the attacker, free, one pip a turn, at most", S["combat"]["diggingIn"]["max"], "pips.")
print("One odds column is worth 3 points. Doubling attack 20 (5 infantry, 25 Funds) moves 1:1 to 2:1; a fighter's +3 does the same for 6 Funds.")

print("\n## 2. Exact odds: chance to take the whole territory, by ratio and modifier")
mods = [-10, -6, -3, 0, 3, 6]
print("| Ratio | " + " | ".join(f"{m:+d}" for m in mods) + " |\n|---|" + "---|" * len(mods))
prev = None
for r10 in (10, 12, 15, 19, 20, 25, 29, 30, 40, 50, 60):
    a, d = r10, 10
    print(f"| {r10/10:.1f}:1 | " + " | ".join(f"{odds(a, d, m)[0]:.0f}%" for m in mods) + " |")
print("Cliffs at +0: 1.9:1 and 1.0:1 are the same column; 2.0:1 steps up a column.")

print("\n## 3. Dominance: combat value per Fund (Manpower counted as 1) and per upkeep point")
print("| Unit | Attack/Defence | Funds+Manpower | Attack per Fund | Attack per upkeep | Men per recruit | Training |\n|---|---|---|---|---|---|---|")
rows = []
for t in U.values():
    if t["kind"] != "ground" or t["attack"] == 0 or "recruit" not in t: continue
    f, m = cost(t); up = t["upkeep"].get("manpower", 0) or 0.001
    rows.append((t["name"], t["attack"], t["defence"], f, m, t["attack"] / (f + m * MP), t["attack"] / up, t["recruit"]["establishment"], t["recruit"]["trainingTurns"], t["recruit"].get("factionIds", [])))
for n, a, d, f, m, pf, pu, est, tr, fac in sorted(rows, key=lambda r: -r[5]):
    print(f"| {n}{' (' + '/'.join(fac) + ' only)' if fac else ''} | {a}/{d} | {f}+{m} | {pf:.2f} | {pu:.1f} | {est} | {tr} |")
for x in rows:
    for y in rows:
        if x is y: continue
        if y[1] >= x[1] and y[2] >= x[2] and y[3] + y[4] <= x[3] + x[4] and y[6] >= x[6] and (y[1], y[2]) != (x[1], x[2]):
            print(f"- {y[0]} dominates {x[0]} (at least as strong, no dearer, no more upkeep)")

print("\n## 4. Start and reach: whole territories, shared territories, cities")
own = collections.Counter(); part = collections.Counter(); cities = collections.Counter()
for t in S["territories"]:
    c = t["initialControl"]
    if c["@type"] == "controlled": own[c["@data"]["factionId"]] += 1
    else:
        for f in c["@data"]["factionIds"]: part[f] += 1
subs = {s["id"]: s for s in S["subTerritories"]}
for c in S["cities"]: cities[subs[c["subTerritoryId"]]["startHolder"]] += 1
for f in S["factions"]:
    i = f["id"]; print(f"- {f['name']}: {own[i]} whole, {part[i]} shared, {cities[i]} cities; needs {10-own[i]} more territories for 10, {12-own[i]} for 12, {19-cities[i]} cities for 19")

print("\n## 5. Economy: opening income if every shared territory counted, and paybacks")
y = {d["id"]: (d["resource"], d["yieldPerLevel"], d["upgrade"]) for d in S["development"]}
inc = collections.defaultdict(collections.Counter)
for s in S["subTerritories"]:
    for k, v in (s.get("development") or {}).items(): inc[s["territoryId"]][y[k][0]] += v * y[k][1]
for d in S["development"]:
    c = d["upgrade"]["cost"]; per = d["yieldPerLevel"]; print(f"- {d['name']}: {c}, {d['upgrade']['turns']} turns, +{per} {d['resource']} a level: pays back in {d['upgrade']['turns'] + c.get('funds',0)/per:.0f} turns in Funds terms")
for t in U.values():
    if t.get("upkeep") and t["kind"] == "ground": print(f"- {t['name']}: upkeep {t['upkeep'].get('manpower',0)} Manpower a turn, {cost(t)[1]} Manpower to raise")

print("\n## 6. Denial: what one contested territory costs its owner a turn, with its opening garrison")
hold = collections.Counter(); dfn = collections.Counter(); usz = {}
for u in S["units"]:
    hold[u["territoryId"]] += 1; dfn[u["territoryId"]] += U[u["type"]]["defence"] * u["strength"] / u["fullStrength"]
print("| Territory | Funds | Manpower | Provinces | Opening defence value |\n|---|---|---|---|---|")
for t in sorted(S["territories"], key=lambda t: -(inc[t["id"]]["funds"] + inc[t["id"]]["manpower"])):
    i = inc[t["id"]]; n = sum(s["territoryId"] == t["id"] for s in S["subTerritories"])
    if i["funds"] + i["manpower"] > 0: print(f"| {t['name']} | {i['funds']:.1f} | {i['manpower']:.1f} | {n} | {dfn[t['id']]:.0f} |")
