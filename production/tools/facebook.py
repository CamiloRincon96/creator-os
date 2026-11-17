"""Facebook through Meta's official API: posts Reels on the brand's page and brings back their metrics.

    python3 production/tools/facebook.py connect <brand>      # finds the page with the Instagram token
    python3 production/tools/facebook.py test <brand>         # page, followers and quota
    python3 production/tools/facebook.py upload <brand> <video.mp4> --approved "<what the creator said>" [--copy "..."]
            [--schedule 2026-11-20T18:00:00-05:00] [--draft] [--ai]
    python3 production/tools/facebook.py reels <brand> [n]    # the page's last n reels with their metrics

It uses the same Meta app and the same token (system user) as instagram.py: you only add the page and three
permissions to it (production/FACEBOOK.md; /creator-connect does it with the person). The page's token comes from
there each time; it is not saved separately.
- Reels of 3 to 90 seconds, 9:16 (1080 x 1920 recommended), 24 to 60 frames per second. At most 30 a day per page.
- `--schedule` lets Facebook publish it by itself at that time (from 10 minutes to 29 days ahead): the computer can be
  off. `--draft` leaves it in the page's drafts.
- What is posted is visible to everyone only if the Meta app is "published" (Live). In development mode only people
  with a role in the app see it: step 5 of production/FACEBOOK.md.

RULE: nothing is uploaded without the creator's yes in the chat for that video. `upload` requires --approved with what
they said, and logs it.
"""
import system

system.prepare(args=2)

import datetime as dt  # noqa: E402
import json  # noqa: E402
import sys  # noqa: E402
import time  # noqa: E402
import urllib.request  # noqa: E402
from pathlib import Path  # noqa: E402

import instagram as ig  # noqa: E402
import networks  # noqa: E402

METRICS = ["blue_reels_play_count", "fb_reels_total_plays", "post_impressions_unique", "post_video_avg_time_watched",
           "post_video_followers", "post_video_social_actions"]


def page(brand):
    c = networks.account(brand, "facebook")
    if not c:
        sys.exit(f"{brand}'s Facebook page is not connected: {system.PY} production/tools/facebook.py connect {brand}")
    tok = ig.token(brand)
    p = ig.api("GET", c["page_id"], tok, {"fields": "access_token,name"})
    if not p.get("access_token"):
        sys.exit("The token has no permission over the page: in the system user, assign it the page with \"Content\" and "
                 "\"Insights\" and generate the token again with pages_manage_posts (production/FACEBOOK.md, steps 2 and 3).")
    return c["page_id"], p["access_token"]


def connect(brand):
    tok = ig.token(brand)
    r = ig.api("GET", "me/accounts", tok, {"fields": "id,name,tasks,instagram_business_account{username}"})
    pages = r.get("data", [])
    if not pages:
        sys.exit("The token sees no page. In the business settings -> System users -> the user -> "
                 "Assign assets -> Pages: pick the page with \"Content\" and \"Insights\" (production/FACEBOOK.md, step 2).")
    ig_user = (ig.cfg().get("accounts", {}).get(brand) or {}).get("username", "")
    chosen = next((p for p in pages if (p.get("instagram_business_account") or {}).get("username", "").lower() == ig_user.lower()),
                  pages[0])
    for p in pages:
        print(f"  page \"{p['name']}\" (id {p['id']}){'  <- the one for @' + ig_user if p is chosen and ig_user else ''}")
    tasks = set(chosen.get("tasks", []))
    if not tasks & {"CREATE_CONTENT", "MANAGE"}:
        print("Warning: on that page the system user cannot create content: assign it \"Content\" (step 2).")
    networks.note(brand, "facebook", {"page": chosen["name"], "page_id": chosen["id"]})
    print(f"Facebook connected for {brand}: page \"{chosen['name']}\".")


def test(brand):
    pid, ptok = page(brand)
    p = ig.api("GET", pid, ptok, {"fields": "name,followers_count,fan_count,link"})
    print(f"\"{p.get('name')}\": {p.get('followers_count', p.get('fan_count'))} followers · {p.get('link', '')}. Quota: 30 reels a day per page.")


