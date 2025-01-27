import { getFilters, setFilters, getGridSize, setGridSize, getShaders, onShaders } from './state.js'

const createElement = (tag, props = {}, ...children) => {
  const el = Object.assign(document.createElement(tag), props)
  if (children.length) el.append(...children)
  return el
}

const debounce = (fn, ms = 400) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), ms)
  }
}

const debouncedSetSize = debounce(setGridSize)
const debouncedSetFilters = debounce(setFilters)

const createControls = () => {
  const handleSearch = e => {
    const value = e.target?.value
    if (value != null) {
      debouncedSetFilters({ ...getFilters(), search: value })
    }
  }

  const handleRange = e => {
    const value = Number(e.target?.value)
    if (Number.isFinite(value) && value >= 100 && value <= 300) {
      debouncedSetSize(value)
    }
  }

  const handleSource = e => {
    const value = e.target?.value
    if (value != null) {
      debouncedSetFilters({ ...getFilters(), source: value })
    }
  }

  const search = createElement('input', {
    type: 'search',
    placeholder: 'Search shaders...',
    value: getFilters().search,
    oninput: handleSearch
  })

  const range = createElement('input', {
    type: 'range',
    min: '100',
    max: '300',
    value: getGridSize(),
    oninput: handleRange
  })

  const select = createElement('select', {
    onchange: handleSource
  })

  const updateSourceOptions = () => {
    const sources = [...new Set(getShaders()
      .map(s => s?.source)
      .filter(Boolean))]
      .sort()
    
    select.replaceChildren(
      createElement('option', { value: 'all', textContent: 'All Sources' }),
      ...sources.map(s => createElement('option', { 
        value: s, 
        textContent: s.toUpperCase() 
      }))
    )
    select.value = getFilters().source
  }

  const controls = createElement('div', { className: 'controls' },
    search,
    createElement('div', { className: 'range-container' }, range),
    select
  )

  const cleanup = () => {
    search.oninput = null
    range.oninput = null
    select.onchange = null
  }

  return { element: controls, updateSourceOptions, cleanup }
}

const { element: controls, updateSourceOptions, cleanup } = createControls()

export const initControls = parent => {
  parent.prepend(controls)
  updateSourceOptions()
  const unsubscribe = onShaders(updateSourceOptions)
  return () => {
    cleanup()
    unsubscribe()
  }
} 