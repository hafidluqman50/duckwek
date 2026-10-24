import { encodeAbiParameters, keccak256, type Hex } from 'viem'

/** The cheer log of a race: step to (duck index to accepted taps). Only steps with taps are present. */
export type CheerLog = Record<number, Record<number, number>>

/**
 * Hash of the log, folded into the standing root at `finalize` (plan §3.10): `keccak256(resultsRoot, cheersRoot)`.
 * Canonical order: by step, then by duck index, so the same log always gives the same hash.
 */
export function cheersRoot(log: CheerLog): Hex {
  const steps: number[] = []
  const idxs: number[] = []
  const taps: number[] = []
  for (const step of Object.keys(log).map(Number).sort((a, b) => a - b)) {
    for (const idx of Object.keys(log[step]).map(Number).sort((a, b) => a - b)) {
      if (!log[step][idx]) continue
      steps.push(step)
      idxs.push(idx)
      taps.push(log[step][idx])
    }
  }
  return keccak256(encodeAbiParameters([{ type: 'uint32[]' }, { type: 'uint16[]' }, { type: 'uint16[]' }], [steps, idxs, taps]))
}

export const standingRoot = (resultsRoot: Hex, cheers: Hex): Hex => keccak256(`${resultsRoot}${cheers.slice(2)}` as Hex)
