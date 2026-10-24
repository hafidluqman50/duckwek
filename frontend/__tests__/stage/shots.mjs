// Screenshots of the five projector views at 1920x1080 (test only). Needs feed.mjs on :8099 and the frontend on STAGE_URL.
//   PUPPETEER=/path/to/node_modules/puppeteer-core OUT=/tmp/shots node __tests__/stage/shots.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire(import.meta.url)
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core')
const URL_ = process.env.STAGE_URL || 'http://localhost:3100/stage/WEK-TEST'
const OUT = process.env.OUT || '/tmp/duckwek-shots'
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const phase = (p) => fetch(`http://localhost:8099/phase/${p}`)

const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 200)))
await page.goto(URL_, { waitUntil: 'networkidle2', timeout: 120000 })
await sleep(1500)
const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('saved', name) }

await shot('1-lobby')
await phase('grid'); await sleep(1500); await shot('2-grid')
await phase('race'); await sleep(5000); await shot('3-race')
await phase('result'); await sleep(900); await shot('4-photo')
await sleep(4500); await shot('5-winner')
await phase('settled'); await sleep(2800); await shot('6-winner-minted')
await browser.close()
