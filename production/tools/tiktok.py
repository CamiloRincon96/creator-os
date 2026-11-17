"""TikTok through its official API: sends the video to the account's TikTok drafts and brings back its metrics.

    python3 production/tools/tiktok.py connect <brand>        # once: opens TikTok to sign in and accept
    python3 production/tools/tiktok.py test <brand>           # account, followers and videos (checks the connection)
    python3 production/tools/tiktok.py upload <brand> <video.mp4> --approved "<what the creator said>"
    python3 production/tools/tiktok.py status <brand> <publish_id>   # has it been posted from the app yet?
    python3 production/tools/tiktok.py videos <brand> [n]     # the last n public videos with views, likes...

How it works (the step-by-step guide is production/TIKTOK.md; /creator-connect follows it with the person):
- Each person creates their own app on developers.tiktok.com, in Sandbox (test) mode, and adds themselves as a test
  user. TikTok does not approve apps for personal use, and Sandbox needs no review.
- The person saves that app's key and secret, in their own terminal:
      python3 production/tools/save_token.py --tiktok <brand>
- `connect` opens TikTok in the browser; the person signs in and accepts; TikTok comes back to
  http://127.0.0.1:8370/callback/ and the keys go in the system's store (oauth.py). They renew themselves.
- `upload` sends the video to the TikTok DRAFTS (Upload / inbox): the person gets a notification in the app, and from
  there writes the text, picks the sound (a trending one too) and posts. At most 5 pending drafts in 24 hours.
  The text (copy) is printed to copy it: this way of uploading does not carry it.

RULE: nothing is uploaded without the creator's yes in the chat for that video. `upload` requires --approved with what
they said, and logs it.
"""
import system

system.prepare(args=2)

import datetime as dt  # noqa: E402
import json  # noqa: E402
import os  # noqa: E402
import sys  # noqa: E402
import time  # noqa: E402
import urllib.request  # noqa: E402
from pathlib import Path  # noqa: E402

import networks  # noqa: E402
import oauth  # noqa: E402

AUTHORIZE = os.environ.get("TIKTOK_AUTH_TEST", "https://www.tiktok.com/v2/auth/authorize/")
API = os.environ.get("TIKTOK_API_TEST", "https://open.tiktokapis.com")  # *_TEST: only for the test with a fake server
REDIRECT = os.environ.get("TIKTOK_REDIRECT_TEST", "http://127.0.0.1:8370/callback/")
SCOPES = "user.info.basic,user.info.profile,user.info.stats,video.upload,video.list"
MB = 1_000_000


def app(brand):
    data = oauth.read_keys(f"{brand}-tiktok-app")
    if not data:
        sys.exit(f"{brand}'s TikTok app key is missing. Save it yourself, in your own terminal:\n"
                 f"  {system.PY} production/tools/save_token.py --tiktok {brand}\n(see production/TIKTOK.md)")
    return data


def keys(brand):
    """The current keys: if the access one expired, it renews it (TikTok also changes the refresh one: the new one is saved)."""
    t = oauth.read_keys(f"{brand}-tiktok")
    if not t:
        sys.exit(f"{brand}'s TikTok is not connected: {system.PY} production/tools/tiktok.py connect {brand}")
    if time.time() < t.get("expires", 0) - 120:
        return t
    a = app(brand)
    r = oauth.send(f"{API}/v2/oauth/token/", {"client_key": a["client_key"], "client_secret": a["client_secret"],
                                              "grant_type": "refresh_token", "refresh_token": t["refresh_token"]},
                   hide=(a["client_secret"], t["refresh_token"]))
    if not r.get("access_token"):
        sys.exit(f"TikTok did not renew the connection ({r.get('error_description') or r.get('error')}). Connect again: "
                 f"{system.PY} production/tools/tiktok.py connect {brand}")
    return save(brand, r)


def save(brand, r):
    t = {"access_token": r["access_token"], "refresh_token": r["refresh_token"], "open_id": r.get("open_id"),
         "expires": time.time() + int(r.get("expires_in", 7200)),
         "refresh_until": time.time() + int(r.get("refresh_expires_in", 180 * 86400)), "scopes": r.get("scope", "")}
    oauth.save_keys(f"{brand}-tiktok", t)
    return t


def call(brand, path, body=None, fields=None, method="POST"):
    t = keys(brand)
    url = f"{API}{path}" + (f"?fields={fields}" if fields else "")
    r = oauth.send(url, method=method, headers={"Authorization": f"Bearer {t['access_token']}"},
                   json_body=body if method == "POST" else None, hide=(t["access_token"],))
    err = r.get("error") or {}
    if err.get("code") not in (None, "ok"):
        raise RuntimeError(f"TikTok {path}: {err.get('code')} {err.get('message', '')}")
    return r.get("data") or {}


def connect(brand):
    a = app(brand)
    verifier, _ = oauth.pkce()
    import hashlib
    challenge = hashlib.sha256(verifier.encode()).hexdigest()  # TikTok wants the challenge in hexadecimal, not base64
    code = oauth.ask_code(AUTHORIZE, {"client_key": a["client_key"], "response_type": "code", "scope": SCOPES,
                                      "code_challenge": challenge, "code_challenge_method": "S256"},
                          REDIRECT, "TikTok")
    r = oauth.send(f"{API}/v2/oauth/token/", {"client_key": a["client_key"], "client_secret": a["client_secret"], "code": code,
                                              "grant_type": "authorization_code", "redirect_uri": REDIRECT,
                                              "code_verifier": verifier}, hide=(a["client_secret"],))
    if not r.get("access_token"):
        sys.exit(f"TikTok did not hand over the keys: {r.get('error_description') or r.get('error') or r}")
    missing = [s for s in SCOPES.split(",") if s not in r.get("scope", "")]
    t = save(brand, r)
    info = call(brand, "/v2/user/info/", fields="display_name,username", method="GET").get("user", {})
    networks.note(brand, "tiktok", {"username": info.get("username") or info.get("display_name"), "open_id": t["open_id"]})
    print(f"TikTok connected for {brand}: @{info.get('username') or info.get('display_name')}.")
    if missing:
        print(f"Warning: TikTok did not grant these permissions: {', '.join(missing)}. Check the app's \"Scopes\" (production/TIKTOK.md, step 8).")


