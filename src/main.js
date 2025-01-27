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
    if (!entry.isIntersecting) {
      // Only remove if far out of view (both up and down)
      const rect = thumb.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const isFarFromView = rect.top < -viewportHeight * 2 || rect.bottom > viewportHeight * 3
      
      if (isFarFromView && thumb.parentNode?.classList.contains('thumbs')) {
        thumb.remove()
        elementPool.add(thumb)
        onIntersect(thumb)
      }
    } else {
      thumb.style.opacity = '1'
    }
  }), 
  { 
    rootMargin: '200% 0px', // Increased buffer zone
    threshold: 0.1 
  }
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
  const existingThumbs = app.querySelector('.thumbs')
  const existingProgress = app.querySelector('.progress')
  
  if (existingThumbs) {
    existingThumbs.remove()
    existingProgress?.remove()
  } else {
    app.innerHTML = ''
  }
  
  elementPool.clear()

  const thumbs = createElement('div', {
    className: 'thumbs',
    style: `grid-template-columns: repeat(auto-fill, minmax(${getGridSize()}px, 1fr))`
  })
  
  const progress = createProgress()
  app.append(progress.element, thumbs)
  
  const shaders = filterShaders(getShaders())
  const batchSize = calcBatchSize()
  let startIndex = 0
  let endIndex = 0
  let isLoading = false
  
  const observer = createObserver(thumb => observer.unobserve(thumb))
  
  const loadMore = (direction = 1) => {
    if (isLoading) return false
    if (direction > 0 && endIndex >= shaders.length) return false
    if (direction < 0 && startIndex <= 0) return false
    
    isLoading = true
    
    let itemsToLoad
    if (direction > 0) {
      itemsToLoad = shaders.slice(endIndex, endIndex + batchSize)
      endIndex = Math.min(shaders.length, endIndex + batchSize)
    } else {
      const newStart = Math.max(0, startIndex - batchSize)
      itemsToLoad = shaders.slice(newStart, startIndex)
      startIndex = newStart
    }
    
    const oldHeight = thumbs.scrollHeight
    const oldScroll = window.scrollY
    
    const validThumbs = itemsToLoad
      .map(mkLink)
      .filter(thumb => thumb instanceof Element)
    
    validThumbs.forEach(thumb => {
      thumb.style.opacity = '0'
      if (direction < 0) {
        thumbs.insertBefore(thumb, thumbs.firstChild)
      } else {
        thumbs.appendChild(thumb)
      }
      observer.observe(thumb)
    })
    
    if (direction < 0 && validThumbs.length) {
      const heightDiff = thumbs.scrollHeight - oldHeight
      window.scrollTo(0, oldScroll + heightDiff)
    }
    
    progress.update(endIndex, shaders.length)
    isLoading = false
    
    return validThumbs.length > 0
  }
  
  const handleScroll = () => {
    const { scrollY, innerHeight } = window
    const { scrollHeight } = document.documentElement
    
    // Near top - load previous
    if (scrollY < innerHeight && startIndex > 0) {
      loadMore(-1)
    }
    
    // Near bottom - load next
    if (scrollHeight - (scrollY + innerHeight) < innerHeight && endIndex < shaders.length) {
      loadMore(1)
    }
  }
  
  // Initial load
  loadMore(1)
  loadMore(1)
  
  window.addEventListener('scroll', handleScroll, { passive: true })
  return () => {
    window.removeEventListener('scroll', handleScroll)
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
