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

This runs the tests, builds, and publishes `dist/` plus the server function in `netlify/functions/` (it downloads free PDFs for the game). During `npm run dev`, `/api` requests go to the live site's function. The first time on a new machine, log in with `npx -y netlify-cli@27 login` and link the site with `npx -y netlify-cli@27 link`.

## Security

- No secrets live in this repository; the game needs no API keys.
- `netlify.toml` sets security headers for the site, including a Content Security Policy that only allows this site's own scripts, Google Fonts, and the OpenAlex API.
- The `fetch-paper` function only downloads PDF links OpenAlex lists for the requested paper ID, accepts only GET, checks the file is a PDF, caps it at 20 MB, and is rate-limited per visitor.

## Credits

- Game, art, music, and the World 1 lessons are original work by Hrishikesh Khandade (built with AI assistance).
- The built-in lessons summarize Marco Avellaneda and Jeong-Hyun Lee, *Statistical Arbitrage in the U.S. Equities Market* (2008), in our own words; the paper itself is not included in this repository.
- Games made from other papers are built on the player's own device from a PDF they upload or that is freely available; they quote short sentences from that paper and always show its title and authors. Downloaded papers are passed straight through to the player and never stored.
- Paper search: [OpenAlex](https://openalex.org) (CC0 data).
- [Phaser](https://phaser.io) (MIT), [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0), [Vite](https://vite.dev) (MIT), [Vitest](https://vitest.dev) (MIT), [TypeScript](https://www.typescriptlang.org) (Apache-2.0).
- Font: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38 (SIL Open Font License).
- Gameplay inspired by classic platformers; no art, sound, or code is taken from any other game.
