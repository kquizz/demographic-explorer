import { formatUsd, formatPercent, formatNumber, formatDecimal, formatGini, formatMargin } from '../lib/format.js'

// Each factor maps to US Census ACS 5-year data, verified against the live API across
// the full slider range (2012-2023). `dataset` is the API path segment after the year:
// 'acs/acs5' (detail tables) or 'acs/acs5/profile' (Data Profile tables). Most factors
// are a single `variable`; a computed factor lists `variables` and a `compute(values)`
// that derives one value (values arrive in the order of `variables`). Computed factors
// use detail-table (B-code) counts so they stay stable across every slider year — the
// profile percent codes (DP...) drift between vintages.

// Two share-shaped computes cover every derived factor:
// ratioPct: variables = [numerator, denominator]        -> numerator / denominator * 100
// sharePct: variables = [total, part, part, ...]        -> sum(parts) / total * 100
const ratioPct = (v) => (v[1] ? (v[0] / v[1]) * 100 : null)
const sharePct = (v) => {
  const total = v[0]
  if (!total) return null
  return (v.slice(1).reduce((sum, n) => sum + (n || 0), 0) / total) * 100
}

export const FACTOR_LIST = [
  // Population & age
  { id: 'population', label: 'Population', variable: 'B01003_001E', dataset: 'acs/acs5', format: formatNumber },
  { id: 'median_age', label: 'Median age', variable: 'B01002_001E', dataset: 'acs/acs5', format: formatDecimal },

  // Economic
  { id: 'median_income', label: 'Median income', variable: 'B19013_001E', dataset: 'acs/acs5', format: formatUsd },
  { id: 'per_capita_income', label: 'Per-capita income', variable: 'B19301_001E', dataset: 'acs/acs5', format: formatUsd },
  { id: 'poverty_rate', label: 'Poverty rate', variable: 'DP03_0128PE', dataset: 'acs/acs5/profile', format: formatPercent },
  {
    id: 'unemployment_rate', label: 'Unemployment rate', dataset: 'acs/acs5', format: formatPercent,
    variables: ['B23025_005E', 'B23025_003E'], compute: ratioPct // unemployed / civilian labor force
  },
  { id: 'gini_index', label: 'Income inequality (Gini)', variable: 'B19083_001E', dataset: 'acs/acs5', format: formatGini },

  // Education
  {
    id: 'hs_plus', label: 'High school or higher', dataset: 'acs/acs5', format: formatPercent,
    variables: [
      'B15003_001E', 'B15003_017E', 'B15003_018E', 'B15003_019E', 'B15003_020E',
      'B15003_021E', 'B15003_022E', 'B15003_023E', 'B15003_024E', 'B15003_025E'
    ],
    compute: sharePct
  },
  {
    id: 'bachelors_plus', label: "Bachelor's or higher", dataset: 'acs/acs5', format: formatPercent,
    variables: ['B15003_001E', 'B15003_022E', 'B15003_023E', 'B15003_024E', 'B15003_025E'],
    compute: sharePct // bachelor + master + professional + doctorate
  },

  // Housing
  { id: 'median_home_value', label: 'Median home value', variable: 'B25077_001E', dataset: 'acs/acs5', format: formatUsd },
  { id: 'median_gross_rent', label: 'Median gross rent', variable: 'B25064_001E', dataset: 'acs/acs5', format: formatUsd },
  {
    id: 'homeownership_rate', label: 'Homeownership rate', dataset: 'acs/acs5', format: formatPercent,
    variables: ['B25003_002E', 'B25003_001E'], compute: ratioPct // owner-occupied / occupied units
  },

  // Race, ethnicity & origin (B03002 = Hispanic origin by race; _003/_004/_006 are non-Hispanic)
  {
    id: 'pct_hispanic', label: '% Hispanic or Latino', dataset: 'acs/acs5', format: formatPercent,
    variables: ['B03002_012E', 'B03002_001E'], compute: ratioPct
  },
  {
    id: 'pct_white_nh', label: '% White (non-Hispanic)', dataset: 'acs/acs5', format: formatPercent,
    variables: ['B03002_003E', 'B03002_001E'], compute: ratioPct
  },
  {
    id: 'pct_black', label: '% Black', dataset: 'acs/acs5', format: formatPercent,
    variables: ['B03002_004E', 'B03002_001E'], compute: ratioPct
  },
  {
    id: 'pct_asian', label: '% Asian', dataset: 'acs/acs5', format: formatPercent,
    variables: ['B03002_006E', 'B03002_001E'], compute: ratioPct
  },
  {
    id: 'pct_foreign_born', label: '% Foreign-born', dataset: 'acs/acs5', format: formatPercent,
    variables: ['B05002_013E', 'B05002_001E'], compute: ratioPct
  },

  // Elections — bundled dataset (not Census). Diverging red<->blue by Dem-Rep margin;
  // uses the election-year picker (2020/2024) instead of the ACS year slider.
  { id: 'vote_margin', label: 'Presidential margin', source: 'elections', scale: 'diverging', format: formatMargin }
]

export const FACTORS = Object.fromEntries(FACTOR_LIST.map((f) => [f.id, f]))
