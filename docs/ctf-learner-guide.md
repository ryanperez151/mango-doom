# Mango Keep learner guide

The Mango Keep Incident is a fictional, inert, data-only security simulation. Every event is synthetic, every choice is pre-authored, and no action contacts or changes a real system. It is an educational static-site exercise, so its source-visible logic is not cheat-resistant.

## Choose a mode

- **Threat Simulation** asks you to reason from an already-compromised fictional edge device through management trust, virtualization evidence, abstract persistence, reversible fictional identity impact, and containment consequences. It rewards evidence-aware reasoning, proportionate impact, and documentation—not stealth or intrusion depth.
- **Incident Response** begins with one synthetic edge alert. You must uncover supporting evidence, test alternative hypotheses, decide when to preserve or contain, reconstruct the timeline, validate recovery, and prepare a handoff.
- **Paired Mode** runs Threat Simulation first and Incident Response second on the same device. The defender receives only a bounded consequence summary and begins with the initial edge alert; hidden evidence is still discovered through play.

Expected play time is 45–60 minutes for Threat Simulation, 60–75 minutes for Incident Response, and 75–90 minutes for Paired Mode with discussion.

## Start, resume, and reset

Open `ctf.html`, select a perspective, and choose **Start New Simulation**. Progress, bookmarks, and notes are saved under one versioned CTF key in this browser. **Save Now** confirms the current local state. A valid save makes **Resume Saved Simulation** available after a reload or return visit.

**Reset** opens a confirmation dialog and removes only the CTF save, bookmarks, and notes. It does not clear other site storage. An obsolete or malformed save is not restored; reset it to begin again.

## Work the case

At each node, read the narrative and current objective before choosing an action. Each choice states its objective and prerequisite. A locked choice stays visible with a plain-language explanation, but it cannot change state.

Use the workspace to:

- inspect unlocked evidence and its synthetic timestamp;
- bookmark evidence and timeline events that support a conclusion;
- keep bounded local notes about hypotheses and uncertainty;
- filter revealed events by source, host, severity, stage, and time;
- compare asset health with containment status;
- collect evidence codes earned through reasoning or completed symbolic transitions;
- reveal a learning hint without changing score or state.

The timeline exposes only events available at the current investigation stage. Absence from the visible timeline is not proof that an event does not exist. Strong conclusions should cite a primary signal and corroboration from another source when the objective calls for high confidence.

## Evidence and scoring

Threat Simulation scores trust-boundary reasoning, evidence awareness, minimizing unnecessary impact, and documentation. Incident Response scores correlation, scope, preservation, containment, recovery, and communication. Scores can be negative when a choice records an unsupported conclusion or avoidable consequence; they never reward stealth, evasion, or destructive impact.

An urgent containment choice is not penalized when visible evidence establishes ongoing simulated harm. Other moments deliberately ask you to weigh evidence preservation against business effects. Poor decisions remain recoverable and lead to a debrief or replay path.

## Accessibility and privacy

All controls are standard buttons, links, radios, selects, text areas, details, and a native confirmation dialog. The experience supports keyboard-only play, visible focus, reduced motion, status announcements, and a 320 CSS-pixel layout. Use the **Skip to simulation** link to bypass the page header. Escape closes the reset dialog and returns focus to its trigger.

Notes stay in local browser storage, are rendered as inert text, and are never interpreted as commands or sent anywhere. Do not enter real case data, personal information, secrets, targets, or credentials.

## Debrief questions

After an ending, review the case workspace and discuss:

1. Which conclusions were directly observed, inferred, or still uncertain?
2. Which cross-source correlation most changed the working hypothesis?
3. What evidence could have been lost through premature response?
4. When did the visible evidence justify urgent containment?
5. What must be validated before service and trust are considered restored?

The repository does not publish a completed answer key. If a facilitator is present, their completed notes should be kept outside the deployed site.
