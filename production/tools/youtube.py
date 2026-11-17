"""YouTube through its official API: uploads Shorts to the brand's channel and brings back their metrics.

    python3 production/tools/youtube.py connect <brand> --client <client_secret....json>   # once
    python3 production/tools/youtube.py test <brand>          # channel, subscribers and videos
    python3 production/tools/youtube.py upload <brand> <video.mp4> --title "..." --privacy public|unlisted|private
            --approved "<what the creator said>" [--copy "description"] [--schedule 2026-11-20T18:00:00-05:00] [--ai] [--made-for-kids]
    python3 production/tools/youtube.py videos <brand> [n]    # the last n videos with views, retention...

How it works (the step-by-step guide is production/YOUTUBE.md; /creator-connect follows it with the person):
- Each person creates their own project in Google Cloud (free), turns on "YouTube Data API v3" and "YouTube Analytics
  API", leaves the app published and unverified (in "Testing" the connection expires every 7 days) and creates a
  "Desktop app" client. The JSON file it downloads is used once with `connect --client`: the tool saves its content in
  the system's store and the file can be deleted.
- `connect` opens Google in the browser; the person picks the account and the channel, gets past the "unverified app"
  screen (it is their own app) and ticks every permission. Google comes back to http://127.0.0.1:<port>.
- A vertical or square video of up to 3 minutes becomes a Short. Since Nov 2026 what an unverified app uploads is no
  longer forced to private; the quota is 100 uploads a day per project.
- `--schedule` leaves the video private and YouTube publishes it by itself at that time: the computer can be off.

RULE: nothing is uploaded without the creator's yes in the chat for that video. `upload` requires --approved with what
they said, and logs it.
"""
import system

system.prepare(args=2)

import json  # noqa: E402
import os  # noqa: E402
import sys  # noqa: E402
import time  # noqa: E402
import urllib.error  # noqa: E402
import urllib.parse  # noqa: E402
import urllib.request  # noqa: E402
from datetime import date, timedelta  # noqa: E402
from pathlib import Path  # noqa: E402

import networks  # noqa: E402
import oauth  # noqa: E402

AUTHORIZE = os.environ.get("YOUTUBE_AUTH_TEST", "https://accounts.google.com/o/oauth2/v2/auth")
TOKEN = os.environ.get("YOUTUBE_TOKEN_TEST", "https://oauth2.googleapis.com/token")
API = os.environ.get("YOUTUBE_API_TEST", "https://www.googleapis.com/youtube/v3")  # *_TEST: only for the test
UPLOAD = os.environ.get("YOUTUBE_UPLOAD_TEST", "https://www.googleapis.com/upload/youtube/v3/videos")
ANALYTICS = os.environ.get("YOUTUBE_ANALYTICS_TEST", "https://youtubeanalytics.googleapis.com/v2/reports")
SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly",
          "https://www.googleapis.com/auth/yt-analytics.readonly"]


def app(brand):
    a = oauth.read_keys(f"{brand}-youtube-app")
    if not a:
        sys.exit(f"{brand}'s Google client is missing: {system.PY} production/tools/youtube.py connect {brand} "
                 "--client <the client_secret....json file you downloaded> (see production/YOUTUBE.md)")
    return a


