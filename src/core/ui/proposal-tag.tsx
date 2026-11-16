/**
 * Marks a control for a feature the API doesn't offer yet (a design proposal outside the current contract).
 * Clicking such a control should explain that instead of doing anything: see `proposalMessage`.
 * When the backend adds the feature, remove the tag and wire the control.
 */
export function ProposalTag() {
  return (
    <span className="ml-1.5 rounded-full border border-dashed border-ink-3 px-1.5 py-px align-middle text-[10px] font-semibold uppercase tracking-wider text-ink-3">
      Bientôt
    </span>
  );
}

/** e.g. proposalMessage("L'ajout d'adresse") → "L'ajout d'adresse arrive bientôt : ce n'est pas encore disponible." */
export const proposalMessage = (what: string) => `${what} arrive bientôt : ce n'est pas encore disponible.`;