def test(brand):
    u = call(brand, "/v2/user/info/", fields="display_name,username,follower_count,following_count,likes_count,video_count",
             method="GET").get("user", {})
    t = oauth.read_keys(f"{brand}-tiktok")
    days = (t.get("refresh_until", 0) - time.time()) / 86400
    print(f"@{u.get('username') or u.get('display_name')}: {u.get('follower_count')} followers, {u.get('video_count')} videos, "
          f"{u.get('likes_count')} likes. The connection keeps going on its own while it is used; after {days:.0f} days without use, connect again.")


def upload(brand, video, approved, copy=""):
    video = Path(video).resolve()
    if not video.is_file():
        sys.exit(f"The video does not exist: {video}")
    if not approved.strip():
        sys.exit("Missing --approved \"<what the creator said in the chat>\": nothing is uploaded without their yes for this video.")
    size = video.stat().st_size
    chunk = size if size <= 64 * MB else 10 * MB  # TikTok: chunks of 5 to 64 MB; the last one takes what is left
    n = max(1, size // chunk)
    d = call(brand, "/v2/post/publish/inbox/video/init/",
             {"source_info": {"source": "FILE_UPLOAD", "video_size": size, "chunk_size": chunk, "total_chunk_count": n}})
    pid, target = d["publish_id"], d["upload_url"]
    kind = {".mov": "video/quicktime", ".webm": "video/webm"}.get(video.suffix.lower(), "video/mp4")
    with open(video, "rb") as f:
        for i in range(n):
            start = i * chunk
            end = size - 1 if i == n - 1 else start + chunk - 1
            f.seek(start)
            part = f.read(end - start + 1)
            req = urllib.request.Request(target, data=part, method="PUT", headers={
                "Content-Type": kind, "Content-Length": str(len(part)), "Content-Range": f"bytes {start}-{end}/{size}"})
            with urllib.request.urlopen(req, timeout=600) as r:
                if r.status not in (200, 201, 206):
                    raise RuntimeError(f"TikTok did not receive chunk {i + 1} of {n} (HTTP {r.status})")
            print(f"  uploaded {end + 1:,} of {size:,} bytes", flush=True)
    status = wait(brand, pid, until=("SEND_TO_USER_INBOX", "PUBLISH_COMPLETE", "FAILED"))
    networks.log(brand, "tiktok", {"video": str(video), "publish_id": pid, "status": status.get("status"), "approved": approved, "copy": copy})
    if status.get("status") == "FAILED":
        sys.exit(f"TikTok did not accept it: {status.get('fail_reason')}")
    print(f"Done: the video is in the TikTok drafts (publish_id {pid}).\n"
          "On the phone: open TikTok -> the \"your video is ready\" notification (or Profile -> Drafts), pick the sound, "
          "paste the text and post." + (f"\nText to paste:\n{copy}" if copy else ""))


def wait(brand, pid, until, minutes=5):
    end = time.time() + minutes * 60
    while True:
        s = call(brand, "/v2/post/publish/status/fetch/", {"publish_id": pid})
        if s.get("status") in until or time.time() > end:
            return s
        time.sleep(5)


def videos(brand, n):
    d = call(brand, "/v2/video/list/", {"max_count": min(20, n)},
             fields="id,create_time,title,video_description,duration,view_count,like_count,comment_count,share_count,share_url")
    found = d.get("videos", [])[:n]
    print(f"{'date':10} {'views':>7} {'likes':>6} {'comms':>6} {'shares':>7}  text")
    for v in found:
        date = dt.datetime.fromtimestamp(v.get("create_time", 0)).strftime("%Y-%m-%d")
        text = (v.get("title") or v.get("video_description") or "").split("\n")[0][:60]
        print(f"{date:10} {v.get('view_count', 0):>7} {v.get('like_count', 0):>6} {v.get('comment_count', 0):>6} {v.get('share_count', 0):>7}  {text}")
    if not found:
        print("TikTok returned no public videos for this account (private ones and drafts do not show up).")


def main():
    command, brand = sys.argv[1], sys.argv[2]
    op = sys.argv[3:]

    def option(name, default=""):
        return op[op.index(name) + 1] if name in op and op.index(name) + 1 < len(op) else default

    if command == "connect":
        connect(brand)
    elif command == "test":
        test(brand)
    elif command == "upload":
        if not op or op[0].startswith("--"):
            sys.exit(__doc__)
        upload(brand, op[0], option("--approved"), option("--copy"))
    elif command == "status":
        if not op:
            sys.exit(__doc__)
        s = call(brand, "/v2/post/publish/status/fetch/", {"publish_id": op[0]})
        ids = s.get("publicaly_available_post_id") or []  # TikTok spells it this way
        print(json.dumps({"status": s.get("status"), "published": ids, "reason": s.get("fail_reason")}, ensure_ascii=False))
    elif command == "videos":
        videos(brand, int(op[0]) if op else 10)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
