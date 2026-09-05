// Shared, single-source copy so these claims stay identical everywhere they
// appear (product modal, legal pages) instead of drifting per edit.

export const PROVEN_FLOW_NOTE = 'This is a working automation flow already in active use across real client operations, not a one-off script.';

export const OUTCOME_DISCLAIMER = 'Outcomes depend on your own proxy quality, device fingerprint, and current platform enforcement. No automation vendor can guarantee against bans, shadowbans, or suspensions — see our Refund Policy for what compatibility support does and doesn\'t cover.';

export function getCompatibilityNote(platformLabel) {
  return `If ${platformLabel} changes its app and breaks this flow's automation steps within 30 days of delivery, we'll ship a fix at no charge. This covers compatibility breakage only — it does not cover bans, shadowbans, or suspensions. Full terms are in our Refund Policy.`;
}
