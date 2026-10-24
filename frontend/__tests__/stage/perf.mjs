// Frame cost of the projector with 200 ducks: how long each animation frame takes, with parts of the page switched off to find the heavy one.
//   (feed.mjs with JITTER=1 DUCKS=200 on :8099, the frontend on :3100)  PUPPETEER=/path/to/puppeteer-core node __tests__/stage/perf.mjs
import { createRequire } from 'node:module'
const puppeteer = createRequire(import.meta.url)(process.env.PUPPETEER || 'puppeteer-core')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const variants = {
  full: '',
  'no dwFlow on the track': 'svg path{animation:none !important}',
}
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
for (const [name, css] of Object.entries(variants)) {
  const p = await b.newPage()
  await p.setViewport({ width: 1920, height: 1080 })
  await p.goto('http://localhost:3100/stage/WEK-TEST', { waitUntil: 'networkidle2', timeout: 120000 })
  await sleep(800)
  await fetch('http://localhost:8099/phase/grid'); await sleep(4500)
  await fetch('http://localhost:8099/phase/race')
  await p.waitForSelector('canvas[data-ducks]', { timeout: 30000 })
  if (css) await p.addStyleTag({ content: css })
  await sleep(2500)
  const d = await p.evaluate(() => new Promise((resolve) => {
    const out = []; let last = performance.now(); const t0 = last
    const f = (now) => { out.push(now - last); last = now; if (now - t0 < 6000) requestAnimationFrame(f); else resolve(out) }
    requestAnimationFrame(f)
  }))
  d.shift()
  const s = [...d].sort((a, b) => a - b)
  const q = (x) => s[Math.floor(s.length * x)]
  console.log(name.padEnd(26), `fps ${(1000 / (d.reduce((a, b) => a + b, 0) / d.length)).toFixed(1)} | median frame ${q(0.5).toFixed(1)} ms | p95 ${q(0.95).toFixed(1)} ms | p99 ${q(0.99).toFixed(1)} ms | frames over 25 ms: ${d.filter((x) => x > 25).length}/${d.length} | over 50 ms: ${d.filter((x) => x > 50).length}`)
  await p.close()
  await fetch('http://localhost:8099/phase/lobby')
}
await b.close()
