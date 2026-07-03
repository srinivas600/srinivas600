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

Add a repo secret **`GH_PAT`** so stats cards and contribution graphs include **all** your commits (including private repos):

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Generate new token with scopes: **`repo`** and **`read:user`**
3. In your `srinivas600` profile repo: **Settings** → **Secrets and variables** → **Actions** → New repository secret
4. Name: `GH_PAT`, value: your token
5. Re-run the **Update README stats** workflow (or wait for the daily schedule)

Without `GH_PAT`, Actions uses `GITHUB_TOKEN`, which only sees public activity from the profile repo itself — that is why the card can show ~155 commits while you have 400+ across your account.
