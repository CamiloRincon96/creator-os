"""A brand's niche sound study: how the most-viewed reels sound, so the effects come out like theirs.
Done once per brand (or when the niche changes). effects.py uses it on every reel (stage 9 of /creator-reel).

    python3 production/tools/sound_study.py search <brand> "query" ["query" ...] [--n 12]
    python3 production/tools/sound_study.py download <brand> [--yes]       without --yes it only says how big it is
    python3 production/tools/sound_study.py separate <brand> [--install --yes]
    python3 production/tools/sound_study.py measure <brand>
    python3 production/tools/sound_study.py listen <brand>
    python3 production/tools/sound_study.py style <brand>
    python3 production/tools/sound_study.py clean <brand> [--yes] [--separator]

How it came about (the first full reel made in "glass", Nov 17, 2026): with 106 interface effects the creator heard "laser
beams"; with 19 measured before the music, "you can't hear anything". The study of 12 niche reels gave the missing measure: about 4
real effects every 10 s (plus their music's hits), on 1 of every 4 picture changes, almost nothing tonal, and each effect's peak
about +2.6 dB over the voice.

  search    the most-viewed Instagram reels for each query (ScrapeCreators: the person saves the key with save_token.py
            --scrapecreators; each query spends 1 credit). Leaves brands/<brand>/sounds/study/reels.json.
  download  the videos, into the computer's cache (not the repo). Asks for permission: without --yes it only shows the size. For
            study only: their audio never goes into a piece. Instagram links expire within hours: download the same day you search.
  separate  the voice from the rest (music and effects) with Demucs (htdemucs, open source, runs on the computer). The first time
            it has to be installed: --install --yes (about 830 MB, from PyPI, into the cache; `clean --separator` removes it).
  measure   how many effects every 10 s, of what kind, how loud against the voice and how many picture changes carry a sound
            (the changes come from real-sfx's find_moments.py). Leaves measures.json and STUDY.md.
  listen    a listening-test video: 6 s of each creator with their voice and then only what sits underneath (raised so it can be
            heard, never above the voice). It goes to Montage so the person picks by ear.
  style     the niche style for real-sfx (learn_style.py on the videos and their underneath track). Leaves style.json, which
            effects.py review uses to compare each brand reel with the niche.
  clean     removes the videos, the tracks and (with --separator) Demucs from the cache. The study (json and md) stays.
"""
import system
system.prepare(venv=True, args=2)
import getpass, json, os, re, shutil, subprocess, sys, urllib.parse, urllib.request
from collections import Counter
from pathlib import Path

import numpy as np
from common import ROOT, load, save

SKILL = Path.home() / ".claude" / "skills" / "real-sfx"
SR = 22050


