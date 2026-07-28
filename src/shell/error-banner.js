export function mountErrorBanner(el, store, factors) {
  el.innerHTML =
    '<div class="error-banner hidden"><span class="error-text"></span>' +
    '<button class="error-retry">Retry</button></div>'
  const banner = el.querySelector('.error-banner')
  const text = el.querySelector('.error-text')

  el.querySelector('.error-retry').addEventListener('click', () => {
    // Nudge the controller to refetch by clearing then re-setting the factor.
    const { factor } = store.getState()
    store.setState({ factor: null })
    store.setState({ factor })
  })

  store.subscribe((state) => {
    const isError = state.dataset.status === 'error'
    banner.classList.toggle('hidden', !isError)
    if (isError) {
      const label = factors[state.factor]?.label ?? state.factor
      text.textContent = `Couldn't load ${label} — `
    }
  })
}
