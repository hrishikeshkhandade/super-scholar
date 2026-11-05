import { expect, test } from "@playwright/test";
import {
  SHOTS,
  activeScenes,
  answerBossQuestion,
  askBossQuestion,
  beatBoss,
  chooseOption,
  closeExplanation,
  openGame,
  pickAnswer,
  sceneTexts,
} from "./play";

// Each check plays part of the real game the way a player would and saves a
// screenshot of the screen it checked.

const LIBRARY = "/src/content/library.ts";

test("the game loads to the title screen with no errors", async ({ page }) => {
  const errors = await openGame(page);
  await page.evaluate(() => window.steps(60));
  await page.screenshot({ path: `${SHOTS}/1-title.png` });
  expect(errors).toEqual([]);
});

test("clearing 1-1 shows a centered LEVEL CLEAR box that waits for the player", async ({ page }) => {
  await openGame(page);
  for (const [name, factsFound, savedLine] of [
    ["2-level-clear", [], "LESSON & FLASHCARD SAVED TO YOUR NOTEBOOK"],
    ["2-level-clear-with-facts", [0, 1], "LESSON, FLASHCARD & 2 FACTS SAVED TO YOUR NOTEBOOK"],
  ] as const) {
    const result = await page.evaluate(
      async ({ library, name, factsFound }) => {
        const { LIBRARY } = await window.importGame(library);
        const { LEVEL_SKY } = await window.importGame("/src/scenes/LevelScene.ts");
        const level = window.startScene("Level", { paper: LIBRARY[0], worldIndex: 0, checkpointsCleared: 0, lives: 5, replay: true });
        // Wait out the level's title card, as a player must before moving.
        for (let frame = 0; frame < 300 && level.cardShowing(); frame++) window.steps(1);
        window.steps(20);
        level.factsFound = [...factsFound];
        // Menus and questions use 16px text; the box must not use anything smaller.
        const problems = await window.skyBoxProblems(level, () => level.reachGoal(), name, { area: LEVEL_SKY, minFontSize: 16 });
        const texts = () => level.children.list.filter((object: any) => object.type === "Text").map((text: any) => text.text.replace(/\n/g, " "));
        const space = () => level.input.keyboard.emit("keydown", { key: " ", repeat: false, preventDefault() {} });
        window.steps(12);
        space(); // 0.2 s in: still holding the jump from the flag, so ignored
        window.steps(300); // 5 more seconds untouched
        window.hideOverlays(level);
        const box = level.children.list.find((object: any) => object.type === "Rectangle" && object.depth === 19);
        const waiting = { texts: texts(), scenes: window.game.scene.getScenes(true).map((scene: any) => scene.scene.key) };
        return { problems, waiting, clearBox: [box.x, box.y, box.width, box.height] };
      },
      { library: LIBRARY, name, factsFound },
    );
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    expect(result.problems).toEqual([]);
    expect(result.waiting.scenes).toEqual(["Level"]);
    expect(result.waiting.texts).toContain("LEVEL CLEAR!");
    expect(result.waiting.texts).toContain(savedLine);
    expect(result.waiting.texts).toContain("OPEN NOTEBOOK ON THE TITLE MENU TO REVIEW");
    expect(result.waiting.texts.some((text: string) => text.startsWith("FACTS FOUND"))).toBe(false);

    // Space moves on: LEVEL CLEAR is gone, then the lesson, or the facts card
    // in exactly the same place, as if the same box turned the page.
    const after = await page.evaluate(async ({ name, hasFacts }) => {
      const level = window.game.scene.getScene("Level");
      const space = () => {
        level.input.keyboard.emit("keydown", { key: " ", repeat: false, preventDefault() {} });
        window.steps(10);
      };
      // With facts, the card's contents must stay inside it; without, it's straight to the lesson.
      const problems = hasFacts ? await window.skyBoxProblems(level, space, `${name} facts card`, { area: { top: 0, bottom: 450 } }) : (space(), []);
      const scenes = window.game.scene.getScenes(true).map((scene: any) => scene.scene.key);
      if (!scenes.includes("Level")) return { scenes, texts: [], factsBox: undefined, problems: [] };
      const texts = level.children.list.filter((object: any) => object.type === "Text").map((text: any) => text.text);
      const box = level.children.list.find((object: any) => object.type === "Rectangle" && object.depth === 30 && object.strokeColor !== undefined && object.width < 800);
      return { scenes, texts, factsBox: box && [box.x, box.y, box.width, box.height], problems };
    }, { name, hasFacts: factsFound.length > 0 });
    await page.screenshot({ path: `${SHOTS}/${name}-next.png` });
    expect(after.texts).not.toContain("LEVEL CLEAR!");
    if (factsFound.length > 0) {
      expect(after.texts).toContain(`FACTS FOUND  1/${factsFound.length}`);
      expect(after.factsBox).toEqual(result.clearBox);
      // Only the centering rule is relaxed here (the box is LEVEL CLEAR's, already checked).
      expect(after.problems.filter((problem: string) => !problem.includes("centered") && !problem.includes("top bar"))).toEqual([]);
    } else {
      expect(after.scenes).toEqual(["Cutscene"]);
    }
  }
});

