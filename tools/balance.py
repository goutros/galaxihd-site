#!/usr/bin/env python3
"""tools/balance.py: the math half of the balance pipeline.

tools/train.js plays the real fight engine with two player AIs (the best it can learn, and a casual player: the same AI with human
reaction time, slips and sloppy FIGHT timing) and writes tools/measurements.json: what every attack costs you at a range of Galaxi's
speeds, and what every meta event does. This turns those numbers into whole fights.

The fight is a Markov chain over (Galaxi's turn in his rotation, has he looped, your HP, his HP, which items you still have), so the
win rate is computed EXACTLY by pushing probability mass through it turn by turn: that's the number a million years (or forever) of
simulated fights converges to. A Monte Carlo of real sampled fights checks the math, and --years N draws N years' worth of fights from
the exact odds (fights are independent, so that's a single binomial draw: it shows what that much play would actually record).

Galaxi learns: each attack runs as fast as it can while the best player still goes hitless (the hardest it can be and stay fair),
then his HP and the damage scale are searched for a casual player winning ~5% of fights. The player learns too: its item rule (heal
at or below this HP) is optimised for every setting Galaxi tries. The result goes into boss.js (hp, damageScale, each turn's speed).

    python3 tools/balance.py                 # tune, verify, write boss.js
    python3 tools/balance.py --dry-run       # tune and report only
    python3 tools/balance.py --years 1000000
"""
import argparse, json, math, re
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MAXHP, ITEMS = 20, [10, 15, 20]              # your HP (UNDERTALE LV1) and your items' heals (boss.js items)
PLAYER_ATTACK, TIRED = 22, .85               # boss.js playerAttack; tired: his pace once he's looped his attacks
ROUND_MENU_SEC = 4.0                         # a player turn's menus, roughly
# events: boss.js runs 3-4 a fight; over a typical ~11-turn fight that's a .3 chance on any of his turns (Model p_event)
TARGET_CASUAL = .05


def fight_damage(aim_sd):
    """FIGHT damage distribution (battle.js strike): the cursor stops |e| px off centre, acc = 1 - |e|/280, under .05 is a miss.
    aim_sd: how far off a player stops it (0 = perfect). Returns [(damage, prob)]."""
    if aim_sd <= 0:
        return [(round(PLAYER_ATTACK * 1.4), 1.0)]
    e = np.abs(np.random.default_rng(1).normal(0, aim_sd, 200_000))
    acc = 1 - e / 280
    dmg = np.where(acc < .05, 0, np.maximum(1, np.round(PLAYER_ATTACK * (.4 + acc)))).astype(int)
    vals, counts = np.unique(dmg, return_counts=True)
    return list(zip(vals.tolist(), (counts / counts.sum()).tolist()))


def foe_up(a, n, hp):
    """his HP up by n (capped at hp) along axis 1"""
    out = np.zeros_like(a)
    out[:, 1 + n:hp + 1] += a[:, 1:hp + 1 - n]
    out[:, hp] += a[:, max(1, hp + 1 - n):hp + 1].sum(axis=1)
    return out


