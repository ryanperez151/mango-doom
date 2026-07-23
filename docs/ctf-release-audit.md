# Mango Keep release audit

Audit date: 2026-07-21  
Scope: current working tree, pre-commit and pre-deployment  
Disposition: **automated acceptance checks pass; learner release remains blocked until the manual operational-content checklist is completed and signed.**

## Guardrail and scope

The audit treated the CTF as a closed, fictional, data-only simulation. It did not connect to, scan, authenticate to, or modify any device, VM, directory, network, or cloud service. Browser validation served repository files only on `127.0.0.1`; the browser was launched with background networking disabled and a resolver rule that blocked non-loopback hosts. No commit or deployment was performed.

No new gameplay feature was added. One in-scope release defect was fixed: CTF buttons styled as `inline-flex` could override the browser's default rendering of the `hidden` attribute, exposing unavailable Resume/Reset controls to sighted keyboard users. The CTF stylesheet now enforces hidden state within `.ctf-page`, and the browser smoke test asserts those controls are absent from the launch tab order.

## Required playthroughs

The deterministic route runner checks choice availability at every step, prerequisite evidence, visible-evidence chronology, mapped event IDs, final save/restore identity, ending, flags, score relationships, and the paired consequence.

| Route | Result | Decisions | Visible evidence | Key result |
| --- | --- | ---: | ---: | --- |
| Successful Threat Simulation | `ending_well_contained` | 16 | 14 | Positive trust reasoning and impact restraint; all major transitions emitted synthetic observables. |
| Noisy/mistaken Threat Simulation | `ending_severe_debrief` | 23 | 14 | Lower trust and impact scores than the successful route; still reached a useful debrief. |
| Strong Incident Response | `ir_ending_confident` | 12 | 13 | Evidence preserved, recovery validated, and justified urgent containment retained positive credit. |
| Premature-containment Incident Response | `ir_ending_evidence_lost` | 12 | 1 | Evidence loss and incomplete correlation were reflected in the ending and score. |
| Delayed-containment Incident Response | `ir_ending_partial` | 12 | 13 | Preservation succeeded, but incomplete containment/recovery remained explicit. |
| Paired Mode | threat `ending_well_contained`; `paired_alert_standard`; defender `ir_ending_confident` | 28 total | 14 + 13 | Threat state serialized/restored before the bounded consequence and defender run. |

Threat metrics for the successful route were `trust_reasoning 8`, `evidence_awareness 6`, `minimize_impact 4`, and `documentation 13`; the noisy route recorded `-4`, `7`, `-9`, and `7`. Strong IR recorded `correlation 9`, `scope 7`, `preservation 6`, `containment 3`, `recovery 3`, and `communication 5`. Premature response recorded lower correlation/preservation and the evidence-loss flag; delayed containment retained preservation credit but less containment and recovery credit.

## Acceptance findings

- **Chronology:** all 144 telemetry events use one nondecreasing UTC timeline. Visible evidence remained chronological in all six paths. No intentional clock skew is present.
- **Evidence availability:** the defender begins with one edge alert. All 27 evidence records map to existing synthetic event IDs and learner nodes. Route assertions prevent a choice from using locked evidence. Each required high-confidence conclusion is supported by its visible cross-source dependency before the corresponding high-value choice becomes available.
- **Scoring:** successful/noisy and strong/premature/delayed comparisons match the specified learning incentives. Clear ongoing simulated harm permits urgent targeted containment without a preservation penalty. No test or score rewards stealth.
- **Branch reachability:** Threat Simulation has 24 reachable nodes and 4 reachable endings; Incident Response has 13 reachable nodes and 4 reachable endings. Contract validation rejects unreachable nodes, unreachable endings, and nonterminal nodes without an unconditional recovery choice.
- **Save behavior:** engine and browser tests cover versioned save, replay-based restore, reset namespace isolation, corrupt/obsolete recovery, Paired Mode state, focus after reload, and Resume availability. Unrelated local storage survives corrupt-save cleanup.
- **Mobile layout:** Chromium device emulation reported `innerWidth`, `clientWidth`, and `scrollWidth` of 320 CSS pixels for both the CTF launch and populated workspace, with reduced motion enabled. The portfolio also reported a 320-pixel scroll width.
- **Keyboard access:** the skip link, portfolio return, perspective radio group, and Start control were keyboard reachable. Hidden launch actions were absent from the tab order. Starting moved focus to the node heading. The native reset dialog focused Cancel; Escape closed it and returned focus to Reset.
- **Conclusion support:** route validation checked that evidence prerequisites were unlocked, every visible artifact had event mappings, and high-confidence paths did not advance before their required correlations. Partial and evidence-lost endings explicitly retain uncertainty rather than overstating scope.
- **Portfolio and raycaster:** the portfolio DOM and CTF navigation link loaded at 320 CSS pixels. The existing game canvas returned a 2D context, the original `Raycaster` API initialized, the start control was present, and the accessible status remained “Mission briefing ready.” Diff inspection found no changes to `game.html`, `css/game.css`, `js/raycaster.js`, or `js/game.js`.
- **External requests:** static scans found no request APIs, dynamic imports, remote assets, external forms, or target-like input in the CTF runtime. The browser observed 37 loopback/data resource requests and zero non-loopback network requests across CTF, portfolio, and game pages.