test("a normal jump lands on the sky blocks and the boss arena's platforms", async ({ page }) => {
  await openGame(page);
  const result = await page.evaluate(async (library) => {
    const { LIBRARY } = await window.importGame(library);
    const topOf = (scene: any, texture: string, x: number) =>
      Math.round(scene.children.list.find((object: any) => object.texture?.key === texture && Math.abs(object.x - x) < 16).body.top);

    // 1-1's second group of sky blocks, 4 tiles up, after the title card.
    const level = window.startScene("Level", { paper: LIBRARY[0], worldIndex: 0, checkpointsCleared: 0, lives: 99, replay: true });
    level.bears.clear(true, true); // as if stomped, so none knocks the jumper back
    window.steps(300);
    const blockTop = topOf(level, "brick", 1168);
    const onBlocks = window.jump(level, 1082, 364, "right", 26);

    // Both floating platforms in a boss arena, with the boss moved aside.
    const boss = window.startScene("Boss", { paper: LIBRARY[0], worldIndex: 2, checkpointsCleared: 3, lives: 99, replay: true });
    for (let frame = 0; frame < 600 && boss.mode !== "fight"; frame++) window.steps(1);
    boss.behavior.end();
    boss.boss.setPosition(400, 100);
    boss.boss.body.enable = false;
    const platformTop = topOf(boss, "platform", 112);
    const onLeft = window.jump(boss, 250, 364, "left", 40);
    const onRight = window.jump(boss, 560, 364, "right", 40);
    window.hideOverlays(boss);
    return { blockTop, onBlocks, platformTop, onLeft, onRight };
  }, LIBRARY);
  await page.screenshot({ path: `${SHOTS}/3-jump-boss-platform.png` });
  expect(result.onBlocks).toEqual({ bottom: result.blockTop, standing: true });
  expect(result.onLeft).toEqual({ bottom: result.platformTop, standing: true });
  expect(result.onRight).toEqual({ bottom: result.platformTop, standing: true });
});

test("a missed boss question warns it comes back, then returns tagged", async ({ page }) => {
  await openGame(page);
  await page.evaluate(async (library) => {
    const { LIBRARY } = await window.importGame(library);
    const boss = window.startScene("Boss", { paper: LIBRARY[0], worldIndex: 0, checkpointsCleared: 3, lives: 99, replay: true });
    for (let frame = 0; frame < 600 && boss.mode !== "fight"; frame++) window.steps(1);
    window.hideOverlays(boss);
  }, LIBRARY);
  const texts = () => sceneTexts(page, "Boss");

  await askBossQuestion(page);
  expect(await texts()).not.toContain("MISSED EARLIER, TRY AGAIN");
  await pickAnswer(page, false);
  await page.screenshot({ path: `${SHOTS}/4-boss-miss.png` });
  expect(await texts()).toContain("THIS QUESTION COMES BACK LATER");
  let retryNext = await closeExplanation(page);

  // Answer the rest right until the missed one is next.
  for (let i = 0; i < 10 && !retryNext; i++) {
    await askBossQuestion(page);
    await pickAnswer(page, true);
    retryNext = await closeExplanation(page);
  }
  expect(retryNext).toBe(true);
  await askBossQuestion(page);
  await page.screenshot({ path: `${SHOTS}/4-boss-retry.png` });
  const shown = await texts();
  expect(shown).toContain("MISSED EARLIER, TRY AGAIN");
  expect(shown).not.toContain("WRONG! THE BOSS GETS ANGRIER"); // the earlier explanation is gone
  expect(await page.evaluate(() => window.game.scene.getScene("Boss").fight.wrongAnswers)).toBe(1);
});

