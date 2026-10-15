/**
 * Local copy of the essay being written, so no navigation, expired session,
 * or failed request can lose the applicant's text.
 */
export interface LocalDraft {
  title: string;
  scholarship: string;
  content: string;
  savedAt: number;
  /** Set when a guest pressed Evaluate; the evaluator resumes it after sign-in. */
  pendingEvaluation?: boolean;
}

const key = (draftId: string | null) => `essaymentor-draft:${draftId ?? "new"}`;

export function loadDraft(draftId: string | null): LocalDraft | null {
  try {
    const raw = localStorage.getItem(key(draftId));
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draftId: string | null, draft: Omit<LocalDraft, "savedAt">) {
  try {
    localStorage.setItem(key(draftId), JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked: the text still lives in memory for this session.
  }
}

export function clearDraft(draftId: string | null) {
  try {
    localStorage.removeItem(key(draftId));
  } catch {
    // ignore
  }
}
