"""Signing in to a network (YouTube, TikTok...) from the computer, without copying or pasting codes.

Used by youtube.py and tiktok.py. It opens the network's page in the browser; the person signs in with their account
and accepts; the network sends the browser back to an address on this same computer (http://127.0.0.1:<port>/...), where
this tool receives the code and exchanges it for the keys. The keys go in the system's secure store
(system.save_secret): the macOS keychain, the Windows Credential Manager or secret-tool on Linux.
Claude never sees passwords: the person types them on the network's official page.
It only uses the standard library.
"""
import base64
import hashlib
import html
import json
import os
import secrets
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import system

DONE = """<!doctype html><meta charset="utf-8"><title>{title}</title>
<body style="font:18px/1.5 system-ui,sans-serif;max-width:34em;margin:4em auto;padding:0 1em;color:#111">
<h1 style="font-size:1.4em">{title}</h1><p>{text}</p></body>"""


def pkce():
    """(verifier, S256 challenge) for PKCE: the proof that whoever asks for the keys is whoever opened the page."""
    verifier = secrets.token_urlsafe(64)[:96]
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def ask_code(auth_url, params, redirect_uri, network, minutes=10):
    """Opens the network's page, waits for the person to accept and returns the authorization code.
    `redirect_uri` must be http://127.0.0.1:<port>/<path> (or localhost) and be registered in the network's app."""
    target = urllib.parse.urlsplit(redirect_uri)
    state = secrets.token_urlsafe(24)
    url = auth_url + "?" + urllib.parse.urlencode({**params, "redirect_uri": redirect_uri, "state": state})
    result = {}

    class Receive(BaseHTTPRequestHandler):
        def do_GET(self):  # noqa: N802
            parts = urllib.parse.urlsplit(self.path)
            if parts.path.rstrip("/") != target.path.rstrip("/"):
                self.send_response(404)
                self.end_headers()
                return
            q = dict(urllib.parse.parse_qsl(parts.query))
            if q.get("state") != state:
                title, text = "Something does not match", "This answer does not belong to this connection. Close this tab and try again."
            elif q.get("error"):
                result["error"] = q.get("error_description") or q["error"]
                title, text = f"{network}: not connected", f"{html.escape(result['error'])}. You can close this tab."
            elif q.get("code"):
                result["code"] = q["code"]
                title, text = f"{network} is connected", "You can close this tab and go back to the conversation."
            else:
                title, text = "The code is missing", "The network did not send the code. Close this tab and try again."
            body = DONE.format(title=html.escape(title), text=text).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):  # no noise in the terminal
            pass

    server = ThreadingHTTPServer((target.hostname, target.port or 80), Receive)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"Opening {network} in the browser. If it does not open, copy this address into the browser:\n  {url}\n", flush=True)
    if os.environ.get("OAUTH_BROWSER_TEST"):  # only in the tests: a "browser" that follows the redirect by itself
        threading.Thread(target=lambda: urllib.request.urlopen(url, timeout=30).read(), daemon=True).start()
    else:
        try:
            webbrowser.open(url)
        except Exception:  # noqa: BLE001  (no browser: the person uses the printed address)
            pass
    deadline = time.time() + minutes * 60
    try:
        while time.time() < deadline and not result:
            time.sleep(0.3)
    finally:
        server.shutdown()
        server.server_close()
    if result.get("error"):
        raise SystemExit(f"{network} did not give permission: {result['error']}")
    if not result.get("code"):
        raise SystemExit(f"{minutes} minutes went by without an answer from {network}. Run the command again when you have the browser at hand.")
    return result["code"]


def send(url, data=None, method="POST", headers=None, json_body=None, hide=()):
    """An HTTP call that returns JSON. The secrets in `hide` never show up in the error messages."""
    head = dict(headers or {})
    body = None
    if json_body is not None:
        body = json.dumps(json_body).encode("utf-8")
        head.setdefault("Content-Type", "application/json; charset=UTF-8")
    elif data is not None and method != "GET":
        body = urllib.parse.urlencode(data).encode("utf-8")
        head.setdefault("Content-Type", "application/x-www-form-urlencoded")
    elif data:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(data)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body, method=method, headers=head), timeout=120) as r:
            text = r.read().decode("utf-8") or "{}"
            return json.loads(text)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")
        for s in hide:
            if s:
                detail = detail.replace(s, "<secret>")
        raise RuntimeError(f"{method} {urllib.parse.urlsplit(url).path}: HTTP {e.code} {detail[:600]}") from None


def save_keys(service, data):
    """Saves the bundle of keys (JSON) in the system's store. With no store (Linux without secret-tool), it says so."""
    where = system.save_secret(service, "oauth", json.dumps(data, separators=(",", ":")))
    if where is None:
        raise SystemExit("This system has no secret store: install libsecret-tools (secret-tool) and connect again.")
    return where


def read_keys(service):
    text = system.read_secret(service, "oauth")
    if not text:
        return None
    try:
        return json.loads(text)
    except ValueError:
        return None