test("touching the boss shows the don't-touch tip once per fight", async ({ page }) => {
  await openGame(page);
  const result = await page.evaluate(async (library) => {
    const { LIBRARY } = await window.importGame(library);
    const boss = window.startScene("Boss", { paper: LIBRARY[0], worldIndex: 0, checkpointsCleared: 3, lives: 99, replay: true });
    for (let frame = 0; frame < 600 && boss.mode !== "fight"; frame++) window.steps(1);
    let tipsMade = 0;
    const addText = boss.add.text.bind(boss.add);
    boss.add.text = (...args: any[]) => {
      if (String(args[2]).startsWith("OUCH")) tipsMade += 1;
      return addText(...args);
    };
    const walkIntoBoss = () => {
      const hits = boss.hits;
      boss.player.setPosition(boss.boss.x - 70, boss.boss.y);
      for (let frame = 0; frame < 300 && boss.hits === hits && boss.mode === "fight"; frame++) {
        boss.player.setVelocityX(200);
        window.steps(1);
      }
    };
    walkIntoBoss();
    const afterFirst = { hits: boss.hits, tipsMade };
    window.hideOverlays(boss);
    window.steps(100); // past the moment the player can't be hurt
    walkIntoBoss();
    return { afterFirst, afterSecond: { hits: boss.hits, tipsMade } };
  }, LIBRARY);
  await page.screenshot({ path: `${SHOTS}/5-boss-touch.png` });
  expect(result.afterFirst).toEqual({ hits: 1, tipsMade: 1 });
  expect(result.afterSecond.hits).toBeGreaterThanOrEqual(2);
  expect(result.afterSecond.tipsMade).toBe(1);
});

test("the boss's win and game-over boxes sit centered in the sky", async ({ page }) => {
  await openGame(page);
  const cases = [
    { name: "9-world-clear", worldIndex: 0, replay: true, miss: true, buttons: ["REVIEW MISSES (1)", "NEXT WORLD", "SEND FEEDBACK", "TITLE SCREEN"] },
    { name: "9-world-clear-no-misses", worldIndex: 0, replay: true, miss: false, buttons: ["NEXT WORLD", "SEND FEEDBACK", "TITLE SCREEN"] },
    { name: "9-paper-complete", worldIndex: 4, replay: false, miss: true, buttons: ["REVIEW MISSES (1)", "LEADERBOARD", "SEND FEEDBACK", "TITLE SCREEN"] },
    { name: "9-game-over", worldIndex: 0, replay: true, miss: false, buttons: ["RETRY BOSS", "TITLE SCREEN"] },
  ];
  for (const fightCase of cases) {
    const result = await page.evaluate(
      async ({ library, fightCase }) => {
        const { LIBRARY } = await window.importGame(library);
        const { startRun } = await window.importGame("/src/run.ts");
        const paper = LIBRARY[0];
        // A full playthrough, so finishing the last world shows its score.
        if (!fightCase.replay) startRun(paper.id);
        const boss = window.startScene("Boss", { paper, worldIndex: fightCase.worldIndex, checkpointsCleared: 3, lives: 5, replay: fightCase.replay });
        for (let frame = 0; frame < 600 && boss.mode !== "fight"; frame++) window.steps(1);
        window.hideOverlays(boss);
        if (fightCase.miss) boss.fight.answer((boss.fight.current.answerIndex + 1) % 4);
        const show = () => (fightCase.name === "9-game-over" ? boss.lose() : boss.win());
        const problems = await window.skyBoxProblems(boss, show, fightCase.name);
        window.steps(60); // let the boss's defeat animation finish
        const labels = boss.children.list.filter((object: any) => object.type === "Text" && object.input?.enabled).map((text: any) => text.text);
        return { problems, labels };
      },
      { library: LIBRARY, fightCase },
    );
    await page.screenshot({ path: `${SHOTS}/${fightCase.name}.png` });
    expect(result.problems).toEqual([]);
    for (const button of fightCase.buttons) expect(result.labels).toContain(button);
  }
});

