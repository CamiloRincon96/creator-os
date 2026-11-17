"""An account's pulse: what was posted, how it did and what each piece was like. Used by /creator-pulse; fed by the watcher.

    python3 production/tools/pulse.py collect <brand>          # metrics of everything posted (and of the stories that are live)
    python3 production/tools/pulse.py cards <brand> [--no-voice]   # what each reel was like
    python3 production/tools/pulse.py report <brand> [--days 28]  # the table, relative to reach
    python3 production/tools/pulse.py tag <brand> <id> [--role …] [--topic …] [--hook …] [--format …] [--notes …]

Everything lives in brands/<brand>/pulse/posts.json (in git: it is small and it is the account's memory). Downloaded
videos and frame sheets go to the computer's cache (system.cache_dir: the cache folder of macOS, Windows or Linux), never to the repo.

- collect: the watcher runs it every hour (instagram.py watch). A STORY's metrics only exist while it is
  live (24 h): that is why they are saved every hour. For reels and posts a snapshot is saved at each age bucket
  (1, 3, 6, 12, 24, 48, 72 h, 7, 14 and 30 days), plus the day's follower count.
- cards: downloads each new reel and measures duration, cuts per minute, loudness, the hook sheet (first 3 s) and,
  with the voice, the first sentence, the second it is said at and words per second.
- tag: what is judged rather than measured (role in the wheel, topic, hook type, format). Claude sets it in
  /creator-pulse after looking at the hook sheet.
"""
import datetime as dt
import json
import re
import statistics
import subprocess
import sys
import system

if __name__ == "__main__":
    system.prepare(venv=len(sys.argv) > 1 and sys.argv[1] == "cards")  # the cards use production/.venv

import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import instagram as ig  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
CACHE = system.cache_dir("creator-os", "pulse")
BUCKETS_H = [1, 3, 6, 12, 24, 48, 72, 168, 336, 720]
METRICS = {
    "REELS": ["views", "reach", "saved", "shares", "comments", "likes", "total_interactions", "ig_reels_avg_watch_time",
              "ig_reels_video_view_total_time", "reels_skip_rate"],
    "FEED": ["views", "reach", "saved", "shares", "comments", "likes", "total_interactions", "profile_visits", "follows"],
    "STORY": ["views", "reach", "replies", "shares", "follows", "profile_visits", "total_interactions", "navigation"],
}


def path_of(brand):
    return REPO / "brands" / brand / "pulse" / "posts.json"


def load(brand):
    a = path_of(brand)
    return json.loads(a.read_text()) if a.exists() else {"account": brand, "followers": [], "posts": {}}


def save(brand, d):
    a = path_of(brand)
    a.parent.mkdir(parents=True, exist_ok=True)
    a.write_text(json.dumps(d, indent=1, ensure_ascii=False))


def metrics(tok, mid, kind):
    """One at a time: if Meta does not give a metric for that piece, it moves on to the others."""
    res = {}
    for m in METRICS[kind]:
        try:
            q = {"metric": m}
            if m == "navigation":
                q["breakdown"] = "story_navigation_action_type"
            r = ig.api("GET", f"{mid}/insights", tok, q)["data"][0]
            if m == "navigation":
                for b in r.get("total_value", {}).get("breakdowns", [{}])[0].get("results", []):
                    res[f"nav_{b['dimension_values'][0].lower()}"] = b["value"]
            else:
                res[m] = r["values"][0]["value"] if r.get("values") else r.get("total_value", {}).get("value")
        except (RuntimeError, KeyError, IndexError):
            pass
    return res


