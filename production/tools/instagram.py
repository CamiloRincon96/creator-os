"""Posts to Instagram through Meta's official API: reels (and trial reels) with their copy, at the batch's times.

    python3 production/tools/instagram.py connect <brand>        # once: finds the Instagram account
    python3 production/tools/instagram.py test <brand>           # account, followers and the day's quota
    python3 production/tools/instagram.py reels <brand> [n]      # the last n reels with their metrics (for /creator-ideas)
    python3 production/tools/instagram.py audios <brand> [--type music|original_sound] [--search "…"] [--n 20] [--download <folder>] [--raw]
                                                                 # trending Instagram audio (Audio API, read-only)
    python3 production/tools/instagram.py stories <brand> <file…> --approved "<what the creator said>"
                                                                # posts now, in order, images or videos as stories
                                                                # (an image goes out as a 6 s video: uploaded from the computer)
    python3 production/tools/instagram.py preview <batch.json>   # what would be posted and when (does not post)
    python3 production/tools/instagram.py approve <batch.json> --message "<what the creator said>"
    python3 production/tools/instagram.py schedule <batch.json>  # leaves the day's posting running
    python3 production/tools/instagram.py status <batch.json>
    python3 production/tools/instagram.py cancel <batch.json>
    python3 production/tools/instagram.py results <batch.json>   # views, reach, saves... of each one
    python3 production/tools/instagram.py watch                  # every batch: saves metrics once they reach 24 and 72 h
    python3 production/tools/instagram.py watcher install|remove|status   # `watch` every hour (launchd, Task Scheduler or cron)

RULE: Claude never posts on its own. `approve` is run only after the creator approves IN THE CHAT that exact batch
(videos, copies, day and times), and what they said is saved. `schedule` does not run without that approval.

Setup (once per computer, done by the creator; see production/INSTAGRAM.md):
  - The Instagram account is professional and linked to a Facebook page.
  - A Meta app with the instagram_basic, instagram_content_publish, instagram_manage_insights,
    pages_show_list and pages_read_engagement permissions, and a token (preferably a system user's, which does not expire).
  - The token goes in the system's secure store (the macOS keychain, the Windows Credential Manager,
    secret-tool on Linux) or in the <BRAND>_INSTAGRAM_TOKEN variable, never in the repo. The person saves it:
        python3 production/tools/save_token.py <brand>
    (it asks you to paste it; Claude neither writes nor sees it).
It uses the resumable upload (graph.facebook.com + rupload.facebook.com): it uploads the file from the computer, without hosting it.
Instagram audio (Meta's Audio API, only with Facebook Login, which is the one this repo uses): `audios` lists what is
trending (without --search) or searches; in a batch, a post with "audio": {"id": "…", "volume": 20, "video_volume": 100}
goes out with that audio from Instagram's library on it (the license is Instagram's). Instagram does not let you preview it:
the `download_url` is a temporary preview (about 36 h) to mix a local test and approve it by ear, not to put in the video.
Meta's limit: 100 API posts in 24 hours.
"""
import system

system.prepare()

import datetime as dt
import json
import os
import sys
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

REPO = Path(__file__).resolve().parents[2]
CONFIG = REPO / "production" / "instagram.json"
GRAPH = os.environ.get("IG_GRAPH_TEST", "https://graph.facebook.com")  # IG_*_TEST: only for testing against a fake server
RUPLOAD = os.environ.get("IG_RUPLOAD_TEST", "https://rupload.facebook.com/ig-api-upload")


def cfg():
    return json.loads(CONFIG.read_text(encoding="utf-8")) if CONFIG.exists() else {"version": "v27.0", "accounts": {}}


def version():
    return cfg().get("version", "v27.0")