def import_client(brand, file):
    try:
        d = json.loads(Path(file).expanduser().read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        sys.exit(f"Could not read {file}: {e}")
    c = d.get("installed")
    if not c:
        kind = next(iter(d), "?")
        sys.exit(f"That client is of type \"{kind}\". It has to be \"Desktop app\" (production/YOUTUBE.md, step 6).")
    oauth.save_keys(f"{brand}-youtube-app", {"client_id": c["client_id"], "client_secret": c.get("client_secret", "")})
    print("Google client saved in the system's store. You can now delete the JSON file from Downloads.")


def keys(brand):
    t = oauth.read_keys(f"{brand}-youtube")
    if not t:
        sys.exit(f"{brand}'s YouTube is not connected: {system.PY} production/tools/youtube.py connect {brand}")
    if time.time() < t.get("expires", 0) - 120:
        return t
    a = app(brand)
    try:
        r = oauth.send(TOKEN, {"client_id": a["client_id"], "client_secret": a["client_secret"], "grant_type": "refresh_token",
                               "refresh_token": t["refresh_token"]}, hide=(a["client_secret"], t["refresh_token"]))
    except RuntimeError as e:
        if "invalid_grant" in str(e):
            sys.exit("Google no longer accepts the connection (the permission was removed, 6 months went by without use or the app "
                     f"is in \"Testing\"). Connect again: {system.PY} production/tools/youtube.py connect {brand}")
        raise
    t.update({"access_token": r["access_token"], "expires": time.time() + int(r.get("expires_in", 3600))})
    oauth.save_keys(f"{brand}-youtube", t)
    return t


def call(brand, url, data=None, method="GET", json_body=None):
    t = keys(brand)
    return oauth.send(url, data, method=method, json_body=json_body,
                      headers={"Authorization": f"Bearer {t['access_token']}"}, hide=(t["access_token"],))


def connect(brand, client):
    if client:
        import_client(brand, client)
    a = app(brand)
    verifier, challenge = oauth.pkce()
    redirect = f"http://127.0.0.1:{oauth.free_port()}/"
    code = oauth.ask_code(AUTHORIZE, {"client_id": a["client_id"], "response_type": "code", "scope": " ".join(SCOPES),
                                      "code_challenge": challenge, "code_challenge_method": "S256",
                                      "access_type": "offline", "prompt": "consent"}, redirect, "YouTube")
    r = oauth.send(TOKEN, {"client_id": a["client_id"], "client_secret": a["client_secret"], "code": code,
                           "code_verifier": verifier, "grant_type": "authorization_code", "redirect_uri": redirect},
                   hide=(a["client_secret"],))
    if not r.get("refresh_token"):
        sys.exit(f"Google did not hand over the refresh key: {r}")
    missing = [s.rsplit("/", 1)[-1] for s in SCOPES if s not in r.get("scope", "")]
    oauth.save_keys(f"{brand}-youtube", {"access_token": r["access_token"], "refresh_token": r["refresh_token"],
                                         "expires": time.time() + int(r.get("expires_in", 3600)), "scopes": r.get("scope", "")})
    channel = (call(brand, f"{API}/channels", {"part": "snippet", "mine": "true"}).get("items") or [{}])[0]
    if not channel.get("id"):
        sys.exit("That Google account has no YouTube channel. Create it on youtube.com (Create a channel) and connect again.")
    networks.note(brand, "youtube", {"channel": channel["snippet"]["title"], "channel_id": channel["id"]})
    print(f"YouTube connected for {brand}: channel \"{channel['snippet']['title']}\".")
    if missing:
        print(f"Warning: you did not tick these permissions: {', '.join(missing)}. Connect again and tick every box.")


def test(brand):
    c = (call(brand, f"{API}/channels", {"part": "snippet,statistics", "mine": "true"}).get("items") or [{}])[0]
    s = c.get("statistics", {})
    print(f"\"{c.get('snippet', {}).get('title')}\": {s.get('subscriberCount')} subscribers, {s.get('videoCount')} videos, "
          f"{s.get('viewCount')} views. Quota: 100 uploads a day per project.")


def upload(brand, video, title, privacy, approved, copy="", schedule="", ai=False, kids=False):
    video = Path(video).resolve()
    if not video.is_file():
        sys.exit(f"The video does not exist: {video}")
    if not approved.strip():
        sys.exit("Missing --approved \"<what the creator said in the chat>\": nothing is uploaded without their yes for this video.")
    if privacy not in ("public", "unlisted", "private"):
        sys.exit("Missing --privacy public|unlisted|private: the creator picks it for each video.")
    title = (title or copy.split("\n")[0]).replace("<", "").replace(">", "").strip()[:100]
    if not title:
        sys.exit("Missing --title (100 characters at most).")
    status = {"privacyStatus": "private" if schedule else privacy, "selfDeclaredMadeForKids": kids,
              "containsSyntheticMedia": ai}
    if schedule:
        status["publishAt"] = schedule
    body = {"snippet": {"title": title, "description": copy, "categoryId": "22"}, "status": status}
    size = video.stat().st_size
    t = keys(brand)
    req = urllib.request.Request(f"{UPLOAD}?uploadType=resumable&part=snippet,status", method="POST",
                                 data=json.dumps(body).encode("utf-8"),
                                 headers={"Authorization": f"Bearer {t['access_token']}", "Content-Type": "application/json; charset=UTF-8",
                                          "X-Upload-Content-Length": str(size), "X-Upload-Content-Type": "video/*"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            session = r.headers["Location"]
    except urllib.error.HTTPError as e:
        sys.exit(f"YouTube did not open the upload: HTTP {e.code} {e.read().decode('utf-8', 'ignore')[:500]}")
    start, result = 0, None
    for attempt in range(5):
        with open(video, "rb") as f:
            f.seek(start)
            head = {"Authorization": f"Bearer {t['access_token']}", "Content-Length": str(size - start), "Content-Type": "video/*"}
            if start:
                head["Content-Range"] = f"bytes {start}-{size - 1}/{size}"
            try:
                with urllib.request.urlopen(urllib.request.Request(session, data=f, method="PUT", headers=head), timeout=3600) as r:
                    result = json.loads(r.read().decode("utf-8"))
                    break
            except urllib.error.HTTPError as e:
                if e.code not in (500, 502, 503, 504, 308):
                    sys.exit(f"YouTube did not accept the video: HTTP {e.code} {e.read().decode('utf-8', 'ignore')[:500]}")
            except (urllib.error.URLError, OSError, TimeoutError):
                pass
        time.sleep(2 ** attempt)  # it dropped: ask how much arrived and carry on from there
        query = urllib.request.Request(session, method="PUT", data=b"", headers={
            "Authorization": f"Bearer {t['access_token']}", "Content-Range": f"bytes */{size}", "Content-Length": "0"})
        try:
            with urllib.request.urlopen(query, timeout=60) as r:
                result = json.loads(r.read().decode("utf-8"))
                break
        except urllib.error.HTTPError as e:
            if e.code != 308:
                sys.exit(f"The upload was lost (HTTP {e.code}): run the command again.")
            got = e.headers.get("Range", "")
            start = int(got.split("-")[-1]) + 1 if got else 0
    if not result or not result.get("id"):
        sys.exit("YouTube did not confirm the upload after 5 attempts: run the command again.")
    vid = result["id"]
    link = f"https://youtube.com/shorts/{vid}"
    networks.log(brand, "youtube", {"video": str(video), "id": vid, "link": link, "privacy": privacy,
                                    "scheduled": schedule, "approved": approved, "title": title})
    print(f"Uploaded: {link} ({'scheduled for ' + schedule if schedule else privacy}). YouTube processes it in a few minutes.")


def videos(brand, n):
    channel = (call(brand, f"{API}/channels", {"part": "contentDetails", "mine": "true"}).get("items") or [{}])[0]
    playlist = channel.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    if not playlist:
        sys.exit("Could not find the channel's videos.")
    items = call(brand, f"{API}/playlistItems", {"part": "contentDetails", "playlistId": playlist, "maxResults": min(50, n)}).get("items", [])
    ids = [i["contentDetails"]["videoId"] for i in items][:n]
    if not ids:
        return print("The channel has no videos yet.")
    data = {v["id"]: v for v in call(brand, f"{API}/videos", {"part": "snippet,statistics,contentDetails", "id": ",".join(ids)}).get("items", [])}
    analytics = {}
    try:
        r = call(brand, ANALYTICS, {"ids": "channel==MINE", "startDate": (date.today() - timedelta(days=365)).isoformat(),
                                    "endDate": date.today().isoformat(), "dimensions": "video", "filters": "video==" + ",".join(ids),
                                    "metrics": "views,engagedViews,averageViewDuration,averageViewPercentage,shares,subscribersGained",
                                    "sort": "-views", "maxResults": len(ids)})
        cols = [c["name"] for c in r.get("columnHeaders", [])]
        analytics = {row[0]: dict(zip(cols, row)) for row in r.get("rows", [])}
    except RuntimeError as e:
        print(f"(no YouTube Analytics: {str(e)[:160]})")
    print(f"{'date':10} {'views':>7} {'avg s':>6} {'% seen':>7} {'shares':>7} {'subs':>5}  title   (Analytics arrives 2-3 days late)")
    for i in ids:
        v, a = data.get(i, {}), analytics.get(i, {})
        print(f"{v.get('snippet', {}).get('publishedAt', '')[:10]:10} {v.get('statistics', {}).get('viewCount', '0'):>7} "
              f"{a.get('averageViewDuration', '—'):>6} {a.get('averageViewPercentage', '—'):>7} {a.get('shares', '—'):>7} "
              f"{a.get('subscribersGained', '—'):>5}  {v.get('snippet', {}).get('title', '')[:50]}")


def main():
    command, brand, op = sys.argv[1], sys.argv[2], sys.argv[3:]

    def option(name, default=""):
        return op[op.index(name) + 1] if name in op and op.index(name) + 1 < len(op) else default

    if command == "connect":
        connect(brand, option("--client"))
    elif command == "test":
        test(brand)
    elif command == "upload":
        if not op or op[0].startswith("--"):
            sys.exit(__doc__)
        upload(brand, op[0], option("--title"), option("--privacy"), option("--approved"), option("--copy"),
               option("--schedule"), "--ai" in op, "--made-for-kids" in op)
    elif command == "videos":
        videos(brand, int(op[0]) if op else 10)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
