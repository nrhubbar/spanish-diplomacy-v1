import gzip, json
# Share of each side's turns with a large stock, and how often its upkeep went unpaid, over every game turn (turn 0 left out).
games = [json.loads(line) for line in gzip.open("games.jsonl.gz", "rt")]
rows = []
for side in ("republic", "north", "south"):
    turns = funds = manpower = unpaid_turns = unpaid_games = 0
    for game in games:
        data = game["inventory"]["sides"][side]
        short = [row[1] for row in data["unpaid"][1:]]
        turns += len(data["held"]) - 1
        funds += sum(row[0] >= 20 for row in data["held"][1:])
        manpower += sum(row[1] >= 20 for row in data["held"][1:])
        unpaid_turns += sum(value > 0 for value in short)
        unpaid_games += any(value > 0 for value in short)
    rows.append({"side": side, "turns": turns, "funds20": round(100 * funds / turns), "manpower20": round(100 * manpower / turns), "unpaidTurns": unpaid_turns, "unpaidGames": unpaid_games})
json.dump({"rows": rows, "meta": [{"label": "extras.py", "value": open("extras.py").read(), "type": "code", "lang": "python"}, {"label": "Input", "value": "games.jsonl.gz from the 200-game run"}]}, open("extras.json", "w"))
print(rows)