class Model:
    def __init__(self, data, who, aim_sd, p_event=.3):
        self.data, self.who, self.fight, self.p_event, self.cache = data, who, fight_damage(aim_sd), p_event, {}
        self.turns, self.speeds = data["turns"], [float(s) for s in data["speeds"]]

    def runs(self, i, speed):
        """the measured runs of turn i at the grid speed nearest `speed`"""
        sp = min(self.speeds, key=lambda s: abs(s - speed))
        table = self.data["attacks"][self.who][i]
        return table.get(str(sp)) or table.get(repr(sp)) or table[next(k for k in table if abs(float(k) - sp) < 1e-9)]

    def outcomes(self, i, speed, k, loop):
        """enemy turn i's outcomes: [(prob, lost, healed, foe_heal, takes_item)] (events mixed in at their per-turn rate)"""
        out = {}
        def add(p, hits, healed, foe_heal, item):
            lost = sum(max(1, round(d * k)) for d in hits)
            key = (lost, healed, foe_heal, item); out[key] = out.get(key, 0) + p
        runs = self.runs(i, speed * (TIRED if loop else 1))
        ev = [(n, e) for n, e in self.data["events"][self.who].items() if e["turn"] is not None]
        pe = self.p_event if ev else 0
        for hits, healed, _ in runs:  # an attack run: [hits (damage each), healed, seconds]
            add((1 - pe) / len(runs), hits, healed, 0, False)
        for name, e in ev:             # an event run: [hits, healed, his heal, your items lost, seconds]
            for hits, healed, foe_heal, items_lost, _ in e["runs"]:
                add(pe / len(ev) / len(e["runs"]), hits, healed, 0 if name == "confiscate" else foe_heal, name == "confiscate" and items_lost > 0)
        return [(p, *key) for key, p in out.items()]

    def solve(self, speeds, k, hp, thr, max_rounds=400):
        """exact: P(win), P(lose), expected seconds. thr: you heal (best item first) at or below this HP, else FIGHT.
        mass[(t, loop)]: probability over (your HP 0..20, his HP 0..hp, item mask 0..7), before his turn t"""
        T = len(self.turns)
        mass = {(t, l): np.zeros((MAXHP + 1, hp + 1, 8)) for t in range(T) for l in (0, 1)}
        mass[(0, 0)][MAXHP, hp, 7] = 1.0
        win = lose = secs = 0.0
        heal_rows = [(h, mask, max((j for j in range(3) if mask >> j & 1), key=lambda j: ITEMS[j])) for h in range(1, thr + 1) for mask in range(1, 8)]
        for _ in range(max_rounds):
            if sum(m.sum() for m in mass.values()) < 1e-12:
                break
            nxt = {key: np.zeros_like(m) for key, m in mass.items()}
            for (t, l), m in mass.items():
                tot = m.sum()
                if tot < 1e-15:
                    continue
                key = (t, l, k, speeds[t])
                if key not in self.cache:
                    runs = self.runs(t, speeds[t] * (TIRED if l else 1))
                    self.cache[key] = (self.outcomes(t, speeds[t], k, l), np.mean([r[2] for r in runs]))
                outs, sec = self.cache[key]
                secs += tot * (sec + ROUND_MENU_SEC)
                # --- Galaxi's turn
                after = np.zeros_like(m)
                for p, lost, healed, foe_heal, item in outs:
                    lost = min(lost, MAXHP)
                    lose += p * m[1:lost + 1].sum()
                    part = np.zeros_like(m)
                    if lost < MAXHP:
                        np.add.at(part, np.minimum(MAXHP, np.arange(lost + 1, MAXHP + 1) - lost + healed), m[lost + 1:])
                    if foe_heal:
                        part = foe_up(part, foe_heal, hp)
                    if item:  # confiscate: he eats one of your items (each as likely) and heals by it
                        eaten = np.zeros_like(part); eaten[:, :, 0] = part[:, :, 0]
                        for mask in range(1, 8):
                            have = [j for j in range(3) if mask >> j & 1]
                            for j in have:
                                eaten[:, :, mask & ~(1 << j)] += foe_up(part[:, :, mask], ITEMS[j], hp) / len(have)
                        part = eaten
                    after += p * part
                # --- your turn: heal at or below thr (best item first), else FIGHT
                t2, l2 = (t + 1) % T, 1 if (l or t + 1 == T) else 0
                out = nxt[(t2, l2)]
                for h, mask, j in heal_rows:
                    out[min(MAXHP, h + ITEMS[j]), :, mask & ~(1 << j)] += after[h, :, mask]
                    after[h, :, mask] = 0
                for dmg, p in self.fight:
                    if dmg >= 1:
                        win += p * after[:, 1:dmg + 1].sum()
                        out[:, 1:max(1, hp + 1 - dmg)] += p * after[:, dmg + 1:]
                    else:
                        out += p * after
            mass = nxt
        return win, lose, secs

    def best_rule(self, speeds, k, hp):
        """the player learns: the heal-at HP that wins most"""
        return max(((self.solve(speeds, k, hp, thr), thr) for thr in (0, 4, 6, 8, 10)), key=lambda x: x[0][0])


