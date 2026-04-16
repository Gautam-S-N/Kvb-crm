const fyLogic = (date) => {
  const now = date || new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const fyStartYear = month >= 4 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  const fyString = `${String(fyStartYear).slice(-2)}-${String(fyEndYear).slice(-2)}`;
  return fyString;
};

console.log("Current Date (April 2026):", fyLogic(new Date('2026-04-16'))); // Expected: 26-27
console.log("Past Date (March 2026):", fyLogic(new Date('2026-03-15')));   // Expected: 25-26
console.log("Future Date (April 2027):", fyLogic(new Date('2027-04-01'))); // Expected: 27-28
