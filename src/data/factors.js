import { formatUsd, formatPercent, formatNumber, formatDecimal } from '../lib/format.js'

// Each factor maps to US Census ACS 5-year data, verified against the live API.
// `dataset` is the API path segment after the year: 'acs/acs5' (detail tables) or
// 'acs/acs5/profile' (Data Profile tables). Most factors are a single `variable`.
// A computed factor lists `variables` and a `compute(values)` that derives one value;
// this is used for education so the value is stable across all slider years (the
// profile percent code DP02_0068PE only became a percent in 2019).
const bachelorsPlus = (v) => {
  const total = v[0]
  if (!total) return null
  return ((v[1] + v[2] + v[3] + v[4]) / total) * 100 // bachelor + master + professional + doctorate
}

export const FACTOR_LIST = [
  { id: 'median_income', label: 'Median income', variable: 'B19013_001E', dataset: 'acs/acs5', format: formatUsd },
  { id: 'population', label: 'Population', variable: 'B01003_001E', dataset: 'acs/acs5', format: formatNumber },
  { id: 'median_age', label: 'Median age', variable: 'B01002_001E', dataset: 'acs/acs5', format: formatDecimal },
  { id: 'poverty_rate', label: 'Poverty rate', variable: 'DP03_0128PE', dataset: 'acs/acs5/profile', format: formatPercent },
  {
    id: 'bachelors_plus', label: "Bachelor's or higher", dataset: 'acs/acs5', format: formatPercent,
    variables: ['B15003_001E', 'B15003_022E', 'B15003_023E', 'B15003_024E', 'B15003_025E'],
    compute: bachelorsPlus
  },
  { id: 'median_home_value', label: 'Median home value', variable: 'B25077_001E', dataset: 'acs/acs5', format: formatUsd }
]

export const FACTORS = Object.fromEntries(FACTOR_LIST.map((f) => [f.id, f]))
