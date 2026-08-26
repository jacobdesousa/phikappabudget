import { IBrother } from "../interfaces/api.interface";

// Free-text search across everything visible on a brother's row: names, email,
// phone, pledge class, graduation, offices and status.
//
// Tokens are AND-ed, so "andrew 408" narrows rather than widens, and each token
// only has to appear somewhere in the row. Matching is substring rather than
// true edit-distance fuzz: on a roster this size a typo-tolerant match mostly
// produces noise, while "lin" finding Lint is what people actually expect.

// Lowercase and strip accents so "Núñez" is reachable by typing "nunez".
function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

// Everything about a brother, flattened into one string to scan.
function haystack(brother: IBrother): string {
  const offices = (brother.current_offices ?? []).map((o) => o.display_name).join(" ");
  return normalize(
    [
      brother.first_name,
      brother.last_name,
      // Also as one string, so "andrew lint" matches without the token split
      // having to line up with the column order.
      `${brother.first_name ?? ""} ${brother.last_name ?? ""}`,
      brother.email,
      brother.email_secondary,
      brother.phone,
      brother.pledge_class,
      brother.graduation,
      brother.status,
      offices,
      brother.office,
      brother.city,
      brother.province,
    ].join(" ")
  );
}

export function matchesBrotherSearch(brother: IBrother, query: string): boolean {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const text = haystack(brother);
  // Phone is stored E.164 and displayed as "(408) 594-5700", so a digit run
  // typed either way — with or without punctuation — has to reach it.
  const phoneDigits = digitsOnly(brother.phone);

  return tokens.every((token) => {
    if (text.includes(token)) return true;
    const tokenDigits = digitsOnly(token);
    return tokenDigits.length > 0 && phoneDigits.includes(tokenDigits);
  });
}
