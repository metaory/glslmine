import { defineConfig } from 'vite'
import fs from 'node:fs'

const writeFileList = () => {
  const files = fs.readdirSync('public/dump')
    .filter(f => f.endsWith('.png'))
    .map(f => f.replace('.png', ''))
    .sort((a, b) => Number(a) - Number(b))
    .map(id => ({
      thumb: `https://glslsandbox.com/thumbs/${id}.png`,
      url: `https://glslsandbox.com/e#${id}.0`
    }))
  
  fs.writeFileSync('public/files.json', JSON.stringify(files))
}

export default defineConfig({
  plugins: [{
    name: 'dump-list',
    buildStart: writeFileList,
    handleHotUpdate: ({ file }) => file.includes('dump') && writeFileList()
  }]
}) 