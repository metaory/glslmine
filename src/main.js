import './style.css'
import '@fontsource/pixelify-sans/400.css'
import { getShaders, setShaders, getGridSize, onGridSize, getFilters, onFilters } from './state'
import { initControls } from './controls'

const app = document.getElementById('app')
const base = import.meta.env.DEV ? '' : '/glslmine'

// Reuse DOM elements pool
const elementPool = {
  items: new Set(),
  get() {
    const item = this.items.values().next().value
    if (item) {
      this.items.delete(item)
      return item
    }
    return null
  },
  put(item) {
    item.style.opacity = '0'
    this.items.add(item)
  }
}

const mkLink = (id) => {
  const [prefix, shaderID] = id.split('_')
  
  const sourceConfig = {
    gs: {
      url: `https://glslsandbox.com/e#${shaderID}.0`,
      label: 'GLSL'
    },
    st: {
      url: `https://www.shadertoy.com/view/${shaderID}`,
      label: 'TOY'
    },
    vs: {
      url: `https://www.vertexshaderart.com/art/${shaderID}`,
      label: 'VERTEX'
    },
    gh: {
      url: `https://gist.github.com/${shaderID}`,
      label: 'GIST'
    }
  }

  const config = sourceConfig[prefix] || sourceConfig.gs

  // Try to reuse existing element
  const existing = elementPool.get()
  if (existing) {
    existing.href = config.url
    existing.title = id
    existing.querySelector('img').src = `${base}/dump/${id}.png`
    existing.querySelector('span').textContent = shaderID
    existing.querySelector('.source').textContent = config.label
    return existing
  }

  // Create new if none available
  const link = document.createElement('a')
  link.href = config.url
  link.className = 'thumb'
  link.target = '_blank'
  link.title = id
  
  const img = document.createElement('img')
  img.src = `${base}/dump/${id}.png`
  img.loading = 'lazy'
  img.alt = id
  
  const span = document.createElement('span')
  span.textContent = shaderID
  
  const source = document.createElement('div')
  source.className = 'source'
  source.textContent = config.label
  
  link.append(img, span, source)
  return link
}

const updateGrid = () => {
  const size = getGridSize()
  const thumbs = app.querySelector('.thumbs')
  if (thumbs) {
    thumbs.style.gridTemplateColumns = `repeat(auto-fill, minmax(${size}px, 1fr))`
  }
}

// Improved intersection observer with cleanup
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const thumb = entry.target
    if (!entry.isIntersecting) {
      const thumbs = app.querySelector('.thumbs')
      // Only remove if it's still a child of thumbs wrapper
      if (thumb.parentNode === thumbs) {
        thumbs.removeChild(thumb)
        elementPool.put(thumb)
      }
      observer.unobserve(thumb)
    } else {
      thumb.style.opacity = '1'
    }
  })
}, { 
  rootMargin: '100% 0px',  // Load one screen height ahead
  threshold: 0.1
})

const filterShaders = (shaders) => {
  const { search, source } = getFilters()
  return shaders.filter(id => {
    if (source !== 'all') {
      const sourceMap = {
        glslsandbox: 'gs',
        shadertoy: 'st',
        vertexshader: 'vs',
        github: 'gh'
      }
      if (!id.startsWith(sourceMap[source])) return false
    }
    
    if (search && !id.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })
}

const renderShaders = () => {
  // Clean up existing elements
  const existingThumbs = app.querySelector('.thumbs')
  if (existingThumbs) {
    Array.from(existingThumbs.children).forEach(child => {
      if (child.classList.contains('thumb')) {
        observer.unobserve(child)
        elementPool.put(child)
        child.remove()
      }
    })
    existingThumbs.remove()
  }
  app.innerHTML = ''

  // Create thumbs wrapper
  const thumbs = document.createElement('div')
  thumbs.className = 'thumbs'
  thumbs.style.gridTemplateColumns = `repeat(auto-fill, minmax(${getGridSize()}px, 1fr))`

  // Create progress indicator
  const progress = document.createElement('div')
  progress.className = 'progress'
  const progressBar = document.createElement('div')
  progressBar.className = 'progress-bar'
  const progressInfo = document.createElement('div')
  progressInfo.className = 'progress-info'
  progress.append(progressBar, progressInfo)
  app.append(progress, thumbs)

  // Only render visible elements initially
  const shaders = filterShaders(getShaders())
  const batchSize = Math.ceil((window.innerHeight / 160) * (window.innerWidth / 160))
  
  let currentIndex = 0
  
  const loadMoreItems = () => {
    if (currentIndex >= shaders.length) return false
    
    const nextBatch = shaders.slice(currentIndex, currentIndex + batchSize)
    nextBatch.forEach(id => {
      const thumb = mkLink(id)
      thumb.style.opacity = '0'
      thumbs.appendChild(thumb)
      observer.observe(thumb)
    })
    currentIndex += nextBatch.length
    updateProgress()
    return true
  }

  // Update progress
  const updateProgress = () => {
    const progress = (currentIndex / shaders.length) * 100
    progressBar.style.height = `${progress}%`
    progressInfo.textContent = `${currentIndex}/${shaders.length} (${Math.round(progress)}%)`
  }

  // Initial load
  loadMoreItems()

  // Check if we need to load more to enable scrolling
  const ensureScroll = () => {
    const hasScroll = document.documentElement.scrollHeight > window.innerHeight
    if (!hasScroll) {
      loadMoreItems() && setTimeout(ensureScroll, 100)
    }
  }
  setTimeout(ensureScroll, 100)

  // Scroll handler for both directions
  const onScroll = () => {
    const scrolled = window.scrollY
    const viewportHeight = window.innerHeight
    const totalHeight = document.documentElement.scrollHeight
    
    // Load more at bottom
    if (scrolled + viewportHeight > totalHeight - 1000) {
      loadMoreItems()
    }
    
    // Load more at top if scrolled up
    if (scrolled < 500 && currentIndex > batchSize) {
      const prevBatch = shaders.slice(Math.max(0, currentIndex - batchSize * 2), currentIndex - batchSize)
      const fragment = document.createDocumentFragment()
      
      prevBatch.forEach(id => {
        const thumb = mkLink(id)
        thumb.style.opacity = '0'
        fragment.appendChild(thumb)
        observer.observe(thumb)
      })
      
      // Insert at top and adjust scroll
      const firstThumb = thumbs.querySelector('.thumb')
      if (firstThumb) {
        const oldHeight = firstThumb.offsetTop
        thumbs.insertBefore(fragment, firstThumb)
        const newHeight = thumbs.querySelector('.thumb').offsetTop
        window.scrollBy(0, newHeight - oldHeight)
      }
      
      currentIndex -= prevBatch.length
      updateProgress()
    }
  }

  // Throttle scroll handler
  let scrollTimeout
  window.addEventListener('scroll', () => {
    if (!scrollTimeout) {
      scrollTimeout = setTimeout(() => {
        onScroll()
        scrollTimeout = null
      }, 100)
    }
  })

  // Handle window resize
  window.addEventListener('resize', () => {
    ensureScroll()
  })
}

onGridSize(updateGrid)
onFilters(() => {
  window.scrollTo(0, 0)
  renderShaders()
})
updateGrid()
initControls(document.body)

fetch(`${base}/files.json`)
  .then(r => r.json())
  .then(files => {
    setShaders(files)
    renderShaders()
  })
  .catch(err => console.warn('Failed to load gallery:', err))
