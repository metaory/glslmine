const createSignal = (initial) => {
  const subscribers = new Set()

  const proxy = new Proxy({ value: initial }, {
    get: (target, prop) => target[prop],
    set: (target, prop, value) => {
      target[prop] = value
      subscribers.forEach(fn => fn(value))
      return true
    }
  })

  return [
    () => proxy.value,
    (v) => proxy.value = v,
    (fn) => subscribers.add(fn)
  ]
}

const state = {
  shaders: createSignal([]),
  gridSize: createSignal(160),
  filters: createSignal({
    search: '',
    source: 'all'
  })
}

export const [getShaders, setShaders, onShaders] = state.shaders
export const [getFilters, setFilters, onFilters] = state.filters
export const [getGridSize, setGridSize, onGridSize] = state.gridSize