def token(brand):
    if os.environ.get("IG_TOKEN_TEST"):
        return os.environ["IG_TOKEN_TEST"]
    # first the environment variable <BRAND>_INSTAGRAM_TOKEN (e.g. EXAMPLE_INSTAGRAM_TOKEN); if not, the system's store
    var = f"{brand.upper().replace('-', '_')}_INSTAGRAM_TOKEN"
    if os.environ.get(var):
        return os.environ[var].strip()
    tok = system.read_secret(f"{brand}-instagram", "token")
    if not tok:
        sys.exit(f"There is no token for {brand}. Save it yourself, in your own terminal:\n  {system.PY} production/tools/save_token.py {brand}\n"
                 f"(or in the environment variable {var}). See production/INSTAGRAM.md")
    return tok


def api(method, path, tok, data=None, url=None):
    u = url or f"{GRAPH}/{version()}/{path.lstrip('/')}"
    data = dict(data or {})
    data["access_token"] = tok
    body = None
    if method == "GET":
        u += ("&" if "?" in u else "?") + urllib.parse.urlencode(data)
    else:
        body = urllib.parse.urlencode(data).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(u, data=body, method=method), timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf8", "ignore")
        detail = detail.replace(tok, "<token>")
        raise RuntimeError(f"{method} {path}: HTTP {e.code} {detail[:600]}") from None


def account(brand):
    c = cfg()["accounts"].get(brand)
    if not c:
        sys.exit(f"{brand}'s account is not connected: python3 production/tools/instagram.py connect {brand}")
    return c


def load(batch):
    return json.loads(Path(batch).read_text(encoding="utf-8"))


def save(batch, d):
    Path(batch).write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")


def timetable(d):
    tz = ZoneInfo(d.get("timezone", "America/Bogota"))
    day = dt.date.fromisoformat(d["day"])
    for p in d["posts"]:
        if p.get("manual"):  # the creator uploads it from the app (e.g. with a trending song): not posted through the API
            continue
        h, m = map(int, p["time"].split(":"))
        yield p, dt.datetime.combine(day, dt.time(h, m), tz)


def upload_and_publish(brand, d, p, log):
    tok, c = token(brand), account(brand)
    video = REPO / p["video"]
    data = {"media_type": "REELS", "upload_type": "resumable", "caption": p.get("copy", ""), "thumb_offset": str(p.get("cover_ms", 0))}
    if p.get("audio"):  # an audio from Instagram's library (Audio API): Instagram adds the song, it is not in the file
        a = p["audio"]
        data["audio_configuration"] = json.dumps({"audio_id": str(a["id"]), "audio_volume": int(a.get("volume", 20)),
                                                  "video_volume": int(a.get("video_volume", 100))})
    if d.get("trial", True):
        data["trial_params"] = json.dumps({"graduation_strategy": d.get("graduation", "MANUAL")})
    r = api("POST", f"{c['ig_id']}/media", tok, data)
    container = r["id"]
    log(f"{p['id']}: container {container}; uploading {video.stat().st_size / 1e6:.1f} MB")
    target = r.get("uri") or f"{RUPLOAD}/{version()}/{container}"
    req = urllib.request.Request(target, data=video.read_bytes(), method="POST",
                                 headers={"Authorization": f"OAuth {tok}", "offset": "0", "file_size": str(video.stat().st_size)})
    with urllib.request.urlopen(req, timeout=600) as resp:
        up = json.load(resp)
    if not up.get("success", True):
        raise RuntimeError(f"the upload failed: {up}")
    for _ in range(40):  # up to 10 minutes
        st = api("GET", container, tok, {"fields": "status_code,status"})
        if st.get("status_code") == "FINISHED":
            break
        if st.get("status_code") in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Instagram did not process the video: {st}")
        time.sleep(15)
    else:
        raise RuntimeError("Instagram took more than 10 minutes to process the video")
    pub = api("POST", f"{c['ig_id']}/media_publish", tok, {"creation_id": container})
    media = pub["id"]
    link = api("GET", media, tok, {"fields": "permalink"}).get("permalink", "")
    return media, link


