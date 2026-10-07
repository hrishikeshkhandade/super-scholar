# Super Scholar

A retro 2D game that turns research papers into levels: learn from cutscenes, practice with questions, and beat a quiz boss. The first paper is Avellaneda & Lee, *Statistical Arbitrage in the U.S. Equities Market* (2008).

## Run it

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Test and build

```bash
npm test
npm run build
```

`npm run build` type-checks the code and writes the playable site to `dist/`.

## Deploy

The game is hosted on Netlify at https://super-scholar.netlify.app.

```bash
npm run deploy
```

This runs the tests, builds, and publishes `dist/`. The first time on a new machine, log in with `npx -y netlify-cli@27 login` and link the site with `npx -y netlify-cli@27 link`.
