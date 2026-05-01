function parsePledgeClass(pledgeClass) {
  if (!pledgeClass || typeof pledgeClass !== "string") return null;
  const m = pledgeClass.trim().match(/^(Fall|Spring)\s+(\d{4})$/i);
  if (!m) return null;
  const term = m[1].toLowerCase(); // fall | spring
  const year = Number(m[2]);
  if (!Number.isFinite(year)) return null;
  return { term, year };
}

function duesCategoryForBrother(pledgeClass, schoolYearStart) {
  const parsed = parsePledgeClass(pledgeClass);
  if (!parsed) return "regular";

  // Neophyte definition:
  // For school year YYYY-(YYYY+1), neophytes are Fall YYYY and Spring YYYY+1 pledge classes.
  const isNeophyte =
    (parsed.term === "fall" && parsed.year === schoolYearStart) ||
    (parsed.term === "spring" && parsed.year === schoolYearStart + 1);

  return isNeophyte ? "neophyte" : "regular";
}

module.exports = { parsePledgeClass, duesCategoryForBrother };


