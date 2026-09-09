// Display names for the expense workflow statuses.
//
// The stored values are lowercase keys — "approved", "paid", "recorded" — and
// showing them raw makes the UI read like a database dump. "recorded" in
// particular means nothing to a reader without the context that it is spend no
// cheque will settle.
const LABELS: Record<string, string> = {
  submitted: "Submitted",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
  recorded: "Recorded",
};

// Chip colours, chosen so the two settled states read as done, the one waiting
// reads as waiting, and a rejection stands out.
const COLORS: Record<string, "default" | "info" | "success" | "warning" | "error"> = {
  submitted: "warning",
  approved: "info",
  paid: "success",
  rejected: "error",
  recorded: "default",
};

// What each state actually means, for the places with room to say so.
const DESCRIPTIONS: Record<string, string> = {
  submitted: "Waiting on review",
  approved: "Approved, awaiting a cheque",
  paid: "Reimbursed by cheque",
  rejected: "Rejected during review",
  recorded: "Settled with no cheque — a direct debit, card charge or correction",
};

export function expenseStatusLabel(status?: string | null): string {
  if (!status) return "—";
  // An unknown value is still worth showing, just tidied.
  return LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

export function expenseStatusColor(
  status?: string | null
): "default" | "info" | "success" | "warning" | "error" {
  return (status && COLORS[status]) || "default";
}

export function expenseStatusDescription(status?: string | null): string {
  return (status && DESCRIPTIONS[status]) || "";
}
