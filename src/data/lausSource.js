// The LAUS unemployment bundle is a value-per-FIPS-per-year dataset, so its source is just
// the generic FIPS/year source. Kept as a named re-export for clarity at call sites and
// for the existing tests.
export { createFipsYearSource as createLausSource } from './fipsYearSource.js'
