// Dependency-free release smoke test. It serves only this repository on
// loopback and drives an installed Chromium browser through its local DevTools
// endpoint. No external destination is allowed by the assertions or browser
// resolver rules.

import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
assert.ok(existsSync(chromePath), `Chrome was not found at ${chromePath}`);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function startLocalServer() {
  const server = createServer((request, response) => {
    const requestPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
    const filePath = resolve(repositoryRoot, normalize(relativePath));
    const staysInsideRepository = filePath === repositoryRoot || filePath.startsWith(`${repositoryRoot}${sep}`);
    if (!staysInsideRepository || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream" });
    response.end(readFileSync(filePath));
  });
  return new Promise((resolveServer, rejectServer) => {
    server.once("error", rejectServer);
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

async function waitForDevTools(profilePath, child) {
  const portFile = join(profilePath, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(portFile)) {
      const [port, socketPath] = readFileSync(portFile, "utf8").trim().split(/\r?\n/);
      return `ws://127.0.0.1:${port}${socketPath}`;
    }
    assert.equal(child.exitCode, null, `Chrome exited before exposing DevTools (exit ${child.exitCode})`);
    await delay(50);
  }
  throw new Error("Chrome did not expose its loopback DevTools endpoint in time");
}

class DevToolsClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.waiters = new Set();
    socket.addEventListener("message", (event) => this.receive(JSON.parse(String(event.data))));
  }

  receive(message) {
    if (message.id && this.pending.has(message.id)) {
      const { resolveCall, rejectCall } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) rejectCall(new Error(message.error.message));
      else resolveCall(message.result);
      return;
    }
    for (const waiter of this.waiters) {
      if (waiter.predicate(message)) {
        this.waiters.delete(waiter);
        waiter.resolveEvent(message);
      }
    }
  }

  call(method, params = {}, sessionId = undefined) {
    const id = this.nextId;
    this.nextId += 1;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolveCall, rejectCall) => {
      this.pending.set(id, { resolveCall, rejectCall });
      this.socket.send(JSON.stringify(message));
    });
  }

  waitFor(predicate, timeout = 10000) {
    return new Promise((resolveEvent, rejectEvent) => {
      const waiter = { predicate, resolveEvent };
      this.waiters.add(waiter);
      setTimeout(() => {
        if (!this.waiters.delete(waiter)) return;
        rejectEvent(new Error("Timed out waiting for browser event"));
      }, timeout).unref();
    });
  }
}

async function openSocket(url) {
  const socket = new WebSocket(url);
  await new Promise((resolveSocket, rejectSocket) => {
    socket.addEventListener("open", resolveSocket, { once: true });
    socket.addEventListener("error", rejectSocket, { once: true });
  });
  return socket;
}

