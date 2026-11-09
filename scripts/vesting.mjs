import fs from 'node:fs';

const plan = JSON.parse(fs.readFileSync(new URL('../vesting-plan.json', import.meta.url)));
export function vestedTokens(monthsAfterStart) {
  if (monthsAfterStart < 0) return 0;
  if (monthsAfterStart < plan.cliff_months) return plan.immediately_available;
  const months = Math.min(monthsAfterStart - plan.cliff_months + 1, plan.linear_release_months);
  return plan.immediately_available + months * plan.monthly_release;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({month0: vestedTokens(0), month11: vestedTokens(11), month12: vestedTokens(12), month35: vestedTokens(35), month36: vestedTokens(36)}, null, 2));
}
