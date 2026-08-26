import { IRevenue } from "../interfaces/api.interface";
import { schoolYearLabel } from "./schoolYear";

// Free-text search over a revenue entry: description, category, date, school
// year and every amount. Tokens are AND-ed, each only has to match somewhere.
// Mirrors the roster search in brotherSearch.ts.

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function haystack(entry: IRevenue): string {
  const date = entry.date ? new Date(entry.date) : null;
  const dateForms = date
    ? [
        date.toISOString().slice(0, 10),
        date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
        date.toLocaleDateString(undefined, { year: "numeric", month: "long" }),
      ]
    : [];

  return normalize(
    [
      entry.description,
      entry.category_name,
      ...dateForms,
      entry.school_year,
      entry.school_year ? schoolYearLabel(entry.school_year) : "",
      // Amounts as typed, so "250" finds a $250.00 entry.
      entry.amount,
      entry.cash_amount,
      entry.square_amount,
      entry.etransfer_amount,
      entry.cheque_amount,
    ].join(" ")
  );
}

export function matchesRevenueSearch(entry: IRevenue, query: string): boolean {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const text = haystack(entry);
  return tokens.every((token) => text.includes(token));
}
