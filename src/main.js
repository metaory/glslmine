import './style.css'
import '@fontsource/pixelify-sans/400.css';

const app = document.getElementById('app')
const base = import.meta.env.DEV ? '' : '/glslmine'

const mkLink = (id) => {
    const link = document.createElement('a')
    link.href = `https://glslsandbox.com/e#${id}.0`
    link.className = 'thumb'
    link.target = '_blank'
    link.title = id
    
    const img = document.createElement('img')
    img.src = `${base}/dump/${id}.png`
    img.loading = 'lazy'
    img.alt = id
    
    const span = document.createElement('span')
    span.textContent = id
    
    link.append(img, span)
    app.appendChild(link)
}

const mkLinks = (links) => links.forEach(mkLink)

fetch(`${base}/files.json`)
  .then(r => r.json())
  .then(mkLinks)
  .catch(err => console.warn('Failed to load gallery:', err))