def option(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def folders(brand):
    if not (Path(ROOT) / "brands" / brand).is_dir():
        sys.exit(f"The brand doesn't exist: brands/{brand}")
    st = Path(ROOT) / "brands" / brand / "sounds" / "study"
    st.mkdir(parents=True, exist_ok=True)
    cache = system.cache_dir("creator-os", "sound-study", brand)
    for d in ("videos", "tracks", "moments"):
        (cache / d).mkdir(parents=True, exist_ok=True)
    return st, cache


def scrapecreators_key():
    if os.environ.get("SCRAPECREATORS_API_KEY"):
        return os.environ["SCRAPECREATORS_API_KEY"]
    if system.MAC:
        k = system.read_secret("last30days-SCRAPECREATORS_API_KEY", os.environ.get("USER") or getpass.getuser())
        if k:
            return k
    env = Path.home() / ".config" / "last30days" / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*(?:export\s+)?SCRAPECREATORS_API_KEY\s*=\s*(.+)", line)
            if m:
                return m.group(1).strip().strip("'\"")
    sys.exit(f"The ScrapeCreators key is missing. The person saves it in their own terminal: {system.PY} production/tools/save_token.py --scrapecreators")


def ff(*a):
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-nostdin", *map(str, a)], capture_output=True, text=True)
    if r.returncode:
        sys.exit("ffmpeg failed:\n" + r.stderr[-1500:])


def lufs(p, a=None, b=None):
    pre = ["-ss", f"{a:.2f}", "-t", f"{b - a:.2f}"] if a is not None else []
    r = subprocess.run(["ffmpeg", "-nostats", "-nostdin", *pre, "-i", str(p), "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    return float([l for l in r.splitlines() if l.strip().startswith("I:")][-1].split()[1])


# ---------------------------------------------------------------- search and download
def search(brand):
    st, _ = folders(brand)
    queries = [a for a in sys.argv[3:] if not a.startswith("--") and a != option("--n")]
    if not queries:
        sys.exit("At least one query is missing: what the niche's audience searches for (e.g. \"edit videos with ai\")")
    n = int(option("--n", 12))
    key = scrapecreators_key()
    found, credits = {}, None
    for q in queries:
        url = "https://api.scrapecreators.com/v2/instagram/reels/search?" + urllib.parse.urlencode({"query": q})
        req = urllib.request.Request(url, headers={"x-api-key": key, "User-Agent": "creator-os-sound-study"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.loads(r.read())
        except Exception as e:      # a query that fails doesn't take the others down
            print(f"  {q}: failed ({str(e)[:80]})")
            continue
        credits = d.get("credits_remaining", credits)
        for it in d.get("reels") or []:
            k = it.get("shortcode") or it.get("code") or str(it.get("id"))
            o = it.get("owner") or it.get("user") or {}
            if not it.get("video_url"):
                continue
            found[k] = {"id": k, "query": q, "url": it.get("url") or f"https://www.instagram.com/reel/{k}",
                        "author": o.get("username") if isinstance(o, dict) else o,
                        "views": it.get("video_play_count") or it.get("video_view_count") or it.get("play_count") or 0,
                        "length_s": it.get("video_duration"), "video": it.get("video_url")}
        print(f"  {q}: {len(d.get('reels') or [])} reels")
    chosen = sorted(found.values(), key=lambda r: -(r["views"] or 0))[:n]
    save({"queries": queries, "reels": chosen}, str(st / "reels.json"))
    for r in chosen:
        print(f"  {r['views']:>10,} views  {float(r['length_s'] or 0):5.1f} s  @{r['author']}")
    print(f"{len(chosen)} reels in {st / 'reels.json'}" + (f" · credits left: {credits}" if credits is not None else ""))


def video_name(i, r):
    return f"{i:02d}-{re.sub(r'[^a-z0-9_]', '', str(r['author']).lower())}"


def download(brand):
    st, cache = folders(brand)
    reels = load(str(st / "reels.json"))["reels"]
    if "--yes" not in sys.argv:
        total = 0
        for r in reels:
            try:
                with urllib.request.urlopen(urllib.request.Request(r["video"], method="HEAD", headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as h:
                    total += int(h.headers.get("Content-Length") or 0)
            except Exception:
                pass
        sys.exit(f"It would download {len(reels)} reels, about {total / 1e6:.0f} MB, into {cache / 'videos'} (not the repo). "
                 f"For study only; `clean` removes them. With the person's yes: add --yes")
    for i, r in enumerate(reels, 1):
        dest = cache / "videos" / f"{video_name(i, r)}.mp4"
        if dest.exists():
            continue
        try:
            with urllib.request.urlopen(urllib.request.Request(r["video"], headers={"User-Agent": "Mozilla/5.0"}), timeout=120) as h:
                dest.write_bytes(h.read())
            print(f"  {dest.name}")
        except Exception as e:
            print(f"  {dest.name}: not downloaded ({str(e)[:60]}; Instagram's link expires: search again)")


# ---------------------------------------------------------------- separate (Demucs)
SEPARATE = r'''
import subprocess, sys
from pathlib import Path
import numpy as np, soundfile as sf, torch
from demucs.pretrained import get_model
from demucs.apply import apply_model
model = get_model("htdemucs"); model.eval()
SR = model.samplerate
out = Path(sys.argv[1])
for v in sys.argv[2:]:
    n = Path(v).stem
    if (out / f"{n}-rest.wav").exists():
        continue
    raw = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-i", v, "-vn", "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = torch.from_numpy(np.frombuffer(raw, dtype=np.float32).copy().reshape(-1, 2).T)
    ref = x.mean(0); m, s = ref.mean(), ref.std()
    with torch.no_grad():
        st = apply_model(model, ((x - m) / s)[None], device="cpu", split=True, overlap=0.25, progress=False)[0] * s + m
    voice = st[model.sources.index("vocals")]; rest = st.sum(0) - voice
    sf.write(out / f"{n}-voice.wav", voice.T.numpy(), SR); sf.write(out / f"{n}-rest.wav", rest.T.numpy(), SR)
    print(n, flush=True)
'''


def separate(brand):
    _, cache = folders(brand)
    venv = system.cache_dir("creator-os", "demucs")
    py = venv / ("Scripts/python.exe" if system.WINDOWS else "bin/python")
    if not py.exists():
        if not ("--install" in sys.argv and "--yes" in sys.argv):
            sys.exit(f"The separator (Demucs) is missing. Installing it downloads about 830 MB from PyPI into {venv} (free, open source, "
                     f"`clean --separator` removes it). With the person's yes: separate {brand} --install --yes")
        subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True)
        subprocess.run([str(py), "-m", "pip", "install", "-q", "--disable-pip-version-check", "demucs", "soundfile"], check=True)
    videos = sorted(str(p) for p in (cache / "videos").glob("*.mp4"))
    if not videos:
        sys.exit("No videos downloaded: run `download` first")
    env = dict(os.environ, TORCH_HOME=str(venv / "torch"), PYTHONUTF8="1")
    script = venv / "separate_creator_os.py"
    script.write_text(SEPARATE, encoding="utf-8")
    subprocess.run([str(py), "-I", str(script), str(cache / "tracks"), *videos], check=True, env=env)
    print(f"Voice and rest separated in {cache / 'tracks'}")


# ---------------------------------------------------------------- measure
def env20(x):
    h = int(0.02 * SR)
    k = len(x) // h
    return 10 * np.log10(np.mean(x[:k * h].reshape(k, h) ** 2, 1) + 1e-10)


def mono(p):
    r = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-i", str(p), "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                       capture_output=True, check=True).stdout
    return np.frombuffer(r, dtype=np.float32).copy()


def analyze(voice_wav, rest_wav, changes):
    """What sits under the voice: the bed (2 s moving median) and the effects (they rise 6 dB over the bed in under 60 ms)."""
    from scipy.ndimage import median_filter
    rest = mono(rest_wav)
    ev, er = env20(mono(voice_wav)), env20(rest)
    voice_db = float(np.median(ev[ev > np.percentile(ev, 95) - 25]))
    bed = median_filter(er, size=101, mode="nearest")
    alive = bed > -55
    rises = (er - bed > 6) & (er > -45)
    events, i = [], 0
    while i < len(er):
        if rises[i] and (i < 3 or er[i] - er[i - 3] > 4):
            j = i
            while j < len(er) and er[j] > er[i:j + 1].max() - 10 and j - i < 150:
                j += 1
            pk = i + int(np.argmax(er[i:j + 1]))
            seg = rest[int(i * 0.02 * SR):int(min(j, len(er) - 1) * 0.02 * SR) + int(0.02 * SR)]
            kind = "other"
            if len(seg) > 256:
                P = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2 + 1e-12
                f = np.fft.rfftfreq(len(seg), 1 / SR)
                band = (f > 200) & (f < 8000)
                flat = float(np.exp(np.mean(np.log(P[band]))) / np.mean(P[band]))
                low = float(P[f < 150].sum() / P.sum())
                dur = (j - i) * 0.02
                kind = ("riser" if dur > 0.9 and pk - i > (j - i) * 0.6 else "click/pop" if dur < 0.12 else
                        "low hit" if low > 0.45 else "whoosh" if flat > 0.08 else "tonal (ding/note)" if flat < 0.02 else "other")
            events.append({"t": round(i * 0.02, 2), "kind": kind, "vs_voice_db": round(float(er[pk]) - voice_db, 1)})
            i = j + 13
        else:
            i += 1
    dur = len(rest) / SR
    hit = [c for c in changes if any(abs(e["t"] - c) <= 0.2 for e in events)]
    return {"length_s": round(dur, 1), "music_pct": round(100 * float(alive.mean())),
            "music_vs_voice_db": round(float(np.median(bed[alive])) - voice_db, 1) if alive.any() else None,
            "effects_per_10s": round(10 * len(events) / dur, 1), "kinds": dict(Counter(e["kind"] for e in events)),
            "effect_vs_voice_db": round(float(np.median([e["vs_voice_db"] for e in events])), 1) if events else None,
            "picture_changes": len(changes), "changes_with_sound_pct": round(100 * len(hit) / max(1, len(changes))), "events": events}


def measure(brand):
    st, cache = folders(brand)
    reels = load(str(st / "reels.json"))["reels"]
    measures = []
    for i, r in enumerate(reels, 1):
        n = video_name(i, r)
        v, pv, pr = cache / "videos" / f"{n}.mp4", cache / "tracks" / f"{n}-voice.wav", cache / "tracks" / f"{n}-rest.wav"
        if not (v.exists() and pr.exists()):
            print(f"  {n}: the video or its separated track is missing")
            continue
        mom = cache / "moments" / n
        if not (mom / "moments.json").exists():
            subprocess.run([sys.executable, str(SKILL / "scripts" / "find_moments.py"), str(v), "--out", str(mom), "--max", "300"],
                           capture_output=True, cwd=str(SKILL))
        mm = load(str(mom / "moments.json")) if (mom / "moments.json").exists() else {"moments": []}
        changes = [x["t"] for x in (mm["moments"] if isinstance(mm, dict) else mm) if x["kind"] in ("cut", "burst")]
        a = analyze(pv, pr, changes)
        measures.append({"reel": n, "author": r["author"], "views": r["views"], "url": r["url"], **a})
        print(f"  @{r['author']:<22} {a['effects_per_10s']:>4} effects/10 s · {a['changes_with_sound_pct']:>3}% of changes with sound · "
              f"effect {a['effect_vs_voice_db']} dB vs voice · music {a['music_pct']}% of the time")
    if not measures:
        sys.exit("Nothing to measure: `download` and `separate` are missing")
    def med(k):
        v = [m[k] for m in measures if m[k] is not None]
        return round(float(np.median(v)), 1) if v else None
    summary = {"reels": len(measures), "effects_per_10s": med("effects_per_10s"), "changes_with_sound_pct": med("changes_with_sound_pct"),
               "effect_vs_voice_db": med("effect_vs_voice_db"), "with_music": sum(1 for m in measures if m["music_pct"] >= 50),
               "tonal": sum(m["kinds"].get("tonal (ding/note)", 0) for m in measures)}
    save({"summary": summary, "reels": measures}, str(st / "measures.json"))
    rows = "\n".join(f"| @{m['author']} | {m['views']:,} | {m['effects_per_10s']} | {m['changes_with_sound_pct']} % | "
                     f"{m['effect_vs_voice_db']} dB | {m['music_pct']} % |" for m in measures)
    (st / "STUDY.md").write_text(f"""# Niche sound study for "{brand}"

Written by `sound_study.py measure` (not edited by hand). Queries: {', '.join(load(str(st / 'reels.json'))['queries'])}.

## What's normal in the niche (median of {summary['reels']} reels)

- **Effects every 10 s:** {summary['effects_per_10s']} (it also counts their music's hits).
- **Picture changes with a sound:** {summary['changes_with_sound_pct']} %.
- **An effect's peak against the voice:** {summary['effect_vs_voice_db']} dB.
- **Background music:** {summary['with_music']} of {summary['reels']} carry it almost all the time.
- **Dings and notes (tonal):** {summary['tonal']} in total.

| creator | views | effects / 10 s | changes with sound | effect vs voice | music |
|---|---|---|---|---|---|
{rows}

How it's measured: the voice is separated from the rest with Demucs; in what sits underneath, an effect is whatever rises 6 dB over
its background in under 60 ms; picture changes come from real-sfx's `find_moments.py`. The kinds are approximate; the counts and the
levels are reliable.
""", encoding="utf-8")
    print(f"\n{st / 'STUDY.md'}")


# ---------------------------------------------------------------- listen
def label(text, sub, path):
    import cv2
    img = np.zeros((170, 1000, 4), np.uint8)
    cv2.rectangle(img, (0, 0), (1000, 170), (20, 20, 20, 200), -1)
    cv2.putText(img, text, (30, 70), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (255, 255, 255, 255), 3, cv2.LINE_AA)
    cv2.putText(img, sub, (30, 135), cv2.FONT_HERSHEY_SIMPLEX, 0.95, (120, 230, 255, 255), 3, cv2.LINE_AA)
    cv2.imwrite(str(path), img)


def listen(brand):
    st, cache = folders(brand)
    measures = sorted(load(str(st / "measures.json"))["reels"], key=lambda m: -m["views"])[:int(option("--n", 8))]
    tmp = cache / "listen"
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir()
    parts, markers, t = [], [], 0.0
    for k, m in enumerate(measures):
        v, pr = cache / "videos" / f"{m['reel']}.mp4", cache / "tracks" / f"{m['reel']}-rest.wav"
        dur = m["length_s"]
        a = max(((s, sum(1 for e in m["events"] if s <= e["t"] < s + 6)) for s in np.arange(0.0, max(0.1, dur - 6), 0.5)),
                key=lambda x: x[1])[0]                       # the 6 s stretch with the most effects
        b = min(dur, a + 6)
        Lo, Lr = lufs(v, a, b), lufs(pr, a, b)
        g = -16.0 - Lo
        lift = min(max(-20.0 - (Lr + g), 0.0), 20.0)
        for mode in ("voice", "under"):
            png = tmp / f"lb-{k}-{mode}.png"
            label(f"@{m['author']}  {m['views'] // 1000}k", "with their voice" if mode == "voice" else
                  f"only what's underneath: {Lo - Lr:.0f} dB under it all" + (f" (here +{lift:.0f})" if lift >= 1 else ""), png)
            out = tmp / f"p{k:02d}-{mode}.mp4"
            src = v if mode == "voice" else pr
            af = f"volume={g + (0 if mode == 'voice' else lift):.1f}dB,alimiter=limit=0.7:level=0"
            ff("-ss", f"{a:.2f}", "-t", f"{b - a:.2f}", "-i", v, "-ss", f"{a:.2f}", "-t", f"{b - a:.2f}", "-i", src, "-i", png,
               "-filter_complex", "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,fps=30,"
               "setsar=1[v];[v][2:v]overlay=40:1640[vo];[1:a]aresample=48000," + af + ",aformat=channel_layouts=stereo[ao]",
               "-map", "[vo]", "-map", "[ao]", "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-b:a", "192k", "-shortest", out)
            parts.append(out)
            if mode == "voice":
                markers.append(f"{t:.1f}:@{m['author']}")
            t += b - a
    (tmp / "list.txt").write_text("".join(f"file '{p.name}'\n" for p in parts), encoding="utf-8")
    final = st / "listen.mp4"
    ff("-f", "concat", "-safe", "0", "-i", tmp / "list.txt", "-c", "copy", final)
    print(f"{final} ({t:.0f} s)\nMarkers for Montage: {','.join(markers)}\n"
          f"Before showing it: review.py on the video, and in REVIEW.md mark the \"Visual floor\" as \"n/a (study)\".")


# ---------------------------------------------------------------- style and clean
def style(brand):
    st, cache = folders(brand)
    measures = load(str(st / "measures.json"))["reels"]
    refs = cache / "refs.txt"
    lines = []
    for m in measures:
        v, pr = cache / "videos" / f"{m['reel']}.mp4", cache / "tracks" / f"{m['reel']}-rest.wav"
        if v.exists() and pr.exists():
            lines.append(f"{v} | {pr}")
    refs.write_text("\n".join(lines) + "\n", encoding="utf-8")
    name = f"{brand}-niche"
    r = subprocess.run([sys.executable, str(SKILL / "scripts" / "learn_style.py"), str(refs), "--name", name],
                       capture_output=True, text=True, cwd=str(SKILL))
    print(r.stdout[-2500:] or r.stderr[-1500:])
    s = load(str(SKILL / "styles" / f"{name}.json"))
    for ref in s.get("per_ref", []):                 # only the file name: no paths from the computer
        for k in ("video", "stem"):
            if isinstance(ref.get(k), str):
                ref[k] = Path(ref[k]).name
    save(s, str(st / "style.json"))
    print(f"{st / 'style.json'} (effects.py review compares each brand reel with it)")


def clean(brand):
    _, cache = folders(brand)
    venv = system.cache_dir("creator-os", "demucs")
    what = [cache] + ([venv] if "--separator" in sys.argv else [])
    size = sum(f.stat().st_size for d in what if d.exists() for f in d.rglob("*") if f.is_file())
    if "--yes" not in sys.argv:
        sys.exit(f"It would remove {size / 1e6:.0f} MB: {', '.join(str(d) for d in what)}. The study (json and md) stays. With the yes: --yes")
    for d in what:
        shutil.rmtree(d, ignore_errors=True)
    print(f"Removed {size / 1e6:.0f} MB.")


if __name__ == "__main__":
    commands = {"search": search, "download": download, "separate": separate, "measure": measure, "listen": listen, "style": style, "clean": clean}
    if sys.argv[1] not in commands:
        sys.exit(__doc__)
    commands[sys.argv[1]](sys.argv[2])
