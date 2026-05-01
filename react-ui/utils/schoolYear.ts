export function schoolYearStartForDate(date: Date): number {
  const y = date.getFullYear();
  const month = date.getMonth(); // 0=Jan ... 8=Sep
  return month >= 8 ? y : y - 1;
}

export function schoolYearLabel(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}