def collect(brand, quiet=False):
    tok, c = ig.token(brand), ig.account(brand)
    d = load(brand)
    now = dt.datetime.now(dt.timezone.utc)
    today = now.astimezone().date().isoformat()
    info = ig.api("GET", c["ig_id"], tok, {"fields": "followers_count,media_count"})
    if not d["followers"] or d["followers"][-1]["date"] != today:
        d["followers"].append({"date": today, "n": info.get("followers_count")})
    else:
        d["followers"][-1]["n"] = info.get("followers_count")
    media = ig.api("GET", f"{c['ig_id']}/media", tok, {"fields": "id,timestamp,media_type,media_product_type,caption,permalink", "limit": 50}).get("data", [])
    stories = ig.api("GET", f"{c['ig_id']}/stories", tok, {"fields": "id,timestamp,media_type,permalink"}).get("data", [])
    new = 0
    for m in media + [dict(h, media_product_type="STORY") for h in stories]:
        kind = m.get("media_product_type") or "FEED"
        kind = kind if kind in METRICS else "FEED"
        when = dt.datetime.fromisoformat(m["timestamp"].replace("+0000", "+00:00"))
        hours = (now - when).total_seconds() / 3600
        p = d["posts"].setdefault(m["id"], {"type": kind, "format": m.get("media_type"), "date": m["timestamp"],
                                            "link": m.get("permalink"), "copy": (m.get("caption") or "").split("\n")[0][:120], "snapshots": []})
        if kind == "STORY":
            bucket = round(hours)  # every hour while it is live
        else:
            if hours > 31 * 24 and p["snapshots"]:
                continue
            bucket = next((t for t in BUCKETS_H if hours <= t), BUCKETS_H[-1])
        if any(f.get("bucket") == bucket for f in p["snapshots"]):
            continue
        p["snapshots"].append({"bucket": bucket, "hours": round(hours, 1), "date": now.isoformat(timespec="minutes"), **metrics(tok, m["id"], kind)})
        new += 1
    save(brand, d)
    if not quiet:
        print(f"@{c.get('username')}: {info.get('followers_count')} followers · {len(media)} posts · {len(stories)} live stories · {new} new snapshots")
    return new


def latest(p):
    return p["snapshots"][-1] if p.get("snapshots") else {}


def probe(path, what):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", what, "-of", "json", str(path)], capture_output=True, text=True)
    return json.loads(r.stdout or "{}")


def cards(brand, with_voice=True):
    tok = ig.token(brand)
    d = load(brand)
    dest = CACHE / brand
    dest.mkdir(parents=True, exist_ok=True)
    done = 0
    for mid, p in d["posts"].items():
        if p["type"] != "REELS" or p.get("card"):
            continue
        video = dest / f"{mid}.mp4"
        if not video.exists():
            url = ig.api("GET", mid, tok, {"fields": "media_url"}).get("media_url")
            if not url:
                continue
            urllib.request.urlretrieve(url, video)
        dur = float(probe(video, "format=duration")["format"]["duration"])
        sc = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(video), "-vf", "select='gt(scene,0.3)',showinfo", "-an", "-f", "null", "-"],
                            capture_output=True, text=True).stderr
        cuts = len(re.findall(r"pts_time:", sc))
        lufs_out = subprocess.run(["ffmpeg", "-nostats", "-i", str(video), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
        lufs = [l for l in lufs_out.splitlines() if l.strip().startswith("I:")]
        sheet = dest / f"{mid}-hook.jpg"
        subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-t", "3", "-i", str(video), "-vf",
                        "fps=2,scale=240:-1,tile=6x1:padding=4:color=white", "-frames:v", "1", str(sheet)])
        f = {"duration": round(dur, 1), "cuts_per_min": round(cuts / (dur / 60), 1) if dur else None,
             "lufs": float(lufs[-1].split()[1]) if lufs else None, "hook_sheet": str(sheet)}
        if with_voice:
            try:
                from common import read, transcribe
                wav = dest / f"{mid}.wav"
                subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", str(wav)], check=True)
                x, sr = read(str(wav))
                words = transcribe(x, sr)
                if words:
                    f["first_word_s"] = words[0]["start"]
                    f["first_3s"] = " ".join(w["t"] for w in words if w["start"] < 3)
                    f["words_per_s"] = round(len(words) / max(0.1, words[-1]["end"] - words[0]["start"]), 2)
                else:
                    f["first_3s"] = "(no voice)"
                wav.unlink(missing_ok=True)
            except Exception as e:  # without the voice environment, the card still comes out, without that part
                f["voice"] = f"could not transcribe: {str(e)[:80]}"
        p["card"] = f
        done += 1
        print(f"{mid}: {f['duration']} s · {f['cuts_per_min']} cuts/min · {f.get('lufs')} LUFS · \"{f.get('first_3s', '')}\"")
    save(brand, d)
    print(f"{done} new cards")


