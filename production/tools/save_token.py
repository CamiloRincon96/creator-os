"""Saves a token or a key in the system's secure store, without showing it and with no length limit.
The person runs it in their own terminal: Claude neither writes nor sees secrets.

    python3 production/tools/save_token.py <brand>            # the brand's Instagram token
    python3 production/tools/save_token.py --scrapecreators   # the ScrapeCreators key (last30days)
    python3 production/tools/save_token.py --tiktok <brand>   # the TikTok app's key and secret

On Windows: `python` instead of `python3`, in PowerShell or Windows Terminal (not in Git Bash, which does not allow hidden pasting).

Where it goes:
- the Instagram token: the keychain on macOS, the Credential Manager on Windows and secret-tool on Linux
  (without secret-tool, the environment variable <BRAND>_INSTAGRAM_TOKEN);
- the TikTok app's key and secret (Credentials, on developers.tiktok.com): in the same store;
- the ScrapeCreators key, where last30days looks for it: the keychain on macOS; on Linux, pass (encrypted) if it's set up;
  otherwise, and on Windows, the file ~/.config/last30days/.env, unencrypted (last30days doesn't read the Credential Manager
  or secret-tool, so it wouldn't work there).
A bare `security add-generic-password -w` cuts what you paste at 128 characters, and a Meta token is about 200: hence this tool.
"""
import system

system.prepare()

import getpass  # noqa: E402
import os  # noqa: E402
import re  # noqa: E402
import shutil  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
from pathlib import Path  # noqa: E402


def ask(what):
    if not sys.stdin.isatty():
        sys.exit("Run this in your own terminal, not in Claude's: it asks you to paste the secret without showing it.\n"
                 "macOS: the Terminal app. Windows: PowerShell or Windows Terminal, in the repo folder.")
    try:
        value = getpass.getpass(f"Paste {what} (it is not shown while you paste) and press Enter: ")
    except (EOFError, KeyboardInterrupt):
        sys.exit("\nNothing was saved.")
    return re.sub(r"\s+", "", value)


def instagram(brand):
    token = ask(f"the Instagram token for {brand}")
    if not token.startswith("EA") or len(token) < 100:
        sys.exit("That does not look like a Meta token (it starts with EA and is long). Nothing was saved.")
    where = system.save_secret(f"{brand}-instagram", "token", token)
    if where is None:
        var = f"{brand.upper().replace('-', '_')}_INSTAGRAM_TOKEN"
        sys.exit(f"This system has no secret store (install libsecret-tools to get secret-tool).\n"
                 f"Meanwhile, put it in the environment variable {var} in your terminal profile. Nothing was saved.")
    if system.read_secret(f"{brand}-instagram", "token") != token:
        sys.exit(f"It was saved in {where}, but reading it back did not match. Try again.")
    print(f"Saved in {where} ({len(token)} characters).")


def pass_ready():
    """Is there a pass store (the Linux password manager) already set up? last30days reads its keys from there."""
    folder = Path(os.environ.get("PASSWORD_STORE_DIR") or Path.home() / ".password-store")
    return bool(shutil.which("pass")) and (folder / ".gpg-id").exists()


def scrapecreators():
    key = ask("the ScrapeCreators key")
    if len(key) < 16:
        sys.exit("That does not look like a ScrapeCreators key. Nothing was saved.")
    # last30days looks for it in the macOS keychain, in pass and in its .env file; not in the Windows Credential Manager
    # or in secret-tool: saving it there would leave it where last30days can't see it.
    if system.MAC:
        where = system.save_secret("last30days-SCRAPECREATORS_API_KEY", os.environ.get("USER") or getpass.getuser(), key)
        print(f"Saved in {where}. last30days reads it from there.")
        return
    if pass_ready():
        r = subprocess.run(["pass", "insert", "-m", "-f", "last30days/SCRAPECREATORS_API_KEY"], input=key + "\n",
                           capture_output=True, text=True)
        if r.returncode == 0:
            print("Saved in pass (last30days/SCRAPECREATORS_API_KEY), encrypted. last30days reads it from there.")
            return
        print(f"pass didn't save it ({(r.stderr or r.stdout).strip()[-200:]}). Saving it in last30days's file instead.")
    env = Path.home() / ".config" / "last30days" / ".env"
    env.parent.mkdir(parents=True, exist_ok=True)
    lines = env.read_text(encoding="utf-8").splitlines() if env.exists() else []
    lines = [x for x in lines if not re.match(r"\s*(export\s+)?SCRAPECREATORS_API_KEY\s*=", x)]
    env.write_text("\n".join(lines + [f"SCRAPECREATORS_API_KEY={key}"]) + "\n", encoding="utf-8")
    if system.WINDOWS:
        print(f"Saved in {env}, an unencrypted text file in your user folder: anyone who signs in as your Windows user can open it.\n"
              "It doesn't go in the Credential Manager because last30days doesn't read it. last30days reads it from that file.")
    else:
        env.chmod(0o600)
        print(f"Saved in {env}, an unencrypted text file only your user can open.\n"
              "It doesn't go in secret-tool because last30days doesn't read it. If you use pass, set it up (pass init) and run this again: it gets saved there, encrypted.")


def tiktok(brand):
    import json
    import oauth
    key = ask("the TikTok app's \"Client key\" (Credentials)")
    secret = ask("the same app's \"Client secret\"")
    if len(key) < 8 or len(secret) < 16:
        sys.exit("That does not look like TikTok's key and secret (they are in App details -> Credentials, in Sandbox mode). Nothing was saved.")
    where = oauth.save_keys(f"{brand}-tiktok-app", {"client_key": key, "client_secret": secret})
    if json.loads(system.read_secret(f"{brand}-tiktok-app", "oauth") or "{}").get("client_key") != key:
        sys.exit(f"It was saved in {where}, but reading it back did not match. Try again.")
    print(f"Saved in {where}. Next: {system.PY} production/tools/tiktok.py connect {brand}")


def main():
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        sys.exit(__doc__)
    if args[0] == "--scrapecreators":
        scrapecreators()
    elif args[0] == "--tiktok":
        if len(args) < 2:
            sys.exit(__doc__)
        tiktok(args[1])
    else:
        instagram(args[0])


if __name__ == "__main__":
    main()