test("beating a boss offers SEND FEEDBACK until this device has sent some", async ({ page }) => {
  await openGame(page);
  // Pretend the server took it, so the check never sends real feedback.
  await page.route("**/api/feedback", (route) => route.fulfill({ status: 200, body: "{}" }));
  const winLabels = () =>
    page.evaluate(async (library) => {
      const { LIBRARY } = await window.importGame(library);
      const boss = window.startScene("Boss", { paper: LIBRARY[0], worldIndex: 0, checkpointsCleared: 3, lives: 5, replay: true });
      for (let frame = 0; frame < 600 && boss.mode !== "fight"; frame++) window.steps(1);
      window.hideOverlays(boss);
      boss.win();
      window.steps(10);
      return boss.children.list.filter((object: any) => object.type === "Text" && object.input?.enabled).map((text: any) => text.text);
    }, LIBRARY);

  expect(await winLabels()).toContain("SEND FEEDBACK");
  await chooseOption(page, "Boss", "SEND FEEDBACK");
  expect(await activeScenes(page)).toContain("Feedback");
  await page.locator('fieldset[data-rating="fun"] button', { hasText: "5" }).click();
  await page.locator("#feedback-send").click();
  await expect(page.locator("#feedback-status")).toHaveText("Thanks! Your feedback was sent.");
  await page.locator("#feedback-back").click();

  expect(await winLabels()).not.toContain("SEND FEEDBACK");
});

test("double-clicking BACK on the credits screen stays on the title screen", async ({ page }) => {
  await openGame(page);
  const back = await page.evaluate(() => {
    const credits = window.startScene("Credits", { from: "Title" });
    window.steps(60);
    const button = credits.children.list.find((object: any) => object.type === "Text" && object.text === "BACK").getBounds();
    return { x: button.centerX, y: button.centerY };
  });
  // Two quick clicks, the way a player double-clicks, with the real mouse.
  await page.mouse.click(back.x, back.y);
  await page.evaluate(() => window.steps(7)); // about 120 ms
  await page.mouse.click(back.x, back.y);
  const scenes = await page.evaluate(() => {
    window.steps(30);
    return window.game.scene.getScenes(true).map((scene: any) => scene.scene.key);
  });
  expect(scenes).toEqual(["Title"]);
});

test("a click right after the title screen opens doesn't pick an option", async ({ page }) => {
  await openGame(page);
  // A while on the credits screen first: the title screen's clock must still
  // count its short ignore-clicks moment from when it opens again.
  const spots = await page.evaluate(() => {
    const credits = window.startScene("Credits", { from: "Title" });
    window.steps(600);
    const back = credits.children.list.find((object: any) => object.type === "Text" && object.text === "BACK").getBounds();
    return { back: { x: back.centerX, y: back.centerY } };
  });
  await page.mouse.click(spots.back.x, spots.back.y);
  const notebook = await page.evaluate(() => {
    window.steps(2);
    const title = window.game.scene.getScene("Title");
    const option = title.children.list.find((object: any) => object.type === "Text" && object.text === "NOTEBOOK").getBounds();
    return { x: option.centerX, y: option.centerY };
  });
  await page.evaluate(() => window.steps(5)); // about 120 ms after BACK
  await page.mouse.click(notebook.x, notebook.y);
  const scenes = await page.evaluate(() => {
    window.steps(30);
    return window.game.scene.getScenes(true).map((scene: any) => scene.scene.key);
  });
  expect(scenes).toEqual(["Title"]);

  // Once that moment is over, a deliberate click works.
  await page.mouse.click(notebook.x, notebook.y);
  const after = await page.evaluate(() => {
    window.steps(30);
    return window.game.scene.getScenes(true).map((scene: any) => scene.scene.key);
  });
  expect(after).toEqual(["Notebook"]);
});

