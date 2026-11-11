import { expect, test, type Page } from "@playwright/test";
import { TUTORIAL_STEPS } from "../src/tutorial";
import { SHOTS, activeScenes, chooseOption, letAnimationsFinish, openGame } from "./play";

// The professor's tour: it starts by itself on a new player's first NEW GAME,
// shows every step on its real screen without anything overlapping, plays
// each line's recording, and can be ended any time with the X.

// Where the tour's parts are on the current step, and anything wrong with them.
async function tutorialStep(page: Page) {
  return page.evaluate(() => {
    window.steps(5);
    const tour = window.game.scene.getScene("Tutorial");
    const screen = ["Title", "Level", "Cutscene", "Boss"].find((key) => window.game.scene.isPaused(key));
    const { box, tail, professor, close, outline, arrow } = tour.layout;
    const problems: string[] = [];
    const overlaps = (a: any, b: any) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    const named: Record<string, any> = { box, tail, professor, close, outline, arrow };
    const pairs = [
      ["outline", "box"], ["outline", "tail"], ["outline", "professor"], ["outline", "close"],
      ["arrow", "box"], ["arrow", "tail"], ["arrow", "professor"], ["arrow", "close"],
      ["box", "close"], ["box", "professor"], ["professor", "close"],
    ];
    for (const [a, b] of pairs) if (overlaps(named[a], named[b])) problems.push(`${a} overlaps ${b}`);
    if (box.x < 0 || box.y < 0 || box.x + box.width > 800 || box.y + box.height > 450) problems.push("box leaves the screen");
    // Really standing there, under his speech box (not still popping up, or gone).
    const drawn = tour.professor.getBounds();
    if (Math.abs(tour.professor.y - 450) > 1 || Math.abs(drawn.centerX - (tail.x + tail.width / 2)) > 1) problems.push("the professor isn't under his speech box");
    // Its text, shown in full, stays inside the box and clear of the bottom row.
    const texts = tour.children.list.filter((object: any) => object.type === "Text" && object.text !== "X");
    for (const text of texts) {
      const edges = text.getBounds();
      if (edges.left < box.x + 8 || edges.right > box.x + box.width - 8 || edges.top < box.y + 8 || edges.bottom > box.y + box.height - 4) {
        problems.push(`"${text.text.slice(0, 20)}" outside the box`);
      }
    }
    const [body, ...row] = texts;
    for (const small of row) if (overlaps(body.getBounds(), small.getBounds())) problems.push("the line runs into the bottom row");
    return { index: tour.stepIndex, screen, pointed: outline !== undefined, problems };
  });
}

const press = async (page: Page, key: string) => {
  await page.keyboard.press(key);
  await page.evaluate(() => window.steps(2));
};

test("a new player's first NEW GAME starts the professor's tour, every step neat on its own screen", async ({ page }) => {
  const errors = await openGame(page);
  const voices = new Set<string>();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/tutorial/")) voices.add(path);
  });
  await chooseOption(page, "Title", "NEW GAME");
  expect(await activeScenes(page)).toContain("Tutorial");

  const problems: string[] = [];
  const expectedScreens = { title: "Title", level: "Level", flag: "Level", lesson: "Cutscene", boss: "Boss" };
  for (const [i, step] of TUTORIAL_STEPS.entries()) {
    await press(page, " "); // show the whole line
    await letAnimationsFinish(page);
    const result = await tutorialStep(page);
    await page.screenshot({ path: `${SHOTS}/tutorial-${String(i + 1).padStart(2, "0")}-${step.id}.png` });
    const where = `step ${i + 1} (${step.id})`;
    if (result.index !== i) problems.push(`${where}: showing step ${result.index + 1}`);
    if (result.screen !== expectedScreens[step.screen]) problems.push(`${where}: behind it is ${result.screen}`);
    if (step.point && !result.pointed) problems.push(`${where}: nothing to point at`);
    problems.push(...result.problems.map((problem) => `${where}: ${problem}`));
    await press(page, " "); // next line
  }
  expect(problems).toEqual([]);
  expect(await activeScenes(page)).toEqual(["PaperSelect"]);
  for (const step of TUTORIAL_STEPS) expect(voices).toContain(`/tutorial/${step.id}.mp3`);

  // Seen once: NEW GAME goes straight to choosing a paper.
  await chooseOption(page, "PaperSelect", "BACK");
  await chooseOption(page, "Title", "NEW GAME");
  expect(await activeScenes(page)).toEqual(["PaperSelect"]);
  expect(errors).toEqual([]);
});

test("the X ends the tour from any step, and ABOUT can replay it", async ({ page }) => {
  await openGame(page);
  await chooseOption(page, "Title", "NEW GAME");
  for (let i = 0; i < 4; i++) {
    await press(page, " ");
    await press(page, " ");
  }
  // Step 5 is on the frozen level; the X closes everything.
  const screensBefore = await page.evaluate(() => ["Level", "Title"].filter((key) => window.game.scene.isPaused(key)));
  expect(screensBefore).toEqual(["Level"]);
  await page.evaluate(() => {
    window.steps(20);
    const tour = window.game.scene.getScene("Tutorial");
    tour.children.list.find((object: any) => object.type === "Rectangle" && object.input?.enabled).emit("pointerdown", {});
    window.steps(5);
  });
  expect(await activeScenes(page)).toEqual(["PaperSelect"]);
  expect(await page.evaluate(() => window.game.scene.isPaused("Level") || window.game.scene.isActive("Level"))).toBe(false);

  // ABOUT's TUTORIAL plays it again from the start, and Esc ends it back on ABOUT.
  await chooseOption(page, "PaperSelect", "BACK");
  await chooseOption(page, "Title", "ABOUT");
  await page.screenshot({ path: `${SHOTS}/tutorial-about.png` });
  await chooseOption(page, "About", "TUTORIAL");
  await press(page, " ");
  expect((await tutorialStep(page)).index).toBe(0);
  await press(page, "Escape");
  expect(await activeScenes(page)).toEqual(["About"]);
});