def upload(brand, video, approved, copy="", schedule="", draft=False, ai=False):
    video = Path(video).resolve()
    if not video.is_file():
        sys.exit(f"The video does not exist: {video}")
    if not approved.strip():
        sys.exit("Missing --approved \"<what the creator said in the chat>\": nothing is uploaded without their yes for this video.")
    pid, ptok = page(brand)
    start = ig.api("POST", f"{pid}/video_reels", ptok, {"upload_phase": "start"})
    vid, target = start["video_id"], start["upload_url"]
    size = video.stat().st_size
    with open(video, "rb") as f:
        req = urllib.request.Request(target, data=f, method="POST",
                                     headers={"Authorization": f"OAuth {ptok}", "offset": "0", "file_size": str(size), "Content-Length": str(size)})
        with urllib.request.urlopen(req, timeout=1800) as r:
            sent = json.loads(r.read().decode("utf-8") or "{}")
    if not sent.get("success", True):
        raise RuntimeError(f"the upload failed: {sent}")
    data = {"upload_phase": "finish", "video_id": vid, "description": copy}
    if ai:
        data["is_ai_generated"] = "true"
    if schedule:
        when = dt.datetime.fromisoformat(schedule)
        data.update({"video_state": "SCHEDULED", "scheduled_publish_time": str(int(when.timestamp()))})
    else:
        data["video_state"] = "DRAFT" if draft else "PUBLISHED"
    done = ig.api("POST", f"{pid}/video_reels", ptok, data)
    if not done.get("success", True):
        raise RuntimeError(f"Facebook did not post the reel: {done}")
    status = {}
    for _ in range(40):  # up to 10 minutes of processing
        status = ig.api("GET", vid, ptok, {"fields": "status,permalink_url"})
        phase = (status.get("status") or {}).get("video_status", "")
        if phase in ("ready", "published", "scheduled") or (status.get("status") or {}).get("publishing_phase", {}).get("status") == "complete":
            break
        if phase == "error":
            raise RuntimeError(f"Facebook did not process the video: {status.get('status')}")
        time.sleep(15)
    link = status.get("permalink_url", "")
    if link.startswith("/"):
        link = "https://www.facebook.com" + link
    networks.log(brand, "facebook", {"video": str(video), "id": vid, "link": link, "scheduled": schedule,
                                     "draft": draft, "approved": approved})
    print(f"Reel {'scheduled for ' + schedule if schedule else 'in drafts' if draft else 'posted'}: {link or vid}")


def reels(brand, n):
    pid, ptok = page(brand)
    r = ig.api("GET", f"{pid}/video_reels", ptok, {"fields": "id,description,created_time,permalink_url", "limit": n})
    print(f"{'date':10} {'plays':>9} {'reach':>7} {'avg s':>6} {'follow':>6}  text")
    for v in r.get("data", [])[:n]:
        m = {}
        try:
            ins = ig.api("GET", f"{v['id']}/video_insights", ptok, {"metric": ",".join(METRICS)})
            m = {x["name"]: x["values"][0]["value"] for x in ins.get("data", []) if x.get("values")}
        except RuntimeError:
            pass
        avg = m.get("post_video_avg_time_watched")
        print(f"{v.get('created_time', '')[:10]:10} {m.get('fb_reels_total_plays', m.get('blue_reels_play_count', '—')):>9} "
              f"{m.get('post_impressions_unique', '—'):>7} {f'{avg / 1000:.1f}' if isinstance(avg, (int, float)) else '—':>6} "
              f"{m.get('post_video_followers', '—'):>6}  {(v.get('description') or '').split(chr(10))[0][:50]}")


def main():
    command, brand, op = sys.argv[1], sys.argv[2], sys.argv[3:]

    def option(name, default=""):
        return op[op.index(name) + 1] if name in op and op.index(name) + 1 < len(op) else default

    if command == "connect":
        connect(brand)
    elif command == "test":
        test(brand)
    elif command == "upload":
        if not op or op[0].startswith("--"):
            sys.exit(__doc__)
        upload(brand, op[0], option("--approved"), option("--copy"), option("--schedule"), "--draft" in op, "--ai" in op)
    elif command == "reels":
        reels(brand, int(op[0]) if op else 10)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