async function run() {
  const server = await startLocalServer();
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const profilePath = mkdtempSync(join(tmpdir(), "mango-ctf-browser-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    "--remote-allow-origins=*",
    "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE 127.0.0.1",
    `--user-data-dir=${profilePath}`,
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });

  let socket;
  try {
    socket = await openSocket(await waitForDevTools(profilePath, chrome));
    const client = new DevToolsClient(socket);
    const { targetId } = await client.call("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await client.call("Target.attachToTarget", { targetId, flatten: true });
    const requests = [];
    const scriptErrors = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.sessionId !== sessionId) return;
      if (message.method === "Network.requestWillBeSent") requests.push(message.params.request.url);
      if (message.method === "Runtime.exceptionThrown") scriptErrors.push(message.params.exceptionDetails.text);
      if (message.method === "Log.entryAdded" && message.params.entry.level === "error") scriptErrors.push(message.params.entry.text);
    });

    await Promise.all([
      client.call("Page.enable", {}, sessionId),
      client.call("Runtime.enable", {}, sessionId),
      client.call("Network.enable", {}, sessionId),
      client.call("Log.enable", {}, sessionId),
      client.call("Emulation.setDeviceMetricsOverride", {
        width: 320,
        height: 568,
        deviceScaleFactor: 1,
        mobile: true,
      }, sessionId),
      client.call("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      }, sessionId),
    ]);

    async function navigate(path) {
      const loaded = client.waitFor((message) => message.sessionId === sessionId && message.method === "Page.loadEventFired");
      await client.call("Page.navigate", { url: `${origin}/${path}` }, sessionId);
      await loaded;
      await delay(100);
    }

    async function inspect(expression) {
      const result = await client.call("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      }, sessionId);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    }

    async function pressKey(key, code, windowsVirtualKeyCode) {
      await client.call("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode }, sessionId);
      await client.call("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode }, sessionId);
      await delay(20);
    }

    await navigate("ctf.html");
    const launchLayout = await inspect(`({
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      safetyLabel: document.querySelector('.ctf-safety-label')?.textContent.includes('FICTIONAL, INERT SIMULATION'),
      startVisible: !document.querySelector('#ctf-start')?.hidden
    })`);
    assert.deepEqual(launchLayout, { innerWidth: 320, clientWidth: 320, scrollWidth: 320, safetyLabel: true, startVisible: true });

    const keyboardSequence = [];
    await inspect("document.activeElement?.blur()");
    for (let index = 0; index < 7; index += 1) {
      await pressKey("Tab", "Tab", 9);
      keyboardSequence.push(await inspect("document.activeElement?.id || document.activeElement?.getAttribute('href') || document.activeElement?.tagName"));
    }
    assert.ok(keyboardSequence.includes("ctf-start"), "Start control was not keyboard reachable");
    assert.ok(keyboardSequence.includes("#ctf-main"), "Skip link was not keyboard reachable");
    assert.ok(!keyboardSequence.includes("ctf-resume"), "Hidden Resume control was keyboard reachable");
    assert.ok(!keyboardSequence.includes("ctf-reset-launch"), "Hidden Reset control was keyboard reachable");

    await inspect("document.querySelector('#ctf-start').click()");
    await delay(100);
    const workspace = await inspect(`({
      visible: !document.querySelector('#ctf-workspace').hidden,
      focused: document.activeElement?.id,
      scrollWidth: document.documentElement.scrollWidth,
      skin: document.querySelector('#ctf-workspace').className,
      saveKeys: Object.keys(localStorage)
    })`);
    assert.equal(workspace.visible, true);
    assert.equal(workspace.focused, "node-title");
    assert.equal(workspace.scrollWidth, 320);
    assert.ok(workspace.skin.includes("ctf-skin-console"), "Threat track did not apply the console skin class");
    assert.ok(workspace.saveKeys.some((key) => key.startsWith("mangoSys.ctf")), "Starting did not create a versioned local save");

    const consoleMenu = await inspect(`({
      hasBanner: Boolean(document.querySelector('#ctf-console-chrome .ctf-console-banner')),
      firstMenuIndex: document.querySelector('#ctf-choices .ctf-menu-row .ctf-menu-index')?.textContent || '',
      menuButtons: document.querySelectorAll('#ctf-choices button[data-choice-id]').length,
      verbLabel: document.querySelector('#ctf-choices .ctf-menu-verb')?.textContent || ''
    })`);
    assert.equal(consoleMenu.hasBanner, true, "Console banner missing");
    assert.equal(consoleMenu.firstMenuIndex, "[1]", "First operation is not numbered [1]");
    assert.ok(consoleMenu.menuButtons >= 1, "No selectable operations rendered");
    assert.equal(consoleMenu.verbLabel, "SELECT", "Console operation verb must be SELECT, never run/execute");

    await inspect("document.querySelector('#ctf-reset').click()");
    const openedDialog = await inspect(`({ open: document.querySelector('#reset-dialog').open, focused: document.activeElement?.id })`);
    assert.deepEqual(openedDialog, { open: true, focused: "cancel-reset" });
    await pressKey("Escape", "Escape", 27);
    const closedDialog = await inspect(`({ open: document.querySelector('#reset-dialog').open, focused: document.activeElement?.id })`);
    assert.deepEqual(closedDialog, { open: false, focused: "ctf-reset" });

    const reloaded = client.waitFor((message) => message.sessionId === sessionId && message.method === "Page.loadEventFired");
    await client.call("Page.reload", {}, sessionId);
    await reloaded;
    await delay(100);
    assert.equal(await inspect("document.querySelector('#ctf-resume').hidden"), false, "Valid save was not offered after reload");

    await navigate("index.html");
    const portfolio = await inspect(`({
      exists: Boolean(document.querySelector('#portfolio')),
      ctfLink: document.querySelector('a[href="ctf.html"]')?.textContent.trim(),
      gameLink: document.querySelector('#launch a[href="game.html"]')?.textContent.trim(),
      missionCards: document.querySelectorAll('#launch .mission-card').length,
      heroCtas: document.querySelectorAll('.hero .hero-actions .button').length,
      scrollWidth: document.documentElement.scrollWidth
    })`);
    assert.equal(portfolio.exists, true);
    assert.ok(portfolio.ctfLink, "Launch bay is missing the CTF card link");
    assert.ok(portfolio.gameLink, "Launch bay is missing the game card link");
    assert.equal(portfolio.missionCards, 4, "Launch bay should have four mission cards");
    assert.equal(portfolio.heroCtas, 1, "Hero should have a single primary CTA");
    assert.equal(portfolio.scrollWidth, 320);

    const scannable = await inspect(`({
      sectionsVisible: ['profile','projects','contact','credits'].every((id) => {
        const el = document.getElementById(id);
        return Boolean(el) && el.offsetParent !== null;
      }),
      gameSectionGone: !document.getElementById('game'),
      ctfSectionGone: !document.getElementById('ctf'),
      navLinks: Array.from(document.querySelectorAll('.section-nav-link')).map((a) => a.getAttribute('href'))
    })`);
    assert.equal(scannable.sectionsVisible, true, "All hub sections must be visible in normal flow");
    assert.equal(scannable.gameSectionGone, true, "#game teaser section should be removed");
    assert.equal(scannable.ctfSectionGone, true, "#ctf teaser section should be removed");
    assert.deepEqual(scannable.navLinks, ["#launch", "#profile", "#projects", "#contact", "#credits"]);

    await inspect("window.scrollTo(0, document.getElementById('projects').offsetTop)");
    await delay(200);
    const spy = await inspect(`document.querySelector('.section-nav-link[href="#projects"]')?.getAttribute('aria-current')`);
    assert.equal(spy, "location", "Scroll-spy did not mark the Missions link current");

    await navigate("game.html");
    const game = await inspect(`({
      canvas: Boolean(document.querySelector('#viewport')?.getContext('2d')),
      raycaster: typeof Raycaster,
      startControl: document.querySelector('#start-game-btn')?.textContent.trim(),
      status: document.querySelector('#game-status')?.textContent.trim()
    })`);
    assert.equal(game.canvas, true);
    assert.equal(game.raycaster, "object");
    assert.ok(game.startControl);
    assert.equal(game.status, "Mission briefing ready.");

    const externalRequests = requests.filter((url) => !url.startsWith(`${origin}/`) && url !== "about:blank" && !url.startsWith("data:"));
    assert.deepEqual(externalRequests, [], `Unexpected non-loopback requests: ${externalRequests.join(", ")}`);
    assert.deepEqual(scriptErrors, [], `Browser script errors: ${scriptErrors.join("; ")}`);

    console.log(`Browser smoke passed: CTF 320px launch/workspace, keyboard/dialog focus, save/resume, portfolio, and raycaster.`);
    console.log(`Observed requests: ${requests.length}; non-loopback requests: ${externalRequests.length}.`);
    console.log(`Keyboard focus sequence: ${keyboardSequence.join(" -> ")}.`);
  } finally {
    if (socket?.readyState === WebSocket.OPEN) socket.close();
    if (chrome.exitCode === null) {
      const exited = new Promise((resolveExit) => chrome.once("exit", resolveExit));
      chrome.kill();
      await exited;
    }
    await new Promise((resolveClose) => server.close(resolveClose));
    const relativeProfile = relative(tmpdir(), profilePath);
    if (relativeProfile && !relativeProfile.startsWith(`..${sep}`) && !relativeProfile.includes(`${sep}..${sep}`)) {
      rmSync(profilePath, { recursive: true, force: true });
    }
  }
}

run().catch((error) => {
  console.error(`Browser smoke failed: ${error.message}`);
  process.exitCode = 1;
});