## Validation commands and results

Commands were run from the repository root. This Windows environment did not expose a standalone `node` command, so the JavaScript runners used VS Code's bundled Node-compatible runtime with `ELECTRON_RUN_AS_NODE=1`. A normal Node.js 20+ installation can run the same `.mjs` files directly.

| Command | Result |
| --- | --- |
| `.\tests\validate-ctf.ps1` | Pass. 144 events; 94 benign (`65.3%`); 50 signal; 12 datasets; 10 evidence-manifest artifacts; 27 event/evidence mappings; 14 runtime/data files safety-scanned. Zero duplicate/order/reference/domain/address/identifier failures; zero network, dynamic execution, unsafe rendering, remote asset, upload, target-input, secret-shape, or strong operational-pattern failures. Review-aid hits: command language 4, credential language 2, persistence language 37; human review required. |
| `$env:ELECTRON_RUN_AS_NODE='1'; & 'C:\Program Files\Microsoft VS Code\Code.exe' tests\run-ctf-engine.mjs` | Pass: 42 tests, 0 failures. |
| `$env:ELECTRON_RUN_AS_NODE='1'; & 'C:\Program Files\Microsoft VS Code\Code.exe' tests\run-ctf-playthroughs.mjs` | Pass: all 6 required routes; expected endings, evidence, flags, score relationships, chronology, mappings, and paired consequence. |
| `$env:ELECTRON_RUN_AS_NODE='1'; & 'C:\Program Files\Microsoft VS Code\Code.exe' tests\run-site-browser-smoke.mjs` | Pass after the hidden-control fix: 320 CSS-pixel CTF launch/workspace, keyboard/dialog focus, save/resume, portfolio, and raycaster. 37 observed local/data requests; 0 non-loopback requests; 0 script errors. |
| VS Code bundled Node `--check` over `js/ctf/*.js`, `data/ctf/*.js`, and the `.mjs` runners | Pass: all checked JavaScript parsed successfully. |
| Python standard-library HTML/JSON/XML and local-reference audit for `index.html`, `game.html`, `ctf.html`, telemetry/manifests, and `sitemap.xml` | Pass: documents parsed, HTML IDs were unique, and referenced local files existed. |
| Python standard-library Markdown link audit for `README.md` and `docs/*.md` | Pass: 24 local documentation targets resolved. |
| `git -c safe.directory=C:/Users/Mango/mango-doom diff --check` | Pass: no whitespace errors. |
| `git -c safe.directory=C:/Users/Mango/mango-doom diff -- game.html css/game.css js/raycaster.js js/game.js` | Pass: no raycaster/game changes. |

Exploratory browser commands using the default `py` launcher did not produce a valid page because that launcher pointed to an unavailable Python installation. A plain `--window-size=320` headless screenshot was also rejected as evidence after Chrome reported a 500 CSS-pixel minimum viewport. The final DevTools-based smoke test used the installed Python only for an intermediate loopback check and then used native 320 CSS-pixel device emulation; temporary browser profiles and screenshots were removed.

## Assumptions and limitations

- Chrome is installed at its standard Windows path for the automated browser smoke. Other platforms must adapt the launcher or perform equivalent local browser checks.
- The browser smoke checks semantic focus behavior and layout dimensions, not a full screen-reader experience, contrast audit, zoom matrix, or automated accessibility ruleset.
- Static-site source exposes scenario logic and scores. The CTF is educational, not cheat-resistant or suitable for high-stakes assessment.
- Paired Mode is same-device and local-only; it has no account, export, network, or remote collaboration feature.
- Browser local storage is origin-specific. Changing preview ports or hosts creates a different storage origin.

## Remaining release issues

1. [The manual operational-content review](ctf-manual-content-review.md) is intentionally unsigned. A named human reviewer must inspect every learner-visible string, resolve each review-aid hit in context, and sign the checklist before learner release.
2. A manual assistive-technology pass, browser zoom matrix, and automated accessibility scan remain recommended before public deployment because those tools were not bundled with this repository.
3. The facilitator guide supplies only a blank answer-key template. Any completed facilitator answers must remain outside the deployed site and public repository.
