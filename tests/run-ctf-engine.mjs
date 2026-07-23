// Minimal dependency-free host for the same ES-module tests used by the
// browser harness. It supplies only the result-list DOM and localStorage APIs
// that the test reporter needs; no application UI is loaded.

const observedResults = [];
const summaryNode = { textContent: "", dataset: {} };
const resultList = { append(item) { observedResults.push(item); } };

globalThis.document = {
  title: "CTF engine validation",
  querySelector(selector) {
    if (selector === "#test-results") return resultList;
    if (selector === "#test-summary") return summaryNode;
    throw new Error(`Unexpected test DOM selector: ${selector}`);
  },
  createElement() {
    return { textContent: "", dataset: {} };
  },
};

const localValues = new Map();
globalThis.localStorage = {
  getItem(key) { return localValues.has(key) ? localValues.get(key) : null; },
  setItem(key, value) { localValues.set(String(key), String(value)); },
  removeItem(key) { localValues.delete(String(key)); },
};

await import("./ctf-engine.test.js");

const failures = observedResults.filter((item) => item.dataset.result === "fail");
console.log(summaryNode.textContent);
failures.forEach((item) => console.error(item.textContent));
if (failures.length > 0 || summaryNode.dataset.status !== "pass") process.exitCode = 1;
