"""Rev 5 goals table from recorded simulator runs (review tooling, not game code).

    python3 goals.py RUN_DIR [RUN_DIR ...]      # each with games.jsonl from --record inventory

Prints one row per variant: seats, length, late lead, economy, arms and winter 1937.
"""
import collections, gzip, json, math, os, statistics as st, sys

ARMS = {
    "foot": ("infantry-regiment", "militia-column", "colonial-veterans", "security-forces", "cavalry-regiment"),
    "guns": ("artillery-group",),
    "tanks": ("tank-company",),
    "air": ("fighter-squadron", "bomber-squadron"),
}
DEV = ("development:farms", "development:mines", "development:factory")
WINTER_1937 = 12  # turn 1 is late July 1936; turn 12 is early January 1937


def wilson(k, n, z=1.96):
    if n == 0:
        return "n/a"
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / 2 / n) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / 4 / n / n) / d
    return f"{100*p:.1f}% [{100*(c-h):.0f}-{100*(c+h):.0f}]"


def lines(path):
    f = os.path.join(path, "games.jsonl")
    if os.path.exists(f):
        return [json.loads(x) for x in open(f)]
    return [json.loads(x) for x in gzip.open(f + ".gz", "rt")]


def streak(g, winner):
    t = {s: [r[0] for r in v["counts"]] for s, v in g["inventory"]["sides"].items()}
    k = 0
    for i in range(len(t[winner]) - 2, -1, -1):
        if all(t[winner][i] > t[s][i] for s in t if s != winner):
            k += 1
        else:
            break
    return k


def report(name, games):
    col = games[0]["inventory"]["columns"]
    u = {x: i for i, x in enumerate(col["unitTypes"])}
    p = {x: i for i, x in enumerate(col["projects"])}
    n = len(games)
    dec = [g for g in games if g["end"] == "decided"]
    wins = collections.Counter(g["winners"][0] for g in dec)
    turns = [g["turns"] for g in games]
    print(f"\n{name}: {n} games, {n-len(dec)} undecided")
    print("  seats  ", " | ".join(f"{s} {wilson(wins[s], n)}" for s in games[0]["inventory"]["sides"]))
    print(f"  length  median {st.median(turns)}; in 20-30 {wilson(sum(20<=t<=30 for t in turns), n)}; by turn 8 {wilson(sum(t<=8 for t in turns), n)}; won before turn 4 {wilson(sum(t<4 for t in turns), n)}; reach winter 1937 {wilson(sum(t>=WINTER_1937 for t in turns), n)}")
    k = [streak(g, g["winners"][0]) for g in dec]
    print(f"  lead    median {st.median(k) if k else 'n/a'} turns alone before winning; under 2 in {wilson(sum(x<2 for x in k), len(k))}")
    conds = collections.Counter(g["victory"] for g in dec)
    print(f"  won by  {dict(conds)}")
    dev, builds, arms3, top, mix = [], [], 0, [], collections.Counter()
    shares = []
    for g in dec:
        side = g["inventory"]["sides"][g["winners"][0]]
        dev.append(sum(r[p[x]] for r in side["buildsOrdered"] for x in DEV))
        builds.append(sum(sum(r) for r in side["buildsOrdered"]))
        tot = {a: sum(r[u[x]] for r in side["recruitsOrdered"] for x in ids) for a, ids in ARMS.items()}
        s = sum(tot.values())
        if s:
            shares.append({a: v / s for a, v in tot.items()})
            arms3 += sum(v / s >= 0.10 for v in tot.values()) >= 3
        mix.update({a: v for a, v in tot.items()})
    print(f"  economy winner's development orders median {st.median(dev)}; no development {wilson(sum(x==0 for x in dev), len(dec))}; no builds {wilson(sum(x==0 for x in builds), len(dec))}")
    total = sum(mix.values()) or 1
    print(f"  arms    3+ arms at 10% of combat recruits {wilson(arms3, len(dec))}; winners' mix " + ", ".join(f"{a} {100*v/total:.0f}%" for a, v in mix.items()))


if __name__ == "__main__":
    for path in sys.argv[1:]:
        by = collections.defaultdict(list)
        for g in lines(path):
            by[g["variant"]].append(g)
        for v, gs in by.items():
            report(f"{os.path.basename(path.rstrip('/'))} / {v}", gs)
