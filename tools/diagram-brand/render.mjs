#!/usr/bin/env node
/**
 * Brand + rasterize any diagram SVG for the Manga Web Shop house style (ADR-0014).
 *
 * Skill-agnostic: give it an SVG produced by ANY generator whose text uses the
 * brand font families ("Space Grotesk" for headings, "Space Mono" for body — see
 * brand.md / brand.json) and it will:
 *   1. embed those fonts as base64 @font-face so the .svg is self-contained and
 *      renders identically in any browser, with no network and no installed fonts;
 *   2. rasterize a crisp .png with a font-aware renderer (@resvg/resvg-js), loading
 *      the real TTFs — sharp/librsvg is NOT used because it ignores @font-face.
 *
 * Usage:
 *   node tools/diagram-brand/render.mjs input.svg [-o OUT_DIR] [--scale 2] [--width PX] [--png-only|--svg-only]
 *
 * Emits <OUT_DIR>/<name>.svg (branded, self-contained) and <OUT_DIR>/<name>.png.
 * Default OUT_DIR is the input's directory. Re-running is idempotent (fonts are
 * embedded once). Requires @resvg/resvg-js — auto-installed on first run.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, basename, extname } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
const FONTS = join(HERE, 'fonts')

// woff2 embedded into the SVG (browser portability); ttf loaded by resvg (raster).
const EMBED = [
  { family: 'Space Grotesk', weight: 700, file: 'sg-700.woff2' },
  { family: 'Space Mono', weight: 400, file: 'sm-400.woff2' },
  { family: 'Space Mono', weight: 700, file: 'sm-700.woff2' },
]
const TTF = ['SpaceGrotesk-700.ttf', 'SpaceMono-Regular.ttf', 'SpaceMono-Bold.ttf']

// ---- args ----------------------------------------------------------------
const argv = process.argv.slice(2)
if (!argv.length || argv.includes('-h') || argv.includes('--help')) {
  console.log('Usage: node render.mjs input.svg [-o OUT_DIR] [--scale 2] [--width PX] [--png-only|--svg-only]')
  process.exit(argv.length ? 0 : 1)
}
const input = resolve(argv[0])
const opt = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined }
const outDir = resolve(opt('-o') || opt('--out') || dirname(input))
const scale = parseFloat(opt('--scale') || '2')
const widthOverride = opt('--width') ? parseInt(opt('--width'), 10) : undefined
const pngOnly = argv.includes('--png-only')
const svgOnly = argv.includes('--svg-only')
const name = basename(input, extname(input))
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

// ---- 1. embed fonts (idempotent) -----------------------------------------
function embedFonts(svg) {
  if (svg.includes('id="brand-fonts"')) return svg // already branded
  const faces = EMBED.map(({ family, weight, file }) => {
    const b64 = readFileSync(join(FONTS, file)).toString('base64')
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
      `font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`
  }).join('\n')
  const style = `<style id="brand-fonts">\n${faces}\n</style>`
  // insert right after the opening <svg ...> tag
  const m = svg.match(/<svg\b[^>]*>/)
  if (!m) throw new Error('input does not look like an SVG (no <svg> tag)')
  return svg.slice(0, m.index + m[0].length) + '\n' + style + svg.slice(m.index + m[0].length)
}

const raw = readFileSync(input, 'utf8')
const branded = embedFonts(raw)
const outSvg = join(outDir, `${name}.svg`)
if (!pngOnly) {
  writeFileSync(outSvg, branded)
  console.log('SVG:', outSvg, `(${branded.length} bytes, fonts embedded)`)
}

// ---- 2. rasterize via resvg (auto-install if missing) --------------------
if (!svgOnly) {
  const require = createRequire(import.meta.url)
  let Resvg
  try {
    ({ Resvg } = require('@resvg/resvg-js'))
  } catch {
    console.log('Installing @resvg/resvg-js (one-time)…')
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: HERE, stdio: 'inherit', shell: true })
    ({ Resvg } = require('@resvg/resvg-js'))
  }
  const fitTo = widthOverride
    ? { mode: 'width', value: widthOverride }
    : { mode: 'zoom', value: scale }
  const resvg = new Resvg(branded, {
    background: 'white',
    fitTo,
    font: {
      loadSystemFonts: true, // fallback for any glyphs outside the brand fonts
      fontFiles: TTF.map((f) => join(FONTS, f)),
      defaultFontFamily: 'Space Mono',
    },
  })
  const png = resvg.render().asPng()
  const outPng = join(outDir, `${name}.png`)
  writeFileSync(outPng, png)
  console.log('PNG:', outPng, `(${png.length} bytes)`)
}