def monte_carlo(model, speeds, k, hp, thr, n, seed=7):
    """n real sampled fights through the same rules (checks the exact math)"""
    rng, T, wins = np.random.default_rng(seed), len(model.turns), 0
    outs = {(t, l): model.outcomes(t, speeds[t], k, l) for t in range(T) for l in (0, 1)}
    fd, fp = np.array([d for d, _ in model.fight]), np.array([p for _, p in model.fight])
    for _ in range(n):
        php, fhp, items, t, l = MAXHP, hp, [True] * 3, 0, 0
        while True:
            o = outs[(t, l)]; p, lost, healed, foe_heal, item = o[rng.choice(len(o), p=np.array([x[0] for x in o]) / sum(x[0] for x in o))]
            if lost >= php:
                break
            php = min(MAXHP, php - lost + healed); fhp = min(hp, fhp + foe_heal)
            if item and any(items):
                j = rng.choice([j for j in range(3) if items[j]]); items[j] = False; fhp = min(hp, fhp + ITEMS[j])
            t, l = (t + 1) % T, 1 if (l or t + 1 == T) else 0
            if php <= thr and any(items):
                j = max((j for j in range(3) if items[j]), key=lambda j: ITEMS[j]); items[j] = False; php = min(MAXHP, php + ITEMS[j])
                continue
            fhp -= fd[rng.choice(len(fd), p=fp)]
            if fhp <= 0:
                wins += 1; break
    return wins / n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / "tools/measurements.json"))
    ap.add_argument("--years", type=float, default=1_000_000)
    ap.add_argument("--mc", type=int, default=20000)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--casual-aim", type=float, default=70, help="how far off (px, std dev) a casual player stops the FIGHT cursor")
    a = ap.parse_args()
    data = json.loads(Path(a.data).read_text())
    best, casual = Model(data, "best", 0), Model(data, "casual", a.casual_aim)
    T = len(data["turns"])

    # Galaxi, part 1: every attack as fast as it can go before it measurably hurts the best player more than it does now (the
    # hardest it can be and stay as fair as it is today). The ideal rule is "the fastest speed the best player still takes with no
    # hits", but the best AI isn't hitless everywhere yet: those attacks are listed (not machine-verified hitless)
    lost = lambda i, sp: np.mean([sum(h) for h, _, _ in best.runs(i, sp)])
    speeds, unverified = [], []
    for i, name in enumerate(data["turns"]):
        base = lost(i, 1.0)
        speeds.append(max(s for s in best.speeds if s >= 1 and lost(i, s) <= base + .5))
        if not any(all(not h for h, _, _ in best.runs(i, s)) for s in best.speeds):
            unverified.append(name)

    # Galaxi, part 2: HP and damage scale for a ~5% casual win rate (the player re-learns its heal rule for every candidate)
    best_fit = None
    for k in (1, 1.25, 1.5, 2, 2.5, 3):
        for hp in range(100, 401, 20):
            (w, l, s), thr = casual.best_rule(speeds, k, hp)
            score = abs(w - TARGET_CASUAL)
            if best_fit is None or score < best_fit[0]:
                best_fit = (score, k, hp, w, thr, s)
        if best_fit[0] < .005:
            break
    _, k, hp, w_casual, thr, secs = best_fit
    (w_best, _, s_best), thr_best = best.best_rule(speeds, k, hp)
    mc = monte_carlo(casual, speeds, k, hp, thr, a.mc)

    fights = a.years * 365.25 * 86400 / secs
    rng = np.random.default_rng(1)
    report = {
        "speeds": dict(zip(data["turns"], speeds)), "unverified_hitless": unverified, "damageScale": k, "hp": hp,
        "casual": {"win": round(w_casual, 4), "heal_at": thr, "fight_seconds": round(secs, 1), "monte_carlo_win": round(mc, 4), "monte_carlo_fights": a.mc,
                   "years": a.years, "fights_in_those_years": int(fights), "wins_in_those_years": int(rng.binomial(int(fights), w_casual))},
        "best_ai": {"win": round(w_best, 4), "heal_at": thr_best},
    }
    print(json.dumps(report, indent=1))
    (ROOT / "tools/balance.json").write_text(json.dumps(report, indent=1))
    if a.dry_run:
        return
    boss = ROOT / "assets/egg/boss.js"; src = boss.read_text()
    src = re.sub(r"(\n  hp: )\d+(,)", lambda m: f"{m.group(1)}{hp}{m.group(2)}", src, count=1)
    if "damageScale:" in src:
        src = re.sub(r"damageScale: [\d.]+", f"damageScale: {k}", src, count=1)
    else:
        src = src.replace("\n  playerAttack:", f"\n  damageScale: {k},      // every hit's damage x this (tools/balance.py)\n  playerAttack:", 1)
    src = re.sub(r"(\n  turnSpeeds: )\[[^\]]*\]", "", src)
    src = src.replace("\n  playerAttack:", f"\n  turnSpeeds: {json.dumps([round(s, 2) for s in speeds])}, // each turn's pace, in boss.turns order (tools/balance.py)\n  playerAttack:", 1)
    boss.write_text(src)
    print("boss.js updated")


if __name__ == "__main__":
    main()
