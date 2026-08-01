// U.S. Census Bureau's four statistical regions, by state FIPS. Used by the trifecta
// panel to compare Republican- vs Democratic-trifecta outcomes *within* a region — the
// cheapest guard against the geographic confound (red trifectas cluster in the South,
// which has structurally higher poverty for reasons predating current control).
export const REGIONS = {
  Northeast: ['09', '23', '25', '33', '34', '36', '42', '44', '50'],
  Midwest: ['17', '18', '19', '20', '26', '27', '29', '31', '38', '39', '46', '55'],
  South: ['01', '05', '10', '11', '12', '13', '21', '22', '24', '28', '37', '40', '45', '47', '48', '51', '54'],
  West: ['02', '04', '06', '08', '15', '16', '30', '32', '35', '41', '49', '53', '56']
}

export const REGION_OF = Object.fromEntries(
  Object.entries(REGIONS).flatMap(([region, fipsList]) => fipsList.map((fips) => [fips, region]))
)
