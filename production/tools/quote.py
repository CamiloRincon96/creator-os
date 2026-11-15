"""Quotes what it would cost to run the blocks where the person appears through Higgsfield. It generates nothing.
Usage: python3 production/tools/quote.py <piece> [--passes N]

Reads <piece>/image/blocks.json: [{"id": "B01", "start": 0.0, "end": 3.4, "what": "hook"}, …]
(seconds in the piece; Claude writes it when closing the visual script).
Each block is one job: Higgsfield bills at least 4 s and at most 30 s per job, in whole seconds.

The rates are the ones the connector gave on Nov 13, 2026 (video editing with Seedance 2.5). Before
generating, Claude confirms the real price of each job with get_cost; if it changed, RATES is updated."""
import json, math, os, sys

RATES = {  # credits per second
    "draft 480p": 3.5,
    "final 720p": 7.5,
    "final 1080p": 20.0,
}
USD_PER_CREDIT = 0.055  # credit bought on its own, approx.

if len(sys.argv) < 2:
    sys.exit(__doc__)
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
piece = sys.argv[1] if os.path.isabs(sys.argv[1]) else os.path.join(root, sys.argv[1])
passes = int(sys.argv[sys.argv.index("--passes") + 1]) if "--passes" in sys.argv else 1
blocks = json.load(open(os.path.join(piece, "image", "blocks.json")))

rows, total_s, total_billed = [], 0.0, 0
for b in blocks:
    length = b["end"] - b["start"]
    billed = min(30, max(4, math.ceil(length + 1.0)))  # half a second of tail on each side
    total_s += length
    total_billed += billed
    rows.append((b["id"], b.get("what", ""), length, billed))

print(f"Person on screen: {total_s:.1f} s in {len(blocks)} blocks; {total_billed} s are billed (minimum 4 s per job).")
print("\n| Block | What it is | On screen | Billed |\n|---|---|---|---|")
for i, q, d, c in rows:
    print(f"| {i} | {q} | {d:.1f} s | {c} s |")
print(f"\n| Option | Per second | One pass | {passes} pass(es) | Approx. USD |\n|---|---|---|---|---|")
for name, t in RATES.items():
    one = total_billed * t
    print(f"| {name} | {t:g} | {one:.0f} credits | {one * passes:.0f} credits | {one * passes * USD_PER_CREDIT:.0f} |")
print("\nClothes, light and retouching in a single instruction are one pass; done separately, one pass each.")
print("Draft and then final: you pay for the draft and then for the full final (the draft is not deducted).")
