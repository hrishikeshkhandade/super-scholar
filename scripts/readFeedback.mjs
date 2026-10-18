// Prints every piece of classmate feedback sent from the game, oldest first,
// plus the average ratings. Run with `npm run feedback` (needs `npx wrangler login`).
import { execFileSync } from "node:child_process";

const wrangler = (...args) =>
  execFileSync("npx", ["wrangler", "kv", ...args, "--binding", "FEEDBACK", "--remote"], { encoding: "utf8" });

const keys = JSON.parse(wrangler("key", "list")).map((entry) => entry.name).sort();
if (keys.length === 0) {
  console.log("No feedback yet.");
  process.exit(0);
}

const LABELS = {
  fun: "Fun",
  learned: "Learned something",
  easy: "Easy to figure out",
  best: "Best part",
  confusing: "Confusing or annoying",
  change: "Would change",
};
const totals = {};
for (const key of keys) {
  const entry = JSON.parse(wrangler("key", "get", key));
  console.log(`\n${entry.receivedAt.slice(0, 16).replace("T", " ")}  ${entry.name ?? "anonymous"} (${entry.device})`);
  for (const [question, rating] of Object.entries(entry.ratings)) {
    console.log(`  ${LABELS[question]}: ${rating}/5`);
    (totals[question] ??= []).push(rating);
  }
  for (const [question, answer] of Object.entries(entry.answers)) console.log(`  ${LABELS[question]}: ${answer}`);
}
console.log(`\n${keys.length} response${keys.length === 1 ? "" : "s"}. Averages:`);
for (const [question, ratings] of Object.entries(totals)) {
  const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  console.log(`  ${LABELS[question]}: ${average.toFixed(1)}/5 (${ratings.length} rating${ratings.length === 1 ? "" : "s"})`);
}