def story_as_video(file, seconds=6):
    """An image is posted as an N-second video: that way it uploads from the computer (the API wants images hosted)."""
    if file.suffix.lower() in (".mp4", ".mov"):
        return file
    out = file.with_suffix(".story.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", "30", "-t", str(seconds), "-i", str(file),
                    "-f", "lavfi", "-t", str(seconds), "-i", "anullsrc=r=48000:cl=stereo",
                    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "stillimage", "-c:a", "aac", "-b:a", "128k",
                    "-shortest", "-movflags", "+faststart", str(out)], check=True)
    return out


def post_story(brand, video, log=print):
    """Uploads a video from the computer as a story (media_type STORIES, resumable upload) and publishes it."""
    tok, c = token(brand), account(brand)
    r = api("POST", f"{c['ig_id']}/media", tok, {"media_type": "STORIES", "upload_type": "resumable"})
    cont = r["id"]
    target = r.get("uri") or f"{RUPLOAD}/{version()}/{cont}"
    req = urllib.request.Request(target, data=video.read_bytes(), method="POST",
                                 headers={"Authorization": f"OAuth {tok}", "offset": "0", "file_size": str(video.stat().st_size)})
    with urllib.request.urlopen(req, timeout=600) as resp:
        up = json.load(resp)
    if not up.get("success", True):
        raise RuntimeError(f"the upload failed: {up}")
    for _ in range(40):
        st = api("GET", cont, tok, {"fields": "status_code,status"})
        if st.get("status_code") == "FINISHED":
            break
        if st.get("status_code") in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Instagram didn't process the story: {st}")
        time.sleep(5)
    else:
        raise RuntimeError("Instagram took more than 3 minutes to process the story")
    return api("POST", f"{c['ig_id']}/media_publish", tok, {"creation_id": cont})["id"]


def option_value(option):
    return sys.argv[sys.argv.index(option) + 1] if option in sys.argv and sys.argv.index(option) + 1 < len(sys.argv) else None


METRICS = ["views", "reach", "saved", "shares", "comments", "likes", "total_interactions", "ig_reels_avg_watch_time"]


def metrics_of(tok, media_id):
    """A reel's metrics. If Meta rejects the batch of metrics, they are requested one at a time (one may not exist)."""
    try:
        r = api("GET", f"{media_id}/insights", tok, {"metric": ",".join(METRICS)})
        return {x["name"]: x["values"][0]["value"] for x in r.get("data", [])}
    except RuntimeError:
        res = {}
        for m in METRICS:
            try:
                r = api("GET", f"{media_id}/insights", tok, {"metric": m})
                res[m] = r["data"][0]["values"][0]["value"]
            except (RuntimeError, KeyError, IndexError):
                pass
        return res


TASK = "com.creator-os.metrics"
WATCHER_LOG = system.logs_dir("creator-os") / "creator-os-metrics.log"
notify = system.notify