test("REVIEW goes straight to the boss fights, then scores each section", async ({ page }) => {
  await openGame(page);
  const scenes = () => activeScenes(page);
  const choose = (sceneKey: string, label: string) => chooseOption(page, sceneKey, label);

  await page.evaluate(() => window.steps(30));
  await page.screenshot({ path: `${SHOTS}/10-title-with-review.png` });
  await choose("Title", "REVIEW");
  await page.evaluate(() => window.steps(5));
  await page.screenshot({ path: `${SHOTS}/10-review-papers.png` });
  await choose("LevelSelect", "Statistical Arbitrage");
  await page.evaluate(() => window.steps(5));
  await page.screenshot({ path: `${SHOTS}/10-review-sections.png` });
  await choose("LevelSelect", "ALL SECTIONS");
  expect(await scenes()).toEqual(["Boss"]);

  // World 1: miss two questions, answer the rest right.
  await beatBoss(page, 2);
  await page.screenshot({ path: `${SHOTS}/10-review-boss-beaten.png` });
  await choose("Boss", "NEXT BOSS");
  expect(await scenes()).toEqual(["Boss"]);
  expect(await page.evaluate(() => window.game.scene.getScene("Boss").stage.worldIndex)).toBe(1);

  // The other worlds, all right, through to the results.
  for (let world = 1; world < 5; world++) {
    await beatBoss(page);
    await choose("Boss", world < 4 ? "NEXT BOSS" : "SEE RESULTS");
  }
  expect(await scenes()).toEqual(["ReviewResults"]);
  const results = await page.evaluate(async () => {
    const { loadProgress, loadCleared } = await window.importGame("/src/save.ts");
    const texts = window.game.scene.getScene("ReviewResults").children.list.filter((object: any) => object.type === "Text").map((text: any) => text.text);
    return { texts, progress: loadProgress() ?? null, cleared: Object.keys(loadCleared()).length };
  });
  await page.screenshot({ path: `${SHOTS}/10-review-results.png` });
  expect(results.texts.filter((text: string) => text === "RE-READ")).toHaveLength(1);
  expect(results.texts.filter((text: string) => text === "KNOWN")).toHaveLength(4);
  expect(results.texts).toContain("3/5");
  // A review doesn't count as playing: no CONTINUE, nothing lit on the level map.
  expect(results.progress).toBeNull();
  expect(results.cleared).toBe(0);

  // RE-READ opens World 1's lessons, readable even though its levels were skipped.
  await choose("ReviewResults", "RE-READ");
  expect(await scenes()).toEqual(["Notebook"]);
  const notebook = await sceneTexts(page, "Notebook");
  await page.screenshot({ path: `${SHOTS}/10-review-reread.png` });
  expect(notebook).toContain("World 1: Pairs Trading");
  expect(notebook).toContain("1 LESSONS 3/3");
  expect(notebook.some((text: string) => text.startsWith("LESSON 1:"))).toBe(true);

  // BACK returns to the same results, and REVIEW AGAIN starts over.
  await choose("Notebook", "BACK");
  expect(await scenes()).toEqual(["ReviewResults"]);
  expect(await sceneTexts(page, "ReviewResults")).toContain("3/5");
  await choose("ReviewResults", "REVIEW AGAIN");
  expect(await scenes()).toEqual(["Boss"]);
  expect(await page.evaluate(() => window.game.scene.getScene("Boss").stage.worldIndex)).toBe(0);
});