def pct(a, b):
    return round(100 * a / b, 1) if a is not None and b else None


def report(brand, days=28):
    d = load(brand)
    since = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    rows = []
    for mid, p in d["posts"].items():
        if dt.datetime.fromisoformat(p["date"].replace("+0000", "+00:00")) < since:
            continue
        u, ca, tg = latest(p), p.get("card", {}), p.get("tags", {})
        reach = u.get("reach")
        rows.append({"id": mid, "type": p["type"], "date": p["date"][:10], "reach": reach, "views": u.get("views"),
                     "share%": pct(u.get("shares"), reach), "save%": pct(u.get("saved"), reach), "likes%": pct(u.get("likes"), reach),
                     "skip%": u.get("reels_skip_rate"), "watched%": pct((u.get("ig_reels_avg_watch_time") or 0) / 1000, ca.get("duration")),
                     "dur": ca.get("duration"), "cuts/min": ca.get("cuts_per_min"), "role": tg.get("role", "—"),
                     "hook": (ca.get("first_3s") or p.get("copy", ""))[:50], "nav_exit": u.get("nav_tap_exit"), "replies": u.get("replies")})
    fol = d.get("followers", [])
    print(f"# Pulse of {brand} · last {days} days")
    if fol:
        print(f"Followers: {fol[0]['n']} ({fol[0]['date']}) -> {fol[-1]['n']} ({fol[-1]['date']})")
    for kind, cols in (("REELS", ["date", "reach", "views", "share%", "save%", "likes%", "skip%", "watched%", "dur", "cuts/min", "role", "hook"]),
                       ("FEED", ["date", "reach", "share%", "save%", "likes%", "role", "hook"]),
                       ("STORY", ["date", "reach", "views", "replies", "nav_exit", "role"])):
        fs = sorted((f for f in rows if f["type"] == kind), key=lambda f: f["date"], reverse=True)
        if not fs:
            continue
        print(f"\n## {kind} ({len(fs)})\n")
        print("| " + " | ".join(cols) + " |\n|" + "---|" * len(cols))
        for f in fs:
            print("| " + " | ".join("—" if f.get(k) is None else str(f.get(k)) for k in cols) + " |")
        for k in ("share%", "save%", "skip%", "watched%"):
            vals = [f[k] for f in fs if f.get(k) is not None]
            if len(vals) >= 2:
                print(f"- median {k}: {statistics.median(vals)}")


def tag(brand, mid, fields):
    d = load(brand)
    if mid not in d["posts"]:
        sys.exit(f"Post {mid} is not in {brand}'s pulse: run collect first")
    d["posts"][mid].setdefault("tags", {}).update(fields)
    save(brand, d)
    print(f"{mid}: {d['posts'][mid]['tags']}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    command, brand = sys.argv[1], sys.argv[2]
    if command == "collect":
        collect(brand)
    elif command == "cards":
        cards(brand, with_voice="--no-voice" not in sys.argv)
    elif command == "report":
        report(brand, int(sys.argv[sys.argv.index("--days") + 1]) if "--days" in sys.argv else 28)
    elif command == "tag":
        mid = sys.argv[3]
        fields = {k: sys.argv[sys.argv.index(f"--{k}") + 1] for k in ("role", "topic", "hook", "format", "notes") if f"--{k}" in sys.argv}
        tag(brand, mid, fields)
    else:
        sys.exit(__doc__)