def main():
    sys.argv = system.log_to(sys.argv)
    if len(sys.argv) < 2 or (len(sys.argv) < 3 and sys.argv[1] not in ("watch", "watcher")):
        sys.exit(__doc__)
    command, arg = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "")

    if command == "stories":
        msg = option_value("--approved")
        if not msg:
            sys.exit("Missing --approved \"<what the creator said in the chat>\": stories are only posted with their go-ahead.")
        files = [Path(x) for x in sys.argv[3:] if not x.startswith("--") and x != msg]
        account(arg)
        log_file = files[0].resolve().parent / "posted.json"
        done = json.loads(log_file.read_text(encoding="utf-8")) if log_file.exists() else []
        for f in files:
            f = f.resolve()
            media = post_story(arg, story_as_video(f))
            done.append({"file": f.name, "media_id": media, "account": account(arg).get("username"),
                         "date": dt.datetime.now().isoformat(timespec="seconds"), "approved": msg})
            log_file.write_text(json.dumps(done, indent=1, ensure_ascii=False), encoding="utf-8")
            print(f"  ✓ {f.name} posted as a story (id {media})")
        print(f"Log: {log_file}")
        return

    if command == "connect":
        tok = token(arg)
        r = api("GET", "me/accounts", tok, {"fields": "name,instagram_business_account{id,username}"})
        accounts = [(pg["name"], pg["instagram_business_account"]) for pg in r.get("data", []) if pg.get("instagram_business_account")]
        if not accounts:
            sys.exit("The token does not see any professional Instagram account linked to a Facebook page.")
        for name, ig in accounts:
            print(f"  page \"{name}\" -> @{ig.get('username')} (id {ig['id']})")
        chosen = next((ig for _, ig in accounts if ig.get("username", "").lower() == arg.lower()), accounts[0][1])
        c = cfg()
        c["accounts"][arg] = {"ig_id": chosen["id"], "username": chosen.get("username")}
        CONFIG.write_text(json.dumps(c, indent=1), encoding="utf-8")
        print(f"Connected @{chosen.get('username')} for {arg} ({CONFIG.relative_to(REPO)}).")

    elif command == "audios":
        # what is playing on Instagram: without --search, what is trending (Meta's Audio API, read-only)
        tok, c = token(arg), account(arg)
        op = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
        data = {"audio_type": op("--type", "music"), "user_id": c["ig_id"]}
        if op("--search"):
            data["search_query"] = op("--search")
        r = api("GET", "ig_audio", tok, data)
        rows = (r.get("audio") or r.get("data") or [])[: int(op("--n", 20))]
        if "--raw" in sys.argv:
            print(json.dumps(rows, indent=1, ensure_ascii=False)[:4000])
        for i, a in enumerate(rows, 1):
            dur = a.get("duration_in_ms") or a.get("duration")
            who = a.get("display_artist") or (f"@{a['ig_username']}" if a.get("ig_username") else "")
            print(f"{i:2}. {a.get('title') or '?'} · {who} · id {a.get('audio_id') or a.get('id')}"
                  + (f" · {int(dur) / 1000:.0f} s" if dur and str(dur).isdigit() else "")
                  + (f" · {a['on_platform_audio_preview_link']}" if a.get("on_platform_audio_preview_link") else ""))
        if op("--download"):  # the temporary preview, for a local test mix (it does not go in the video)
            dest = Path(op("--download")); dest.mkdir(parents=True, exist_ok=True)
            for a in rows:
                if a.get("download_url"):
                    f = dest / f"{a.get('audio_id') or a.get('id')}.m4a"
                    urllib.request.urlretrieve(a["download_url"], f)
                    print(f"  preview: {f}")
        if not rows:
            print("Instagram returned no audio (is the account professional and is the token from Facebook Login?)")

    elif command == "test":
        tok, c = token(arg), account(arg)
        info = api("GET", c["ig_id"], tok, {"fields": "username,followers_count,media_count"})
        quota = api("GET", f"{c['ig_id']}/content_publishing_limit", tok, {"fields": "quota_usage,config"})
        print(f"@{info.get('username')}: {info.get('followers_count')} followers, {info.get('media_count')} posts")
        print(f"API posting quota (24 h): {quota.get('data', [{}])[0]}")

    elif command == "reels":
        # what already worked on the account: the starting point of the creative stage (/creator-ideas) and of the diagnosis (12a)
        tok, c = token(arg), account(arg)
        n = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        info = api("GET", c["ig_id"], tok, {"fields": "username,followers_count"})
        r = api("GET", f"{c['ig_id']}/media", tok, {"fields": "id,timestamp,media_product_type,caption,permalink", "limit": 30})
        ree = [m for m in r.get("data", []) if m.get("media_product_type") == "REELS"][:n]
        print(f"@{info.get('username')} · {info.get('followers_count')} followers · last {len(ree)} reels")
        print(f"{'date':10} {'views':>6} {'reach':>7} {'skip %':>7} {'avg s':>6} {'shares':>7} {'saves':>5} {'likes':>5}  copy")
        for m in ree:
            x = metrics_of(tok, m["id"])
            try:
                sk = api("GET", f"{m['id']}/insights", tok, {"metric": "reels_skip_rate"})["data"][0]["values"][0]["value"]
            except (RuntimeError, KeyError, IndexError):
                sk = "—"
            copy = (m.get("caption") or "").split("\n")[0][:60]
            print(f"{m['timestamp'][:10]:10} {x.get('views', 0):>6} {x.get('reach', 0):>7} {sk:>7} {x.get('ig_reels_avg_watch_time', 0) / 1000:>6.1f} "
                  f"{x.get('shares', 0):>7} {x.get('saved', 0):>5} {x.get('likes', 0):>5}  {copy}")

    elif command == "preview":
        d = load(arg)
        print(f"Batch {d['project']} · {d['day']} · {'trial reels (non-followers only)' if d.get('trial', True) else 'regular reels'} · "
              f"approved: {d['approved']['date'] if d.get('approved') else 'NO'}")
        for p, when in timetable(d):
            v = REPO / p["video"]
            first = p.get("copy", "").split("\n")[0]
            print(f"  {when:%H:%M} · {p['id']} · {'ok' if v.exists() else 'VIDEO MISSING'} · {len(p.get('copy', ''))} characters · {p['status']}\n      \"{first}\"")

    elif command == "approve":
        d = load(arg)
        msg = sys.argv[sys.argv.index("--message") + 1] if "--message" in sys.argv else ""
        if not msg:
            sys.exit("--message is missing: what the creator said when approving this batch in the chat.")
        d["approved"] = {"by": "the creator", "date": dt.datetime.now().isoformat(timespec="seconds"), "message": msg}
        save(arg, d)
        print("Batch approved.")

    elif command == "schedule":
        d = load(arg)
        if not d.get("approved"):
            sys.exit("The batch is not approved. The creator approves it in the chat and then: instagram.py approve <batch> --message \"…\"")
        now = dt.datetime.now(ZoneInfo(d.get("timezone", "America/Bogota")))
        late = [p["id"] for p, c in timetable(d) if c < now and p["status"] == "pending"]
        if late:
            sys.exit(f"The time has already passed for {', '.join(late)}: change the batch's times.")
        account(d["brand"])
        token(d["brand"])
        pid = system.launch_detached([sys.executable, str(Path(__file__).resolve()), "run", str(Path(arg).resolve())],
                                     Path(arg).with_suffix(".log"))
        d["process"] = pid
        save(arg, d)
        print(f"Scheduled (process {pid}). The computer has to stay on and connected until the last time slot.")

    elif command == "run":
        system.keep_awake()

        def log(t):
            print(f"[{dt.datetime.now():%H:%M:%S}] {t}", flush=True)
        d = load(arg)
        for p, when in sorted(timetable(d), key=lambda x: x[1]):
            if p["status"] != "pending":
                continue
            wait = (when - dt.datetime.now(when.tzinfo)).total_seconds()
            if wait > 0:
                log(f"{p['id']}: waiting until {when:%H:%M}")
                time.sleep(wait)
            d = load(arg)
            p = next(x for x in d["posts"] if x["id"] == p["id"])
            try:
                media, link = upload_and_publish(d["brand"], d, p, log)
                p.update({"status": "published", "media_id": media, "link": link, "published_at": dt.datetime.now().isoformat(timespec="seconds")})
                log(f"{p['id']}: published {link}")
            except Exception as e:  # noqa: BLE001
                p.update({"status": "error", "error": str(e)[:800]})
                log(f"{p['id']}: ERROR {e}")
                notify(f"{p['id']} didn't go out ({d.get('project', 'the batch')})", f"Instagram said: {str(e)[:150]}. Open it with your AI: instagram.py results")
            save(arg, d)
        d = load(arg)
        d.pop("process", None)
        save(arg, d)
        log("batch finished")

    elif command == "status":
        d = load(arg)
        pid = d.get("process")
        alive = system.alive(pid)
        print(f"process: {'running (' + str(pid) + ')' if alive else 'not running'}")
        for p, when in timetable(d):
            print(f"  {when:%H:%M} {p['id']}: {p['status']} {p.get('link', '')} {p.get('error', '')[:200]}")

    elif command == "cancel":
        d = load(arg)
        if d.get("process"):
            system.terminate(d["process"])
            d.pop("process")
            save(arg, d)
        print("Canceled: whatever was not posted stays pending.")

    elif command == "results":
        d = load(arg)
        tok = token(d["brand"])
        print("variation         views    reach   saves    shares  comments  likes  avg watched")
        for p in d["posts"]:
            if not p.get("media_id"):
                continue
            res = metrics_of(tok, p["media_id"])
            p.setdefault("results", []).append({"date": dt.datetime.now().isoformat(timespec="minutes"), **res})
            avg = res.get("ig_reels_avg_watch_time")
            print(f"{p['id'][:16]:16} {res.get('views', '—'):>7} {res.get('reach', '—'):>8} {res.get('saved', '—'):>7} {res.get('shares', '—'):>9} "
                  f"{res.get('comments', '—'):>8} {res.get('likes', '—'):>6}  {f'{avg / 1000:.1f} s' if isinstance(avg, (int, float)) else '—'}")
        save(arg, d)
    elif command == "watch":
        # The system runs it every hour (watcher install). It does not use Claude: it only reads from Instagram and writes the batch.
        now = dt.datetime.now()
        for path in sorted(REPO.glob("brands/*/finals/*/variations/batch.json")):
            d = json.loads(path.read_text(encoding="utf-8"))
            new = []
            for p in d.get("posts", []):
                if not p.get("media_id") or not p.get("published_at"):
                    continue
                age = (now - dt.datetime.fromisoformat(p["published_at"])).total_seconds() / 3600
                for hours in (24, 72):
                    label = f"{hours}h"
                    if age >= hours and not any(r.get("label") == label for r in p.get("results", [])):
                        try:
                            res = metrics_of(token(d["brand"]), p["media_id"])
                        except SystemExit as e:
                            print(f"{now:%Y-%m-%d %H:%M} {path}: {e}")
                            continue
                        p.setdefault("results", []).append({"label": label, "date": now.isoformat(timespec="minutes"), **res})
                        new.append(f"{p['id']} {label}: {res.get('views', '—')} views")
            if new:
                path.write_text(json.dumps(d, indent=1, ensure_ascii=False), encoding="utf-8")
                print(f"{now:%Y-%m-%d %H:%M} {d['project']}: " + "; ".join(new))
                notify(f"Results for {d['project']}", "; ".join(new)[:200])
        # the pulse of each connected account: metrics of everything posted and of the stories, which only exist for 24 h
        import pulse
        for brand in cfg().get("accounts", {}):
            try:
                n = pulse.collect(brand, quiet=True)
                if n:
                    print(f"{now:%Y-%m-%d %H:%M} pulse {brand}: {n} new snapshots")
            except (SystemExit, RuntimeError, OSError) as e:
                print(f"{now:%Y-%m-%d %H:%M} pulse {brand}: {e}")

    elif command == "watcher":
        action = arg or "status"
        if action not in ("install", "remove", "status"):
            sys.exit(__doc__)
        r = system.hourly_task(action, TASK, __file__, ["watch"], WATCHER_LOG)
        if action == "install":
            print(f"Watcher installed: it runs every hour with {r}. Log: {WATCHER_LOG}")
        elif action == "remove":
            print("Watcher removed.")
        else:
            print(r)
            if WATCHER_LOG.exists():
                print("last log line:", (WATCHER_LOG.read_text(encoding="utf-8", errors="replace").strip().splitlines() or ["(empty)"])[-1])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
