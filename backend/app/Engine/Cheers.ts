import { encodeAbiParameters, keccak256, type Hex } from 'viem'

export type CheerLog = Record<number, Record<number, number>>

export function cheersRoot(log: CheerLog): Hex {
  const steps: number[] = []
  const duckIndexes: number[] = []
  const taps: number[] = []
  const ascending = (first: number, second: number) => first - second

  for (const step of Object.keys(log).map(Number).sort(ascending)) {
    for (const duckIndex of Object.keys(log[step]).map(Number).sort(ascending)) {
      if (!log[step][duckIndex]) continue

      steps.push(step)
      duckIndexes.push(duckIndex)
      taps.push(log[step][duckIndex])
    }
  }

  return keccak256(encodeAbiParameters([{ type: 'uint32[]' }, { type: 'uint16[]' }, { type: 'uint16[]' }], [steps, duckIndexes, taps]))
}

export const standingRoot = (resultsRoot: Hex, cheers: Hex): Hex => keccak256(`${resultsRoot}${cheers.slice(2)}` as Hex)
