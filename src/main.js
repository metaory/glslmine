import './style.css'
import '@fontsource/pixelify-sans/400.css'
import { getShaders, setShaders, getGridSize, onGridSize, getFilters, onFilters } from './state.js'
import { initControls } from './controls.js'

const app = document.getElementById('app')
const base = import.meta.env.DEV ? '' : '/glslmine'

// Element creation helpers
const createElement = (tag, props = {}, ...children) => {
  const el = Object.assign(document.createElement(tag), props)
  if (children.length) el.append(...children)
  return el
}

// Add version display
document.body.appendChild(createElement('div', {
  className: 'version',
  textContent: `v${import.meta.env.VITE_APP_VERSION || '0.0.0'}`
}))

const elementPool = new Set()
const reuseOrCreate = (create, update) => {
  const existing = elementPool.values().next().value
  if (existing) {
    elementPool.delete(existing)
    existing.style.opacity = '0'
    return update(existing)
  }
  return create()
}

const mkLink = shader => reuseOrCreate(
  () => createElement('a', {
    href: shader.url,
    className: 'thumb',
    target: '_blank',
    title: shader.url
  },
    createElement('img', {
      src: shader.thumb,
      loading: 'lazy',
      alt: shader.url
    }),
    createElement('span', {
      textContent: shader.id
    }),
    createElement('div', {
      className: 'source',
      textContent: shader.source.slice(0, 2).toUpperCase()
    })
  ),
  el => {
    el.href = shader.url
    el.title = shader.url
    el.className = 'thumb'
    el.children[0].src = shader.thumb
    el.children[1].textContent = shader.id
    el.children[2].textContent = shader.source.slice(0, 2).toUpperCase()
    return el
  }
)

const createProgress = () => {
  const progress = createElement('div', { className: 'progress' })
  const bar = createElement('div', { className: 'progress-bar' })
  const info = createElement('div', { className: 'progress-info' })
  progress.append(bar, info)
  
  return {
    element: progress,
    update: (current, total) => {
      const percent = (current / total) * 100
      bar.style.height = `${percent}%`
      info.textContent = `${current}/${total} (${Math.round(percent)}%)`
    }
  }
}

const createObserver = onIntersect => new IntersectionObserver(
  entries => entries.forEach(entry => {
    const thumb = entry.target
    if (!entry.isIntersecting && thumb.parentNode?.classList.contains('thumbs')) {
      thumb.remove()
      elementPool.add(thumb)
    } else {
      thumb.style.opacity = '1'
    }
    if (!entry.isIntersecting) onIntersect(thumb)
  }), 
  { rootMargin: '100% 0px', threshold: 0.1 }
)

const debounce = (fn, ms = 100) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), ms)
  }
}

const calcBatchSize = () => {
  const cols = Math.floor(window.innerWidth / 160)
  const rows = Math.ceil(window.innerHeight / 160)
  return cols * rows * 2 // Load 2 screens worth
}

const updateGrid = debounce(() => {
  const size = getGridSize()
  const thumbs = app.querySelector('.thumbs')
  thumbs?.style?.setProperty('grid-template-columns', `repeat(auto-fill, minmax(${size}px, 1fr))`)
})

const filterShaders = shaders => {
  const { search, source } = getFilters()
  return shaders.filter(shader => 
    (source === 'all' || source === shader.source) && 
    (!search || shader.id.toLowerCase().includes(search.toLowerCase()))
  )
}

const renderShaders = () => {
  app.querySelector('.thumbs')?.remove()
  elementPool.clear()
  app.innerHTML = ''

  const thumbs = createElement('div', {
    className: 'thumbs',
    style: `grid-template-columns: repeat(auto-fill, minmax(${getGridSize()}px, 1fr))`
  })
  
  const progress = createProgress()
  app.append(progress.element, thumbs)
  
  const shaders = filterShaders(getShaders())
  const batchSize = calcBatchSize()
  let currentIndex = 0
  let isLoading = false
  
  const observer = createObserver(thumb => observer.unobserve(thumb))
  
  const loadMoreItems = () => {
    if (!thumbs || currentIndex >= shaders.length || isLoading) return false
    
    isLoading = true
    const validThumbs = shaders
      .slice(currentIndex, currentIndex + batchSize)
      .map(mkLink)
      .filter(thumb => thumb instanceof Element)
    
    validThumbs.forEach(thumb => {
      thumb.style.opacity = '0'
      thumbs.appendChild(thumb)
      observer.observe(thumb)
    })
    
    currentIndex += validThumbs.length
    progress.update(currentIndex, shaders.length)
    isLoading = false
    return validThumbs.length > 0
  }
  
  loadMoreItems()
  loadMoreItems()
  
  const loadTriggerDistance = Math.max(1000, window.innerHeight)
  const throttledScroll = () => {
    if (isLoading) return
    const { scrollY, innerHeight } = window
    const { scrollHeight } = document.documentElement
    
    if (scrollY + innerHeight > scrollHeight - loadTriggerDistance) {
      loadMoreItems()
    }
  }
  
  window.addEventListener('scroll', throttledScroll, { passive: true })
  return () => {
    window.removeEventListener('scroll', throttledScroll)
    observer.disconnect()
  }
}

const showError = message => {
  const details = message.includes('Failed to load data') 
    ? 'Check your network connection and try again.'
    : 'Please try refreshing the page.'
    
  app.innerHTML = ''
  app.appendChild(createElement('div', {
    className: 'error'
  }, 
    createElement('div', { 
      className: 'error-title',
      textContent: 'Failed to load shaders'
    }),
    createElement('div', { 
      className: 'error-message',
      textContent: message
    }),
    createElement('div', {
      className: 'error-help',
      textContent: details
    })
  ))
}

const validateData = data => {
  if (!data?.sources || typeof data.sources !== 'object') {
    throw new Error('Invalid data format: missing or invalid sources')
  }
  
  const allShaders = Object.values(data.sources)
    .filter(source => source?.items?.length > 0)
    .flatMap(source => source.items
      .filter(item => item?.id && item?.thumb && item?.url)
      .map(item => ({ ...item, source: source.source }))
    )
  
  if (!allShaders.length) {
    throw new Error('No valid shader data found')
  }
  
  return allShaders
}

// Initialize app
const init = async () => {
  app.appendChild(createElement('div', {
    className: 'loading',
    textContent: 'Loading shaders...'
  }))
  
  try {
    const response = await fetch(`${base}/data/index.json`)
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    
    const data = await response.json()
    const shaders = validateData(data)
    
    app.innerHTML = ''
    setShaders(shaders)
    renderShaders()
    
    onGridSize(updateGrid)
    onFilters(() => {
      window.scrollTo(0, 0)
      const cleanup = renderShaders()
      return () => cleanup?.()
    })
    
    updateGrid()
    initControls(document.body)
    
  } catch (err) {
    console.warn('Failed to load gallery:', err)
    showError(err.message)
  }
}

init()
