import { formatUsd, formatPercent, formatNumber, formatDecimal } from '../lib/format.js'

// Each factor maps to a US Census ACS 5-year variable, verified against the live API.
// `dataset` is the API path segment after the year: 'acs/acs5' (detail tables) or
// 'acs/acs5/profile' (Data Profile tables, which expose precomputed percentages).
export const FACTOR_LIST = [
  { id: 'median_income', label: 'Median income', variable: 'B19013_001E', dataset: 'acs/acs5', format: formatUsd },
  { id: 'population', label: 'Population', variable: 'B01003_001E', dataset: 'acs/acs5', format: formatNumber },
  { id: 'median_age', label: 'Median age', variable: 'B01002_001E', dataset: 'acs/acs5', format: formatDecimal },
  { id: 'poverty_rate', label: 'Poverty rate', variable: 'DP03_0128PE', dataset: 'acs/acs5/profile', format: formatPercent },
  { id: 'bachelors_plus', label: "Bachelor's or higher", variable: 'DP02_0068PE', dataset: 'acs/acs5/profile', format: formatPercent },
  { id: 'median_home_value', label: 'Median home value', variable: 'B25077_001E', dataset: 'acs/acs5', format: formatUsd }
]

export const FACTORS = Object.fromEntries(FACTOR_LIST.map((f) => [f.id, f]))
