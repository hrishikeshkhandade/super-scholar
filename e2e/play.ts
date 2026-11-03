import type { Page } from "@playwright/test";

// Helpers for the play-through checks. They reach into the running game's
// scenes (window.game is exposed in development), so the in-page code is
// loosely typed: the checks read private scene state on purpose.

declare global {
  interface Window {
    game: any;
    steps: (frames: number) => void;
    startScene: (key: string, data: object) => any;
    hold: (scene: any, key: "left" | "right" | "jump", down: boolean) => void;
    jump: (scene: any, x: number, y: number, direction: "left" | "right", directionFrames: number) => JumpResult;
    hideOverlays: (scene: any) => void;
    importGame: (path: string) => Promise<any>;
    boxProblems: (paper: any) => Promise<string[]>;
    skyBoxProblems: (scene: any, show: () => void, where: string, options?: { remove?: boolean }) => Promise<string[]>;
  }
}

export interface JumpResult {
  bottom: number;
  standing: boolean;
}

export const SHOTS = "e2e/screenshots";

// Opens the game at the title screen and collects anything the browser
// reports as an error, so a check can fail on it.
export async function openGame(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.game?.scene.isActive("Title"));
  await page.evaluate(installHelpers);
  return errors;
}

// Runs in the page. The game is stepped frame by frame, so the checks don't
// depend on how fast the computer is.
function installHelpers(): void {
  const game = window.game;
  // Stop the browser's own frame loop: it runs on real time, behind the
  // stepped time, and between checks it could wind the game's clock back
  // (so a menu would ignore a click as "too soon after it opened").
  game.loop.sleep();
  let now = performance.now();

  window.steps = (frames) => {
    for (let i = 0; i < frames; i++) {
      now += 16.7;
      game.step(now, 16.7);
      // A hidden test browser counts as unfocused, which pauses the game.
      if (game.scene.isActive("Pause")) {
        const from = game.scene.getScene("Pause").from;
        game.scene.stop("Pause");
        game.scene.resume(from);
      }
    }
  };

  window.startScene = (key, data) => {
    game.scene.getScenes(true).forEach((scene: any) => scene.scene.stop());
    window.steps(3);
    game.scene.start(key, data);
    window.steps(5);
    return game.scene.getScene(key);
  };

  // Presses or releases a key the way the keyboard would.
  window.hold = (scene, key, down) => {
    const phaserKey = scene.controls.keys[key][0];
    const event = { keyCode: phaserKey.keyCode, timeStamp: performance.now(), repeat: false, preventDefault() {} };
    if (down) phaserKey.onDown(event);
    else phaserKey.onUp(event);
  };

  // Runs toward a spot while holding jump, lets go of the direction after
  // directionFrames, and reports where the player came to rest.
  window.jump = (scene, x, y, direction, directionFrames) => {
    const player = scene.player;
    player.setPosition(x, y);
    player.setVelocity(0, 0);
    window.steps(40);
    window.hold(scene, direction, true);
    window.hold(scene, "jump", true);
    for (let frame = 0; frame < 60; frame++) {
      if (frame === directionFrames) window.hold(scene, direction, false);
      window.steps(1);
    }
    window.hold(scene, "jump", false);
    window.hold(scene, direction, false);
    window.steps(40);
    return { bottom: Math.round(player.body.bottom), standing: player.body.touching.down || player.body.blocked.down };
  };

  // Title cards and the boss intro hint fade on real time, which runs slower
  // than the stepped game time, so screenshots hide them as a player's
  // screen would by then.
  window.hideOverlays = (scene) => {
    for (const object of scene.children.list) {
      if (object.type === "Container" || (object.type === "Text" && object.text.startsWith("STOMP THE BOSS"))) object.setVisible(false);
    }
  };

  window.importGame = (path) => import(/* @vite-ignore */ path);

  // Runs show, which draws a box on the boss arena (like WRONG! or WORLD
  // CLEAR!), and lists problems with that box: covering the top bar or the
  // grass, not centered in the sky, or anything it drew sticking out of it.
  window.skyBoxProblems = async (scene, show, where, { remove = false } = {}) => {
    const { SKY } = await window.importGame("/src/scenes/BossScene.ts");
    const before = new Set(scene.children.list);
    show();
    const added = scene.children.list.filter((object: any) => !before.has(object));
    const box = added.filter((object: any) => object.type === "Rectangle").sort((a: any, b: any) => b.width * b.height - a.width * a.height)[0];
    const found: string[] = [];
    const above = box.y - SKY.top;
    const below = SKY.bottom - (box.y + box.height);
    if (above < 4 || below < 4) found.push(`${where}: covers the top bar or the grass`);
    if (Math.abs(above - below) > 1) found.push(`${where}: not centered in the sky (${above} above, ${below} below)`);
    for (const object of added) {
      if (object === box || (object.type !== "Text" && object.type !== "Image")) continue;
      const edges = object.getBounds();
      if (edges.left < box.x + 4 || edges.right > box.x + box.width - 4 || edges.top < box.y || edges.bottom > box.y + box.height) {
        found.push(`${where}: "${object.text?.slice(0, 30) ?? object.texture.key}" outside its box`);
      }
    }
    if (remove) added.forEach((object: any) => object.destroy());
    return found;
  };

  // Lists every question or answer box in a paper that doesn't fit: text
  // outside its box, the hint touching the choices, or (in boss fights) a box
  // covering the top bar or the grass instead of centered in the sky.
  window.boxProblems = async (paper) => {
    const { QuestionPanel } = await window.importGame("/src/ui.ts");
    const { PRACTICE_TOP, PRACTICE_MIN_TOP } = await window.importGame("/src/scenes/CutsceneScene.ts");
    const { SKY } = await window.importGame("/src/scenes/BossScene.ts");
    const scene = window.startScene("Boss", { paper, worldIndex: 0, checkpointsCleared: 3, lives: 99, replay: true });
    const found: string[] = [];
    const outside = (text: any, box: any) => {
      const edges = text.getBounds();
      return edges.left < box.x + 4 || edges.right > box.x + box.width - 4 || edges.top < box.y || edges.bottom > box.y + box.height;
    };
    const inSky = (box: any, where: string) => {
      const above = box.y - SKY.top;
      const below = SKY.bottom - (box.y + box.height);
      if (above < 4 || below < 4) found.push(`${where}: covers the top bar or the grass`);
      if (Math.abs(above - below) > 1) found.push(`${where}: not centered in the sky (${above} above, ${below} below)`);
    };
    const checkQuestion = (question: any, top: number, options: object, where: string) => {
      const panel = new QuestionPanel(scene, question, top, () => {}, options);
      for (const text of [panel.prompt, ...panel.menu.texts]) {
        if (outside(text, panel.box)) found.push(`${where}: "${text.text.slice(0, 30)}" outside its box`);
      }
      // Answer it, and check the "SPACE / TAP: WHY" hint clears the last choice.
      panel.showAnswer(question.answerIndex, () => {});
      const hint = panel.objects[panel.objects.length - 1];
      if (hint.y - hint.height < panel.menu.bottom + 2 || hint.y > panel.box.y + panel.box.height) found.push(`${where}: the hint touches the choices or leaves the box`);
      return panel;
    };
    // The WRONG! or HIT! box the boss shows after an answer.
    const checkAnswerBox = async (question: any, correct: boolean, where: string) => {
      const show = () => scene.showFeedback(correct, question.choices[question.answerIndex], question.explanation);
      found.push(...(await window.skyBoxProblems(scene, show, where, { remove: true })));
    };
    for (const [w, world] of paper.worlds.entries()) {
      world.cutscenes.forEach((cutscene: any, c: number) => {
        if (!cutscene.practice) return;
        const where = `${paper.id} world ${w + 1} practice ${c + 1}`;
        const panel = checkQuestion(cutscene.practice, PRACTICE_TOP, { minTop: PRACTICE_MIN_TOP }, where);
        if (panel.box.y < PRACTICE_MIN_TOP) found.push(`${where}: box above its limit`);
        panel.destroy();
      });
      for (const [q, question] of world.boss.questions.entries()) {
        const where = `${paper.id} world ${w + 1} boss ${q + 1}`;
        // With the "missed earlier" tag, which sits on the box's top edge.
        const panel = checkQuestion(question, SKY.top, { center: SKY, tag: "MISSED EARLIER, TRY AGAIN" }, where);
        inSky(panel.box, where);
        const tag = panel.objects[1].getBounds();
        const prompt = panel.prompt.getBounds();
        if (tag.top < SKY.top) found.push(`${where}: the tag covers the top bar`);
        if (tag.bottom > prompt.top && tag.left < prompt.right) found.push(`${where}: the tag covers the question`);
        panel.destroy();
        await checkAnswerBox(question, false, `${where} wrong answer`);
        await checkAnswerBox(question, true, `${where} right answer`);
      }
    }
    return found;
  };
}
