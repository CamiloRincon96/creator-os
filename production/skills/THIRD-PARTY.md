# Bundled third-party skills

`real-sfx` (sound design with real recorded sounds) and `openverse-audio` (finding openly licensed audio on Openverse) are included here as open-source skills at the request of the repository owner. Their original authors and license files did not come with the copies we had; `real-sfx` installs the `uisfx` package (npm) for UI sounds, which has its own license.

If you are an author of either skill, open an issue: we will add your credit and license, or remove the skill if you prefer.

`production/install.py` copies both into your agent's skills folder (`~/.claude/skills/`) and registers the example brand's CC0 sound library in `real-sfx`.
