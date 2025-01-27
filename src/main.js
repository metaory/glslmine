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

const mkLink = (shader) => {
  // Try to reuse existing element
  const existing = elementPool.get()
  if (existing) {
    existing.href = shader.url
    existing.title = shader.url
    existing.querySelector('img').src = shader.thumb
    existing.querySelector('span').textContent = shader.url.split('#')[1]
    existing.querySelector('.source').textContent = 'GLSL'
    return existing
  }

  // Create new if none available
  const link = document.createElement('a')
  link.href = shader.url
  link.className = 'thumb'
  link.target = '_blank'
  link.title = shader.url
  
  const img = document.createElement('img')
  img.src = shader.thumb
  img.loading = 'lazy'
  img.alt = shader.url
  
  const span = document.createElement('span')
  span.textContent = shader.url.split('#')[1]
  
  const source = document.createElement('div')
  source.className = 'source'
  source.textContent = 'GLSL'
  
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
  return shaders.filter(shader => {
    if (source !== 'all' && source !== 'glslsandbox') return false
    if (search && !shader.url.toLowerCase().includes(search.toLowerCase())) return false
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

  const shaders = filterShaders(getShaders())
  const batchSize = Math.ceil((window.innerHeight / 160) * (window.innerWidth / 160) * 3)
  
  let currentIndex = 0
  let isLoading = false
  let lastScrollY = window.scrollY
  
  const loadMoreItems = () => {
    if (currentIndex >= shaders.length || isLoading) return false
    
    isLoading = true
    const nextBatch = shaders.slice(currentIndex, currentIndex + batchSize)
    nextBatch.forEach(id => {
      const thumb = mkLink(id)
      thumb.style.opacity = '0'
      thumbs.appendChild(thumb)
      observer.observe(thumb)
    })
    currentIndex += nextBatch.length
    updateProgress()
    isLoading = false
    return true
  }

  const updateProgress = () => {
    const progress = (currentIndex / shaders.length) * 100
    progressBar.style.height = `${progress}%`
    progressInfo.textContent = `${currentIndex}/${shaders.length} (${Math.round(progress)}%)`
  }

  // Initial loads
  loadMoreItems()
  loadMoreItems()

  const ensureScroll = () => {
    const hasScroll = document.documentElement.scrollHeight > window.innerHeight
    if (!hasScroll && !isLoading) {
      loadMoreItems() && setTimeout(ensureScroll, 50)
    }
  }
  setTimeout(ensureScroll, 50)

  let scrollLock = false
  let scrollTimer = null

  const onScroll = () => {
    if (scrollLock) return
    
    const scrolled = window.scrollY
    const viewportHeight = window.innerHeight
    const totalHeight = document.documentElement.scrollHeight
    const scrollDelta = scrolled - lastScrollY
    lastScrollY = scrolled
    
    // Detect rapid direction changes
    if (Math.abs(scrollDelta) > viewportHeight / 2) {
      return // Skip this scroll event
    }

    // Load more at bottom
    if (scrolled + viewportHeight > totalHeight - 2000) {
      loadMoreItems()
    }
    
    // Load more when scrolling up - trigger when moving up at any position
    if (scrollDelta < -100 && currentIndex > batchSize && !isLoading) {
      scrollLock = true
      
      const prevBatch = shaders.slice(Math.max(0, currentIndex - batchSize * 3), currentIndex - batchSize)
      const fragment = document.createDocumentFragment()
      
      prevBatch.forEach(id => {
        const thumb = mkLink(id)
        thumb.style.opacity = '0'
        fragment.appendChild(thumb)
        observer.observe(thumb)
      })
      
      const firstThumb = thumbs.querySelector('.thumb')
      if (firstThumb) {
        const oldHeight = firstThumb.offsetTop
        thumbs.insertBefore(fragment, firstThumb)
        
        // Delay scroll adjustment to next frame
        requestAnimationFrame(() => {
          const newHeight = thumbs.querySelector('.thumb').offsetTop
          const adjustment = newHeight - oldHeight
          if (Math.abs(adjustment) < viewportHeight) {
            window.scrollBy(0, adjustment)
          }
          
          // Release lock after a short delay
          setTimeout(() => {
            scrollLock = false
          }, 100)
        })
      } else {
        scrollLock = false
      }
      
      currentIndex -= prevBatch.length
      updateProgress()
    }
  }

  // Improved scroll handler with better throttling
  window.addEventListener('scroll', () => {
    if (scrollTimer !== null) {
      clearTimeout(scrollTimer)
    }
    scrollTimer = setTimeout(() => {
      scrollTimer = null
      onScroll()
    }, 50)
  })

  // Handle window resize
  let resizeTimer = null
  window.addEventListener('resize', () => {
    if (resizeTimer !== null) {
      clearTimeout(resizeTimer)
    }
    resizeTimer = setTimeout(ensureScroll, 100)
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
