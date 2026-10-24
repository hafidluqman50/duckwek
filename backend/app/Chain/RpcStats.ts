// Counts every JSON-RPC call the backend makes, by method, so a race can be priced in Alchemy compute units (plan T-8).
// CU per method: Alchemy "Compute unit costs" table (alchemy.com/docs/reference/compute-unit-costs). A method that is not in the
// table is counted at 20 CU and listed under `unpriced` so it is never silently ignored.
const CU: Record<string, number> = {
  eth_call: 26,
  eth_estimateGas: 20,
  eth_sendRawTransaction: 40,
  eth_sendRawTransactionSync: 40,
  eth_getTransactionCount: 20,
  eth_getTransactionReceipt: 20,
  eth_getBlockByNumber: 20,
  eth_getLogs: 60,
  eth_blockNumber: 10,
}

const counts = new Map<string, number>()

export const countRpc = (body: unknown): void => {
  const calls = Array.isArray(body) ? body : [body]
  for (const c of calls) {
    const m = (c as { method?: string } | null)?.method
    if (m) counts.set(m, (counts.get(m) || 0) + 1)
  }
}

/** Reads the JSON body of a viem http request without consuming it. */
export const onFetchRequest = (request: Request): void => {
  request
    .clone()
    .json()
    .then(countRpc)
    .catch(() => undefined)
}

export const rpcStats = () => {
  const methods = Object.fromEntries([...counts.entries()].sort())
  const unpriced = [...counts.keys()].filter((m) => !(m in CU))
  const cu = [...counts.entries()].reduce((a, [m, n]) => a + n * (CU[m] ?? 20), 0)
  return { calls: [...counts.values()].reduce((a, b) => a + b, 0), methods, cu, unpriced }
}
