import type { ProjectState } from "./types";

const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();

/** Mark a quote verified only when its complete text occurs in the supplied source. */
export function verifyEvidence(state: ProjectState, source: string, sourcePart = 1): ProjectState {
  const normalizedSource = normalize(source);
  const evidence = state.evidence.map((item) => {
    const quote = normalize(item.quote);
    if (!quote) return { ...item, verified: false, sourcePart: undefined, sourceStart: undefined };
    const at = normalizedSource.indexOf(quote);
    if (at < 0) return { ...item, verified: false, sourcePart: undefined, sourceStart: undefined };
    // Keep an offset when the original quote is also an exact substring. Normalized-only
    // matches remain verified but have no raw character offset.
    const rawAt = source.toLocaleLowerCase().indexOf(item.quote.toLocaleLowerCase());
    return { ...item, verified: true, sourcePart, sourceStart: rawAt >= 0 ? rawAt : undefined };
  });
  return { ...state, evidence };
}

/** Preserve provenance for earlier quotes when an AI update carries them forward. */
export function retainEvidenceProvenance(next: ProjectState, previous: ProjectState): ProjectState {
  const old = new Map(previous.evidence.map((e) => [`${normalize(e.claim)}\u0000${normalize(e.quote)}`, e]));
  return { ...next, evidence: next.evidence.map((e) => old.get(`${normalize(e.claim)}\u0000${normalize(e.quote)}`) ?? e) };
}
