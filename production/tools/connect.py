"""Connecting a brand's networks, hand in hand: what is missing and the exact page for each step. Used by /creator-connect.

    python3 production/tools/connect.py status [brand]          # which network is connected and what comes next
    python3 production/tools/connect.py open <step>             # opens that step's page in the browser
    python3 production/tools/connect.py steps                   # every step with its page

The full guides: production/INSTAGRAM.md, FACEBOOK.md, YOUTUBE.md and TIKTOK.md. This tool saves no passwords or
keys: the person types them on the official page or with save_token.py, in their own terminal.
"""
import system

system.prepare()

import json  # noqa: E402
import sys  # noqa: E402
import webbrowser  # noqa: E402

import networks  # noqa: E402
import oauth  # noqa: E402

# the official page for each step (checked on 16 Nov 2026; if one changes, fix it here and in the guide)
STEPS = {
    "instagram-professional": ("Instagram: switch the account to professional (Creator or Business)", "https://help.instagram.com/502981923235522"),
    "facebook-link": ("Facebook: link the page with Instagram (Settings -> Linked accounts)", "https://www.facebook.com/help/1148909221857370"),
    "meta-portfolio": ("Meta Business Suite: the business portfolio with the page and the Instagram account", "https://business.facebook.com/latest/settings"),
    "meta-app": ("Meta for Developers: create the app", "https://developers.facebook.com/apps/creation/"),
    "meta-apps": ("Meta for Developers: your apps", "https://developers.facebook.com/apps/"),
    "meta-system-user": ("Meta Business Suite: Settings -> Users -> System users", "https://business.facebook.com/latest/settings"),
    "google-project": ("Google Cloud: create the project", "https://console.cloud.google.com/projectcreate"),
    "google-apis": ("Google Cloud: turn on YouTube Data API v3 and YouTube Analytics API", "https://console.cloud.google.com/apis/library?filter=category:youtube"),
    "google-branding": ("Google Auth Platform: Branding (the app's name and email)", "https://console.cloud.google.com/auth/branding"),
    "google-audience": ("Google Auth Platform: Audience (External and \"Publish app\")", "https://console.cloud.google.com/auth/audience"),
    "google-client": ("Google Auth Platform: Clients -> Create client -> Desktop app", "https://console.cloud.google.com/auth/clients"),
    "google-2fa": ("Google: turn on 2-Step Verification (Google Cloud asks for it)", "https://myaccount.google.com/signinoptions/two-step-verification"),
    "tiktok-account": ("TikTok for Developers: create the developer account", "https://developers.tiktok.com/signup"),
    "tiktok-apps": ("TikTok for Developers: Manage apps -> Connect an app", "https://developers.tiktok.com/portal/apps"),
}

NETWORKS = ("instagram", "facebook", "youtube", "tiktok")


def status_of(brand, network):
    """(connected, what comes next)."""
    if network == "instagram":
        has_token = bool(system.read_secret(f"{brand}-instagram", "token"))
        config = networks.REPO / "production" / "instagram.json"
        account = json.loads(config.read_text(encoding="utf-8")).get("accounts", {}).get(brand) if config.exists() else None
        if account and has_token:
            return True, f"@{account.get('username')}"
        if not has_token:
            return False, f"save the token: {system.PY} production/tools/save_token.py {brand} (INSTAGRAM.md, step 6)"
        return False, f"{system.PY} production/tools/instagram.py connect {brand}"
    if network == "facebook":
        c = networks.account(brand, "facebook")
        if c:
            return True, f"page \"{c.get('page')}\""
        if not system.read_secret(f"{brand}-instagram", "token"):
            return False, "Instagram first (it uses the same app and the same token)"
        return False, f"add the page and the permissions (FACEBOOK.md) and then {system.PY} production/tools/facebook.py connect {brand}"
    if network == "youtube":
        if networks.account(brand, "youtube") and oauth.read_keys(f"{brand}-youtube"):
            return True, f"channel \"{networks.account(brand, 'youtube').get('channel')}\""
        if not oauth.read_keys(f"{brand}-youtube-app"):
            return False, "create the project and the client in Google Cloud (YOUTUBE.md, steps 1 to 6)"
        return False, f"{system.PY} production/tools/youtube.py connect {brand}"
    if network == "tiktok":
        if networks.account(brand, "tiktok") and oauth.read_keys(f"{brand}-tiktok"):
            return True, f"@{networks.account(brand, 'tiktok').get('username')}"
        if not oauth.read_keys(f"{brand}-tiktok-app"):
            return False, f"create the app on TikTok for Developers (TIKTOK.md) and save its key: {system.PY} production/tools/save_token.py --tiktok {brand}"
        return False, f"{system.PY} production/tools/tiktok.py connect {brand}"
    return False, "unknown network"


def brands():
    seen = set(networks.read())
    for p in (networks.REPO / "brands").iterdir() if (networks.REPO / "brands").exists() else []:
        if p.is_dir() and (p / "PROFILE.md").exists():
            seen.add(p.name)
    return sorted(seen)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    command = sys.argv[1]
    if command == "status":
        found = [sys.argv[2]] if len(sys.argv) > 2 else brands()
        if not found:
            sys.exit("There are no brands yet: create one with /creator-brand.")
        for b in found:
            print(f"{b}:")
            for network in NETWORKS:
                ok, what = status_of(b, network)
                print(f"  {'✓' if ok else '·'} {network:9} {what}")
    elif command == "open":
        if len(sys.argv) < 3 or sys.argv[2] not in STEPS:
            sys.exit("Steps: " + ", ".join(STEPS))
        title, url = STEPS[sys.argv[2]]
        print(f"{title}\n  {url}")
        try:
            webbrowser.open(url)
        except Exception:  # noqa: BLE001
            pass
    elif command == "steps":
        for key, (title, url) in STEPS.items():
            print(f"{key:22} {title}\n{'':22} {url}")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
