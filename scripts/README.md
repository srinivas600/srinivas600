# Contribution graph generator

Generates Snake, Pac-Man, Breakout, and Galaga animations with a synthetic contribution grid at **~70% green dot density** (instead of sparse real GitHub activity).

## Regenerate locally

```bash
cd scripts
npm install
npm run generate
```

Output is written to `../dist/`.

## Adjust density

Edit `DENSITY` in `generate-rich-graphs.mjs` (default `0.7` = 70% active days).
