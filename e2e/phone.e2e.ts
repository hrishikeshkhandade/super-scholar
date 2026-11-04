import { expect, test } from "@playwright/test";
import { SHOTS, openGame } from "./play";

// The same game on a phone held sideways, with a touch screen. The 800x450
// game is scaled down to fit, so everything tappable must still be big
// enough to hit with a finger.

test.use({ viewport: { width: 667, height: 375 }, hasTouch: true, isMobile: true });

// Phone guidelines ask for about 44px; the game's 800x450 layout, scaled to a
// phone, can't reach that everywhere, so this is the floor nothing may go under.
const MIN_TAP_HEIGHT = 20;

const LIBRARY = "/src/content/library.ts";

test("on a phone, every option on the menus and new screens is big enough to tap", async ({ page }) => {
  await openGame(page);
  const screens = [
    ["Title", "title", {}],
    ["LevelSelect", "review-papers", { review: true }],
    ["LevelSelect", "review-sections", { review: true, paper: 0 }],
    ["LevelSelect", "level-select-map", { paper: 0 }],
    ["Notebook", "notebook-papers", {}],
    ["Notebook", "notebook-world", { paper: 0 }],
    ["ReviewResults", "review-results", { results: true }],
    ["Boss", "boss-question", { question: true }],
    ["Boss", "review-boss-beaten", { reviewWin: true }],
  ] as const;
  const tooSmall: string[] = [];
  for (const [key, name, setup] of screens) {
    const result = await page.evaluate(
      async ({ key, setup, library }) => {
        const { LIBRARY } = await window.importGame(library);
        const { startReview } = await window.importGame("/src/review.ts");
        const paper = LIBRARY[0];
        const data: Record<string, unknown> = { ...setup };
        if ("paper" in setup) data.paperId = paper.id;
        if ("results" in setup) {
          data.paper = paper;
          data.scores = paper.worlds.map((_: unknown, i: number) => ({ worldIndex: i, rightFirstTry: i === 0 ? 2 : 5, total: 5 }));
        }
        const scene = window.startScene(key, "question" in setup || "reviewWin" in setup ? startReview(paper, 0) : data);
        window.steps(30);
        if (key === "Boss") {
          for (let frame = 0; frame < 600 && scene.mode !== "fight"; frame++) window.steps(1);
          if ("question" in setup) {
            scene.mode = "question";
            scene.physics.pause();
            scene.askQuestion();
          } else scene.win();
          window.steps(10);
          window.hideOverlays(scene);
        }
        const scale = document.querySelector("canvas")!.getBoundingClientRect().width / 800;
        return scene.children.list
          .filter((object: any) => object.input?.enabled && object.visible && object.type === "Text")
          .map((object: any) => {
            const height = (object.input.hitArea?.height ?? object.height) * object.scaleY * scale;
            return { label: String(object.text).replace(/\n/g, " ").slice(0, 24), height: Math.round(height) };
          });
      },
      { key, setup, library: LIBRARY },
    );
    await page.screenshot({ path: `${SHOTS}/phone-${name}.png` });
    for (const { label, height } of result) if (height < MIN_TAP_HEIGHT) tooSmall.push(`${name}: "${label}" is ${height}px tall`);
  }
  expect(tooSmall).toEqual([]);
});
