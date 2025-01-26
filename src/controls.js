import { getFilters, setFilters, getGridSize, setGridSize } from './state'

const controls = document.createElement('div')
controls.className = 'controls'

const debounce = (fn, delay) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}

const search = document.createElement('input')
search.type = 'search'
search.placeholder = 'Search shaders...'
search.value = getFilters().search

const rangeWrap = document.createElement('div')
rangeWrap.className = 'range-container'

const range = document.createElement('input')
range.type = 'range'
range.min = '100'
range.max = '300'
range.value = getGridSize()

rangeWrap.appendChild(range)

const source = document.createElement('select')
source.innerHTML = `
  <option value="all">All Sources</option>
  <option value="glslsandbox">GLSL Sandbox</option>
  <option value="shadertoy">ShaderToy</option>
  <option value="vertexshader">Vertex Shader Art</option>
  <option value="github">GitHub Gists</option>
`
source.value = getFilters().source

const debouncedSetSize = debounce(setGridSize, 400)
const debouncedSetFilters = debounce(setFilters, 400)

search.oninput = e => debouncedSetFilters({ ...getFilters(), search: e.target.value })
range.oninput = e => debouncedSetSize(Number(e.target.value))
source.onchange = e => debouncedSetFilters({ ...getFilters(), source: e.target.value })

controls.append(search, rangeWrap, source)

export const initControls = (parent) => {
  parent.prepend(controls)
} 