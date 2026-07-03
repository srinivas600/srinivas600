# Contribution graph generator

Builds Snake, Pac-Man, Breakout, Galaga, Bomberman, and more from your GitHub contribution history.

**Locally:** uses the `hitmehard` sibling repo (`../hitmehard`) when present, optionally merged with the GitHub API if `GH_PAT` is set.

**CI (GitHub Actions):** fetches contributions via the GitHub GraphQL API using `GITHUB_TOKEN` (or `GH_PAT` for private commits). No separate `hitmehard` checkout is required.

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