test("REVIEW can test one section: one boss fight, then its results", async ({ page }) => {
  await openGame(page);
  const scenes = () => activeScenes(page);
  const texts = (sceneKey: string) => sceneTexts(page, sceneKey);
  const choose = (sceneKey: string, label: string) => chooseOption(page, sceneKey, label);

  await choose("Title", "REVIEW");
  await choose("LevelSelect", "Statistical Arbitrage");
  await choose("LevelSelect", "World 2");
  expect(await scenes()).toEqual(["Boss"]);
  expect(await page.evaluate(() => window.game.scene.getScene("Boss").stage.worldIndex)).toBe(1);

  await beatBoss(page, 1);
  const beaten = await texts("Boss");
  expect(beaten).toContain("REVIEW COMPLETE!");
  expect(beaten).toContain("SEE RESULTS");
  expect(beaten).not.toContain("NEXT BOSS");

  await choose("Boss", "SEE RESULTS");
  const results = await texts("ReviewResults");
  await page.screenshot({ path: `${SHOTS}/10-review-one-section.png` });
  expect(results).toContain("World 2: Hunting Factors");
  expect(results).not.toContain("World 1: Pairs Trading");
  expect(results).toContain("4/5");
  expect(results).toContain("KNOWN");
  // Only one section was tested, so the summary mustn't claim the whole paper.
  expect(results).toContain("4/5 right on the first try.\nYou know this section!");

  await choose("ReviewResults", "REVIEW AGAIN");
  expect(await page.evaluate(() => window.game.scene.getScene("Boss").stage.worldIndex)).toBe(1);
});

test("MISSED QUESTIONS retests only what you got wrong, and right answers drop off", async ({ page }) => {
  await openGame(page);
  const scenes = () => activeScenes(page);
  const texts = (sceneKey: string) => sceneTexts(page, sceneKey);
  const choose = (sceneKey: string, label: string) => chooseOption(page, sceneKey, label);
  const answer = (right: boolean) => answerBossQuestion(page, right);

  // A normal World 1 boss fight: miss the first two questions, then leave.
  await page.evaluate(async () => {
    const { LIBRARY } = await window.importGame("/src/content/library.ts");
    const boss = window.startScene("Boss", { paper: LIBRARY[0], worldIndex: 0, checkpointsCleared: 3, lives: 99 });
    for (let frame = 0; frame < 600 && boss.mode !== "fight"; frame++) window.steps(1);
  });
  const missedPrompts = [await answer(false), await answer(false)];
  await page.evaluate(() => window.startScene("Title", {}));

  await choose("Title", "REVIEW");
  await choose("LevelSelect", "Statistical Arbitrage");
  await page.evaluate(() => window.steps(5));
  await page.screenshot({ path: `${SHOTS}/12-missed-in-list.png` });
  await choose("LevelSelect", "MISSED QUESTIONS (2)");
  expect(await scenes()).toEqual(["Boss"]);
  expect(await page.evaluate(() => window.game.scene.getScene("Boss").fight.maxHealth)).toBe(2);

  // The first right on the first try, the second wrong and then right.
  const asked = [await answer(true), await answer(false), await answer(true)];
  expect(new Set(asked)).toEqual(new Set(missedPrompts));
  await page.evaluate(() => {
    window.game.scene.getScene("Boss").win();
    window.steps(30);
  });
  await choose("Boss", "SEE RESULTS");
  const results = await texts("ReviewResults");
  await page.screenshot({ path: `${SHOTS}/12-missed-results.png` });
  expect(results).toContain("World 1: Pairs Trading");
  expect(results).toContain("1/2");

  // The one answered right first time has dropped off the list.
  await choose("ReviewResults", "TITLE SCREEN");
  await choose("Title", "REVIEW");
  await choose("LevelSelect", "Statistical Arbitrage");
  expect((await texts("LevelSelect")).some((text: string) => text.startsWith("MISSED QUESTIONS (1)"))).toBe(true);
});

