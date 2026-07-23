// Guards the intended learner experience: one clear disclosure plus evidence-level provenance,
// without repeating the same safety explanation throughout the tabletop.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");
const page = read("ctf.html");
const app = read("js/ctf/app.js");
const safety = read("docs/ctf-safety.md");
const scenario = read("data/ctf/scenario.js");
const response = read("data/ctf/incident-response.js");
const learnerCopy = `${page}\n${app}\n${scenario}\n${response}`;

const failures = [];
const requireText = (source, expected, label) => {
  if (!source.includes(expected)) failures.push(`Missing ${label}: ${expected}`);
};
const rejectText = (source, retired, label) => {
  if (source.includes(retired)) failures.push(`Retired ${label}: ${retired}`);
};

requireText(page, "FICTIONAL, INERT SIMULATION", "persistent disclosure");
requireText(safety, "A concise player-facing version must appear before a run begins and remain reachable from every chapter.", "player-facing safety requirement");
rejectText(app, "SYNTHETIC — FICTIONAL TRAINING DATA", "evidence-card label");

[
  "Every record here is fictional training data.",
  "Notes are inert text and never interpreted.",
].forEach((phrase) => rejectText(learnerCopy, phrase, "learner-copy phrase"));

if (failures.length > 0) {
  failures.forEach((failure) => console.error(failure));
  process.exitCode = 1;
} else {
  console.log("Learner-copy validation passed.");
}
