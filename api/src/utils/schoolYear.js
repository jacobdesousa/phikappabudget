function schoolYearStartForDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const month = d.getMonth(); // 0=Jan ... 8=Sep
  // School year starts in September
  return month >= 8 ? y : y - 1;
}

function currentSchoolYearStart() {
  return schoolYearStartForDate(new Date());
}

module.exports = { schoolYearStartForDate, currentSchoolYearStart };


