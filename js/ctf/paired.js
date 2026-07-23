// A bounded cross-perspective consequence derived only from approved abstract
// threat state. It does not disclose a procedure, credential, or answer key.

export function getPairedConsequence(threatState) {
  const elevated = threatState !== null
    && threatState.endingId !== null
    && threatState.flags.severe_impact === true;
  return elevated
    ? {
        id: "paired_alert_elevated",
        alertPriority: "elevated",
        summary: "Paired handoff consequence: the initial synthetic alert is elevated because unresolved abstract impact remains in the prior track.",
      }
    : {
        id: "paired_alert_standard",
        alertPriority: "standard",
        summary: "Paired handoff consequence: the initial synthetic alert retains standard priority because no unresolved severe-impact marker was handed off.",
      };
}
