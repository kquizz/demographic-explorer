export function createStore(initialState) {
  let state = { ...initialState }
  const listeners = new Set()

  const getState = () => state

  const changed = (partial) =>
    Object.keys(partial).some((k) => partial[k] !== state[k])

  const setState = (partial) => {
    if (!changed(partial)) return
    state = { ...state, ...partial }
    for (const fn of listeners) fn(state)
  }

  const subscribe = (fn) => {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { getState, setState, subscribe }
}
