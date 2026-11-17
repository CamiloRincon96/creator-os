"""What youtube.py, tiktok.py, facebook.py and connect.py share: which account on each network each brand has, and
the log of what was uploaded and who said yes.

- production/networks.json: the public data of each connection (username, channel or page id). Never keys: those go
  in the system's store (oauth.py, system.py).
- brands/<brand>/pulse/uploads.jsonl: one line per uploaded video, with the network, the file, the id and what the
  creator said when approving it.
"""
import datetime as dt
import json
import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CONFIG = Path(os.environ.get("NETWORKS_CONFIG_TEST") or REPO / "production" / "networks.json")  # *_TEST: only the tests
LOGS = Path(os.environ.get("NETWORKS_LOG_TEST") or REPO / "brands")


def read():
    return json.loads(CONFIG.read_text(encoding="utf-8")) if CONFIG.exists() else {}


def account(brand, network):
    return read().get(brand, {}).get(network)


def note(brand, network, data):
    c = read()
    c.setdefault(brand, {})[network] = {**data, "connected": dt.date.today().isoformat()}
    CONFIG.write_text(json.dumps(c, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def log(brand, network, data):
    file = LOGS / brand / "pulse" / "uploads.jsonl"
    file.parent.mkdir(parents=True, exist_ok=True)
    line = {"date": dt.datetime.now().isoformat(timespec="seconds"), "network": network, **data}
    with open(file, "a", encoding="utf-8") as f:
        f.write(json.dumps(line, ensure_ascii=False) + "\n")