test("the Notebook reaches a world in two clicks and only pages through what's unlocked", async ({ page }) => {
  await openGame(page);
  // Some of World 1 and World 2 unlocked, as if played a little.
  await page.evaluate(async () => {
    const { unlockNote } = await window.importGame("/src/save.ts");
    const { LIBRARY } = await window.importGame("/src/content/library.ts");
    const id = LIBRARY[0].id;
    unlockNote(id, 0, "lesson", 0);
    unlockNote(id, 0, "fact", 0);
    unlockNote(id, 0, "fact", 3);
    unlockNote(id, 1, "boss", 0);
    unlockNote(id, 1, "boss", 2);
  });
  const texts = () => sceneTexts(page, "Notebook", { visibleOnly: true });
  const click = (sceneKey: string, label: string) => chooseOption(page, sceneKey, label);
  const press = (key: string) =>
    page.evaluate((key) => {
      window.game.scene.getScene("Notebook").input.keyboard.emit("keydown", { key, repeat: false, preventDefault() {} });
      window.steps(2);
    }, key);

  // Two clicks from the title: NOTEBOOK, then the paper.
  await click("Title", "NOTEBOOK");
  await click("Notebook", "Statistical Arbitrage");
  let shown = await texts();
  await page.screenshot({ path: `${SHOTS}/11-notebook-world-1.png` });
  expect(shown).toContain("Statistical Arbitrage in the U.S. Equities...");
  expect(shown).toContain("World 1: Pairs Trading");
  expect(shown).toContain("1 LESSONS 1/3");
  expect(shown).toContain("2 more lessons unlock as you reach the flags in World 1.");

  // Every lesson page is a real page, never "???".
  const lessonPages = Number(shown.find((text: string) => text.startsWith("PAGE "))!.split(" OF ")[1]);
  for (let i = 1; i < lessonPages; i++) await press("d");
  shown = await texts();
  expect(shown).toContain(`PAGE ${lessonPages} OF ${lessonPages}`);
  expect(shown.some((text: string) => text.includes("???"))).toBe(false);

  // Clicking a tab opens that section.
  await click("Notebook", "2 FACTS");
  shown = await texts();
  expect(shown).toContain("FUN FACT 1");
  await press("d");
  expect(await texts()).toContain("FUN FACT 4");

  // The world arrow goes to World 2 and keeps the open section; CARDS there
  // has only the two boss questions faced.
  await page.evaluate(() => {
    window.steps(20);
    const notebook = window.game.scene.getScene("Notebook");
    notebook.children.list.filter((object: any) => object.type === "Text" && object.text === ">" && object.input?.enabled && object.y < 60)[0].emit("pointerdown", {});
    window.steps(10);
  });
  shown = await texts();
  expect(shown).toContain("World 2: Hunting Factors");
  expect(shown).toContain("NO PAGES YET");
  expect(shown).toContain("Nothing here yet.");
  await press("3");
  shown = await texts();
  await page.screenshot({ path: `${SHOTS}/11-notebook-world-2-cards.png` });
  expect(shown).toContain("PAGE 1 OF 2");
  expect(shown).toContain("BOSS QUESTION 1");
  await press("d");
  expect(await texts()).toContain("BOSS QUESTION 3");
});

test("every practice and boss question in every built-in paper fits its box", async ({ page }) => {
  await openGame(page);
  const problems = await page.evaluate(async (library) => {
    const { LIBRARY } = await window.importGame(library);
    const found: string[] = [];
    for (const paper of LIBRARY) found.push(...(await window.boxProblems(paper)));
    return found;
  }, LIBRARY);
  expect(problems).toEqual([]);

  // Screenshots of the shortest and the tallest boss question.
  for (const [name, prompt] of [
    ["6-boss-short-question", "Which pair does the paper use"],
    ["6-boss-long-question", "Why can't we have completely non-reversible"],
  ]) {
    await page.evaluate(
      async ({ library, start }) => {
        const { LIBRARY } = await window.importGame(library);
        const { QuestionPanel } = await window.importGame("/src/ui.ts");
        const { SKY } = await window.importGame("/src/scenes/BossScene.ts");
        const paper = LIBRARY.find((p: any) => p.worlds.some((w: any) => w.boss.questions.some((q: any) => q.prompt.startsWith(start))));
        const question = paper.worlds.flatMap((w: any) => w.boss.questions).find((q: any) => q.prompt.startsWith(start));
        const scene = window.startScene("Boss", { paper, worldIndex: 0, checkpointsCleared: 3, lives: 99, replay: true });
        for (let frame = 0; frame < 600 && scene.mode !== "fight"; frame++) window.steps(1);
        scene.mode = "question";
        scene.physics.pause();
        window.hideOverlays(scene);
        new QuestionPanel(scene, question, SKY.top, () => {}, { center: SKY });
        window.steps(2);
      },
      { library: LIBRARY, start: prompt },
    );
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
});
