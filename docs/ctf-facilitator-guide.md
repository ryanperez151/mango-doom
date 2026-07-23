# Mango Keep facilitator guide

This guide supports an educational, fictional, data-only tabletop. It must not be expanded with real exploitation, administration, persistence, identity-change, or evasion procedures. The edge compromise is an unexplained starting premise; all later actions remain symbolic and all records remain synthetic.

## Session preparation

1. Serve the repository locally or from an approved static host and open `ctf.html`.
2. Run the release commands in [ctf-release-audit.md](ctf-release-audit.md) against the exact revision used for the session.
3. Complete and sign [ctf-manual-content-review.md](ctf-manual-content-review.md). An unsigned review is a release blocker.
4. Confirm that browser storage is permitted if learners need resume support. No account, backend, analytics, or remote handoff exists.
5. Ask about keyboard, motion, magnification, screen-reader, or pacing needs. The layout supports 320 CSS pixels and reduced motion, but automated checks do not replace assistive-technology testing.
6. State that source-visible answers make the activity educational rather than cheat-resistant. Do not use its score for certification or high-stakes assessment.

Recommended timing is 5–10 minutes for briefing, 45–75 minutes per perspective, and 10–20 minutes for debrief. Paired sessions work best with a threat player and defender sharing one device at the built-in handoff point.

## Facilitation approach

Let learners make and recover from poor decisions. When a player is stuck, prompt for classification before direction: “What is observed?”, “What is inferred?”, “What second source would change confidence?”, or “What business and preservation effects follow?” The built-in hint changes no score and is preferable to revealing a route.

For Incident Response, do not expose evidence ahead of its stage. Accept urgent containment without penalty when the player can point to visible ongoing simulated harm. When evidence is incomplete, ask the learner to distinguish a defensible interim action from a high-confidence finding.

For Paired Mode, the threat player completes their ending, then selects **Pass to Incident Responder**. The linked summary is intentionally bounded. The defender should not inspect the first player’s choices or source data. Discuss the cross-perspective consequence only after the response handoff.

## Debrief rubric

Use the ending and score as conversation aids, not a complete evaluation. Look for whether the learner can:

- separate premise, observation, inference, and confirmed scope;
- support major findings with cross-source evidence;
- describe an alternative benign or incomplete hypothesis;
- explain preservation, containment, and business tradeoffs;
- identify remaining uncertainty and recovery validation gates;
- hand off a concise timeline, scope statement, actions, and next steps.

Avoid turning the debrief into a real-world procedure. Discuss evidence relationships and decision quality only.

## Answer-key handling policy

This public repository intentionally contains no completed instructor answer key. A completed key would undermine the exercise and may accidentally accumulate operational detail.

- Keep completed facilitator answers outside the deployed site and outside any public repository clone.
- Use an access-controlled organization document or local encrypted facilitator storage appropriate to your environment.
- Do not paste completed routes, evidence combinations, scores, codes, or hidden narrative into public issues, pull requests, release artifacts, or the repository root.
- Review completed notes against [ctf-safety.md](ctf-safety.md); they must remain conceptual even when private.

### Blank answer-key template

Copy this template to the approved external facilitator location and complete it there. Leave the repository copy blank.

```text
Session/revision: ______________________________________________
Facilitator: ___________________________________________________

Learning objective being assessed: _____________________________
Expected learner claim (conceptual only): _______________________
Primary synthetic evidence category: ___________________________
Corroborating synthetic evidence category: _____________________
Plausible alternative hypothesis: ______________________________
Confidence and remaining gap: __________________________________
Preservation/containment tradeoff: ______________________________
Recovery validation expected: __________________________________
Communication/handoff elements: ________________________________

Threat route discussion notes: _________________________________
Incident Response discussion notes: ____________________________
Paired consequence discussion notes: ___________________________
Accessibility or pacing adjustments: ___________________________
Safety review completed by/date: _______________________________
```

## After the session

Reset the CTF through its confirmation dialog on shared devices. Collect only course-level feedback that your organization has separately authorized; the CTF itself sends nothing. Record product defects without including learner notes, completed answers, real incident information, or prohibited operational material.
