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

### Play-through checks

```bash
npx playwright install chromium   # once per machine
npm run check:game
```

These play parts of the real game in a hidden browser (`e2e/game.e2e.ts`): the title loads with no errors, clearing 1-1 shows what was saved to the Notebook, the jump lands on sky blocks and boss platforms, a missed boss question comes back tagged, touching the boss shows its tip once, the boss's win and game-over boxes are centered in the sky, a quick double-click on Credits BACK (or a click just after the title opens) doesn't pick a title option, every built-in question and answer box fits, and the professor's tour (`e2e/tutorial.e2e.ts`) starts on a first NEW GAME with every step neat on its own screen and the X ending it. `e2e/phone.e2e.ts` repeats key screens on a phone-sized touch screen. They start the dev server themselves and save a screenshot of each checked screen to `e2e/screenshots/`.

## The tutorial's voice

The professor's tour (`src/tutorial.ts`) plays a recorded line per step from `public/tutorial/`. The recordings are made on this computer with Kokoro, an open voice model (the "bm_lewis" voice), so the game needs no voice service. After changing a line's words, record it again (setup steps are at the top of the script):

```bash
~/kokoro/bin/python scripts/recordTutorial.py <folder with the Kokoro model files>
```

Only changed lines are re-recorded. `npm test` fails while a line's words and its recording disagree.

## Deploy

The game is hosted for free on Cloudflare at https://super-scholar.super-scholar.workers.dev (it moved from Netlify on 2026-10-16, when Netlify's free credits ran out).

```bash
npm run deploy
```

This runs the tests and the play-through checks, builds, and publishes `dist/` as static files plus the Worker in `worker/index.ts`, which handles `/api/` requests with the code in `server/` (`fetchPaper.ts` downloads free PDFs; `aiGame.ts` asks a free AI to write a paper's worlds). Settings are in `wrangler.jsonc`. During `npm run dev`, `/api` requests go to the live site.

The first time on a new machine, run `npx wrangler login`. The AI keys are Cloudflare secrets, set from this folder with `npx wrangler secret put GEMINI_API_KEY` and `npx wrangler secret put GROQ_API_KEY` (paste the key when asked).

## Classmate feedback

Players can send feedback from **FEEDBACK** on the title menu (three 1-5 ratings, three short answers, an optional first name). It is saved in a Cloudflare KV store. To read it all, with average ratings:

```bash
npm run feedback
```

## Security

- No secrets live in this repository. The AI keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, both free tier) are Cloudflare Worker secrets, read only by the server code, and never sent to the browser. Never paste them into code, chat, or a commit.
- `public/_headers` sets security headers for the site (the Worker adds its own to `/api/` responses), including a Content Security Policy that only allows this site's own scripts, Google Fonts, and the OpenAlex API.
- `fetchPaper` only downloads PDF links OpenAlex lists for the requested paper ID, accepts only GET, checks the file is a PDF, caps it at 20 MB, and is rate-limited per visitor.
- `feedback` accepts only POST, checks every field (ratings 1-5, answers up to 300 characters, an optional name up to 40), refuses empty forms, and is rate-limited to about 3 sends a minute per visitor.
- `aiGame` accepts only POST, checks the request's size and shape, is rate-limited to about 4 papers a minute per visitor (Cloudflare's limiter is approximate), and saves each result under a SHA-256 fingerprint of the exact text sent, so a request can never overwrite another paper's saved worlds. Everything the AI returns is checked (lengths, choices, answers) by the server and again by the game; anything that fails falls back to the rules-made version.
- `askScholar` (Ask the Scholar, after each lesson) accepts only POST, checks the question (up to 200 characters) and lesson text sizes, has its own rate limit of about 6 questions a minute per visitor so it can't use up the quota for writing papers, and tells the AI to treat the question only as a question. Answers are checked and trimmed to fit the speech box; players get 3 questions per lesson.
- `leaderboard` (TOP SCHOLARS) reads a paper's top 10 with GET and adds a finished run's score with POST. It checks the paper ID, the nickname (3-12 letters or numbers, with a light filter for rude words), and that the score fits the paper; each nickname's best run is its own stored entry, so scores sent at the same moment can't erase each other. Adding scores is rate-limited to about 5 a minute per visitor. Scores are computed in the player's browser, so a determined player could fake one; that's acceptable for a class game.

## Credits

- Game, art, music, and the World 1 lessons are original work by Hrishikesh Khandade (built with AI assistance).
- The built-in lessons summarize Marco Avellaneda and Jeong-Hyun Lee, *Statistical Arbitrage in the U.S. Equities Market* (2008), in our own words; the paper itself is not included in this repository.
- Games made from other papers are built on the player's own device from a PDF they upload or that is freely available; when the AI is available they are written in plain words by Google Gemini (free tier) or Groq, otherwise they quote short sentences from that paper, and they always show its title and authors. On the free tier, Google may use the text sent to improve its products, so only key sentences of a paper are sent, never the whole file. Downloaded papers are passed straight through to the player and never stored.
- Showcase papers (built in, made ahead of time with `scripts/makeShowcase.ts`): the game ships only its own plain-language lessons, written with AI from each paper and checked so no 8 words in a row are copied; the papers themselves are not included. Sources: Vaswani et al., *Attention Is All You Need* (2017, arXiv:1706.03762); Satoshi Nakamoto, *Bitcoin: A Peer-to-Peer Electronic Cash System* (2008, bitcoin.org, MIT license); Goodfellow et al., *Generative Adversarial Nets* (2014, arXiv:1406.2661); Morales-Bañuelos, Muriel & Fernández-Anaya, *A Modified Black-Scholes-Merton Model for Option Pricing* (*Mathematics* 10(9):1492, 2022, CC BY 4.0).
- Paper search: [OpenAlex](https://openalex.org) (CC0 data).
- Hosting: [Cloudflare Workers](https://workers.cloudflare.com) (free plan); tooling: [Wrangler](https://github.com/cloudflare/workers-sdk) (MIT/Apache-2.0).
- [Phaser](https://phaser.io) (MIT), [pdf.js](https://mozilla.github.io/pdf.js/) (Apache-2.0), [Vite](https://vite.dev) (MIT), [Vitest](https://vitest.dev) (MIT), [TypeScript](https://www.typescriptlang.org) (Apache-2.0).
- Font: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38 (SIL Open Font License).
- Gameplay inspired by classic platformers; no art, sound, or code is taken from any other game.
