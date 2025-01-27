import { defineConfig } from 'vite'
import fs from 'node:fs'

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'))

const generateDataFile = () => {
  const sources = ['glslsandbox'] // Add more sources here as we add them
  const data = {
    updated: new Date().toISOString(),
    sources: {}
  }

  for (const source of sources) {
    const paths = [`public/dump/${source}`, `public/data/${source}.json`]
    if (!paths.every(fs.existsSync)) {
      console.warn(`Warning: Missing data for ${source}`)
      continue
    }

    try {
      data.sources[source] = JSON.parse(fs.readFileSync(paths[1], 'utf8'))
    } catch (err) {
      console.error(`Error reading ${source} data:`, err)
    }
  }

  fs.writeFileSync('public/data/index.json', JSON.stringify(data, null, 2))
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version)
  },
  plugins: [{
    name: 'generate-data',
    buildStart: generateDataFile,
    handleHotUpdate: ({ file }) => {
      if (file.includes('/dump/') || file.includes('/data/')) {
        generateDataFile()
      }
    }
  }]
}) 