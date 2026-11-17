// slotOf / flyProgress unit test: node --experimental-strip-types __tests__/gridSlot.mjs
import assert from 'node:assert/strict'
import { slotOf, rowsOf, flyProgress, ROW_STEP, COL_STEP } from '../lib/gridSlot.ts'

const p0 = slotOf(0)
assert.deepEqual([p0.row, p0.col], [0, 0])
for (let i = 0; i < 200; i++) {
  const s = slotOf(i)
  assert.equal(s.row, Math.floor(i / 3))
  assert.equal(s.col, i % 3)
  assert.deepEqual(s, slotOf(i)) // deterministic
  if (i > 0) assert.ok(s.x < p0.x || s.col > 0, 'pole is the front-most slot') // nothing is ahead of the pole
  assert.ok(s.x <= p0.x, 'no slot ahead of pole')
}
assert.equal(slotOf(3).x, slotOf(0).x - ROW_STEP)
assert.equal(slotOf(1).x, slotOf(0).x - COL_STEP)
assert.equal(rowsOf(1), 1); assert.equal(rowsOf(3), 1); assert.equal(rowsOf(4), 2); assert.equal(rowsOf(200), 67)
// flyover: starts and ends at pole, peaks mid-way, nothing for short countdowns
assert.equal(flyProgress(10, 10), 0)
assert.equal(flyProgress(10, 3), 0)
assert.equal(flyProgress(10, 0), 0)
assert.ok(flyProgress(10, 6.5) > 0.99)
assert.equal(flyProgress(3, 1.5), 0)
console.log('gridSlot ok')
