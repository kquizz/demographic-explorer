import { formatUsd, formatPercent, formatNumber } from '../lib/format.js'

// `measure` is the Data USA API measure name. Verify exact strings against the
// live API in Task 4 (a curl step is included there) and adjust if needed.
export const FACTOR_LIST = [
  { id: 'median_income', label: 'Median income', measure: 'Household Income', format: formatUsd },
  { id: 'population', label: 'Population', measure: 'Population', format: formatNumber },
  { id: 'poverty_rate', label: 'Poverty rate', measure: 'Poverty Rate', format: formatPercent },
  { id: 'median_age', label: 'Median age', measure: 'Median Age', format: formatNumber }
]

export const FACTORS = Object.fromEntries(FACTOR_LIST.map((f) => [f.id, f]))
