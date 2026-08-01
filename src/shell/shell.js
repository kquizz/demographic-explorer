export function createShell(el, store, { factorList, panels }) {
  el.classList.add('shell')
  el.innerHTML = `
    <header class="topbar">
      <span class="app-title">US Demographics Explorer</span>
      <span id="year-slot"></span>
      <span id="search-slot"></span>
    </header>
    <div class="body-row">
      <aside class="rail rail-left">
        <button class="collapse-toggle" aria-label="Collapse factors">◀</button>
        <div class="rail-title">FACTOR</div>
        <div class="factor-list"></div>
      </aside>
      <main id="map-slot" class="map-slot"></main>
      <aside class="rail rail-right">
        <button class="collapse-toggle" aria-label="Collapse analysis">▶</button>
        <div class="tabs"></div>
        <div class="panel-body" id="panel-slot"></div>
      </aside>
    </div>
    <footer class="appfooter">
      <span>Data:
        <a href="https://www.census.gov/programs-surveys/acs/" target="_blank" rel="noopener">U.S. Census Bureau — ACS 5-year estimates</a>
        (2012–2023) ·
        <a href="https://github.com/tonmcg/US_County_Level_Election_Results_08-24" target="_blank" rel="noopener">county presidential results compiled from official/AP returns</a>
        ·
        <a href="https://en.wikipedia.org/wiki/Government_trifecta" target="_blank" rel="noopener">state government trifectas compiled from Ballotpedia &amp; Wikipedia</a>
        ·
        <a href="https://www.bls.gov/lau/" target="_blank" rel="noopener">unemployment from the BLS Local Area Unemployment Statistics</a>
        ·
        <a href="https://www.bls.gov/cew/" target="_blank" rel="noopener">wages from the BLS Quarterly Census of Employment and Wages</a>
      </span>
      <span class="footer-note">Estimates carry margins of error; explore, don't over-read a single number.</span>
    </footer>
  `

  const factorListEl = el.querySelector('.factor-list')
  factorList.forEach((f) => {
    const pill = document.createElement('button')
    pill.className = 'factor-pill'
    pill.dataset.id = f.id
    pill.textContent = f.label
    pill.addEventListener('click', () => store.setState({ factor: f.id }))
    factorListEl.appendChild(pill)
  })

  const syncPills = (state) => {
    factorListEl.querySelectorAll('.factor-pill').forEach((p) =>
      p.classList.toggle('on', p.dataset.id === state.factor)
    )
  }

  const tabsEl = el.querySelector('.tabs')
  const panelSlot = el.querySelector('#panel-slot')
  let active = null

  const activate = (panel) => {
    if (active) active.unmount()
    panelSlot.innerHTML = ''
    tabsEl.querySelectorAll('.tab').forEach((t) =>
      t.classList.toggle('on', t.dataset.id === panel.id)
    )
    panel.mount(panelSlot, store)
    active = panel
  }

  panels.forEach((panel) => {
    const tab = document.createElement('button')
    tab.className = 'tab'
    tab.dataset.id = panel.id
    tab.textContent = panel.label
    tab.addEventListener('click', () => activate(panel))
    tabsEl.appendChild(tab)
  })

  el.querySelectorAll('.rail').forEach((rail) => {
    rail.querySelector('.collapse-toggle').addEventListener('click', () =>
      rail.classList.toggle('collapsed')
    )
  })

  store.subscribe(syncPills)
  syncPills(store.getState())
  if (panels.length) activate(panels[0])

  return {
    mapSlot: el.querySelector('#map-slot'),
    searchSlot: el.querySelector('#search-slot'),
    yearSlot: el.querySelector('#year-slot')
  }
}
