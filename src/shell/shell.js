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
