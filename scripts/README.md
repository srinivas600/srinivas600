# Contribution graph generator

Builds Snake, Pac-Man, Breakout, and Galaga animations from **real commit dates** in the `hitmehard` repo (last 365 days). If `GH_PAT` is set, GitHub API data is merged in for private contributions.

## Regenerate locally

```bash
cd scripts
npm install
npm run generate
```

Requires the `hitmehard` repo as a sibling folder (`../hitmehard`), or set `HITMEHARD_PATH`.

Output is written to `../dist/`.

## GitHub Actions

Add a repo secret `GH_PAT` (classic PAT with `repo` scope) so stats cards and private `hitmehard` commits are included on your profile.
