"""Least-squares fit of seat win share over Round 1's win-target and starting-Funds cells (review tooling, not game code).

    python3 fit_money.py RUN_DIR
"""
import json, math, sys
FUNDS = {"m0": (40, 15, 15), "m1": (30, 25, 25), "m2": (30, 35, 35), "m3": (25, 25, 35), "m4": (25, 35, 35), "m5": (40, 35, 35)}
def cell(v):
    if v == "baseline": return (10, 40, 15, 15)
    return (int(v[1:3]), *FUNDS[v[4:]])
def row(t, r, n, s): return [1, t == 11, t == 12, (r - 30) / 10, (n - 25) / 10, (s - 25) / 10]
def inv(m):
    k = len(m); a = [list(map(float, r)) + [float(i == j) for j in range(k)] for i, r in enumerate(m)]
    for i in range(k):
        p = max(range(i, k), key=lambda q: abs(a[q][i])); a[i], a[p] = a[p], a[i]
        d = a[i][i]; a[i] = [x / d for x in a[i]]
        for q in range(k):
            if q != i: f = a[q][i]; a[q] = [x - f * y for x, y in zip(a[q], a[i])]
    return [r[k:] for r in a]
gs = [json.loads(x) for x in open(sys.argv[1] + "/games.jsonl")]
X = [row(*cell(g["variant"])) for g in gs]; k = len(X[0])
V = inv([[sum(x[i] * x[j] for x in X) for j in range(k)] for i in range(k)])
B = {}
print("terms: t10 at 30/25/25 | t11 | t12 | Republic +10 | North +10 | South +10")
for s in ("republic", "north", "south"):
    y = [100.0 * (g["end"] == "decided" and g["winners"][0] == s) for g in gs]
    xy = [sum(x[i] * v for x, v in zip(X, y)) for i in range(k)]
    b = B[s] = [sum(V[i][j] * xy[j] for j in range(k)) for i in range(k)]
    var = sum((v - sum(p * q for p, q in zip(x, b))) ** 2 for x, v in zip(X, y)) / (len(y) - k)
    print(f"{s:9}", " | ".join(f"{c:+.1f} ±{1.96*math.sqrt(var*V[i][i]):.1f}" for i, c in enumerate(b)))
print("\npredicted vs seen")
seen = {}
for g in gs: seen.setdefault(g["variant"], []).append(g["winners"][0] if g["end"] == "decided" else None)
for v, w in seen.items():
    print(f"{v:9}", " | ".join(f"{s} {sum(p*q for p,q in zip(row(*cell(v)),B[s])):.0f} ({100*w.count(s)/len(w):.0f})" for s in B))
