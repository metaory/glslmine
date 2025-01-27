const createSignal = (initial, validate = v => v) => {
  const subscribers = new Set()
  
  const notify = value => {
    for (const fn of subscribers) {
      try {
        fn(value)
      } catch (err) {
        console.warn('Subscriber error:', err)
      }
    }
    return value
  }

  const state = new Proxy({ value: validate(initial) }, {
    get: (target, prop) => {
      if (prop === 'value') return target[prop]
      return undefined
    },
    set: (target, prop, value) => {
      if (prop !== 'value') return false
      try {
        target[prop] = validate(value)
        return notify(target[prop])
      } catch (err) {
        console.warn('Validation error:', err)
        return false
      }
    }
  })

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {}
    subscribers.add(fn)
    fn(state.value) // Initial call
    function unsubscribe() {
      subscribers.delete(fn)
    }
    return unsubscribe
  }

  function get() {
    return state.value
  }

  function set(value) {
    state.value = value
  }

  function dispose() {
    subscribers.clear()
    state.value = validate(initial)
  }

  return [get, set, subscribe, dispose]
}

const validateShaders = shaders => 
  Array.isArray(shaders) ? shaders : []

const validateGridSize = size => 
  Math.max(100, Math.min(300, Number(size) || 160))

const validateFilters = filters => ({
  search: String(filters?.search || ''),
  source: String(filters?.source || 'all')
})

export const [getShaders, setShaders, onShaders, disposeShaders] = createSignal([], validateShaders)
export const [getGridSize, setGridSize, onGridSize, disposeGridSize] = createSignal(160, validateGridSize)
export const [getFilters, setFilters, onFilters, disposeFilters] = createSignal({ search: '', source: 'all' }, validateFilters)
