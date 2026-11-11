// The professor's guided tour: one line per step, said out loud and typed in
// a speech box above his head, while the real screen it's about sits frozen
// behind him with an arrow on the thing he's talking about.
//
// The voice is recorded ahead of time (scripts/recordTutorial.py reads these
// lines), so changing a line's words means recording it again; a unit test
// fails until the recording matches.

// The real screen behind a step. "flag" is the same level, scrolled to its end.
export type TutorialScreen = "title" | "level" | "flag" | "lesson" | "boss";

// What the arrow points at: a text on screen that starts with a label, every
// image using a texture (or any of several), or a part of a screen the scene
// knows by name.
export type TutorialPointer = { label: string } | { texture: string | string[] } | { named: "lessonBox" };

export interface TutorialStep {
  id: string; // also the name of its recording
  screen: TutorialScreen;
  text: string;
  touchText?: string; // what phones see and hear instead, recorded as `${id}-touch`
  point?: TutorialPointer;
  // On phones the professor stands in the middle, between the touch buttons
  // this step talks about, instead of on one side covering some of them.
  touchStandsCenter?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    screen: "title",
    text: "Welcome, young scholar! I'm the professor. Let me show you around before your first paper.",
  },
  {
    id: "controls",
    screen: "level",
    text: "Press A and D to run, and W or Space to jump. S drops you down through thin platforms.",
    touchText: "Hold the arrow buttons to run, and press the jump button to jump.",
    point: { texture: "player-idle" },
    touchStandsCenter: true,
  },
  {
    id: "bear",
    screen: "level",
    text: "This bear holds a fun fact from the paper. Jump on its head to collect it, but don't touch its sides!",
    point: { texture: "bear-walk1" },
  },
  {
    id: "blocks",
    screen: "level",
    text: "Bump question blocks from below. They hold coins, hearts, and shields.",
    point: { texture: "question-block" },
  },
  {
    id: "hearts",
    screen: "level",
    text: "These hearts are your lives. Bears, spikes, and pits each cost one.",
    point: { texture: ["heart", "emptyHeart"] },
  },
  {
    id: "pause",
    screen: "level",
    text: "Press P, or the pause button up here, to pause the game any time.",
    point: { label: "PAUSE" },
  },
  {
    id: "flag",
    screen: "flag",
    text: "Reach the flag to clear the level. Then you can read every fact you collected.",
    point: { texture: "flagpole" },
  },
  {
    id: "lesson",
    screen: "lesson",
    text: "Next, I teach you one idea from the paper, a page at a time.",
    point: { named: "lessonBox" },
  },
  {
    id: "practice",
    screen: "lesson",
    text: "After each lesson comes a practice question. Get it right to earn an extra heart.",
    point: { named: "lessonBox" },
  },
  {
    id: "scholar",
    screen: "lesson",
    text: "Still curious? Choose ASK THE SCHOLAR and type any question about the lesson.",
    point: { named: "lessonBox" },
  },
  {
    id: "boss",
    screen: "boss",
    text: "Every world ends with a boss. Jump on its head, and it asks you a question about the paper.",
    point: { texture: "boss" },
  },
  {
    id: "answers",
    screen: "boss",
    text: "Right answers hurt the boss. Wrong ones make it angrier, and that question comes back later.",
    point: { texture: "boss" },
  },
  {
    id: "newgame",
    screen: "title",
    text: "NEW GAME lets you pick a paper, search millions more, or upload your own PDF.",
    point: { label: "NEW GAME" },
  },
  {
    id: "continue",
    screen: "title",
    text: "CONTINUE picks up right where you left off.",
    point: { label: "CONTINUE" },
  },
  {
    id: "review",
    screen: "title",
    text: "Read the paper already? REVIEW skips the levels and tests you, one boss at a time.",
    point: { label: "REVIEW" },
  },
  {
    id: "missed",
    screen: "title",
    text: "It can also retest just the questions you missed, until you get them right.",
    point: { label: "REVIEW" },
  },
  {
    id: "levelselect",
    screen: "title",
    text: "Every level and boss earns up to three stars. Replay any of them from LEVEL SELECT.",
    point: { label: "LEVEL SELECT" },
  },
  {
    id: "leaderboard",
    screen: "title",
    text: "Finish a whole paper, and your score goes on its LEADERBOARD.",
    point: { label: "LEADERBOARD" },
  },
  {
    id: "notebook",
    screen: "title",
    text: "The NOTEBOOK keeps every lesson, fact, and question you unlock, so you can study them later.",
    point: { label: "NOTEBOOK" },
  },
  {
    id: "settings",
    screen: "title",
    text: "SETTINGS changes the music, text speed, and difficulty. HARD mode is there for a challenge.",
    point: { label: "SETTINGS" },
  },
  {
    id: "feedback",
    screen: "title",
    text: "Played a while? Tell us what you think with FEEDBACK.",
    point: { label: "FEEDBACK" },
  },
  {
    id: "goodbye",
    screen: "title",
    text: "You can replay this tour from ABOUT. Good luck, scholar!",
    point: { label: "ABOUT" },
  },
];

// Menu names are written in capitals on screen, but a voice reads capitals
// as letters ("N-E-W"), so they're spoken in lowercase. Real abbreviations
// stay spelled out.
const SPELLED_OUT = new Set(["PDF"]);
export const spokenText = (text: string): string =>
  text.replace(/\b[A-Z]{2,}\b/g, (word) => (SPELLED_OUT.has(word) ? word : word.toLowerCase()));

export const voiceFile = (id: string): string => `tutorial/${id}.mp3`;

// Every recording the tour plays: its file name and the words in it.
export function voiceLines(): { id: string; text: string }[] {
  return TUTORIAL_STEPS.flatMap((step) => [
    { id: step.id, text: step.text },
    ...(step.touchText ? [{ id: `${step.id}-touch`, text: step.touchText }] : []),
  ]);
}

// The line a step shows and plays on this device.
export function lineFor(step: TutorialStep, touch: boolean): { id: string; text: string } {
  return touch && step.touchText ? { id: `${step.id}-touch`, text: step.touchText } : { id: step.id, text: step.text };
}
