const COMPUTE_UNITS: Record<string, number> = {
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
const UNPRICED_METHOD_UNITS = 20

const counts = new Map<string, number>()

export const countRpc = (body: unknown): void => {
  const calls = Array.isArray(body) ? body : [body]

  for (const call of calls) {
    const method = (call as { method?: string } | null)?.method

    if (method) counts.set(method, (counts.get(method) || 0) + 1)
  }
}

export const onFetchRequest = (request: Request): void => {
  request
    .clone()
    .json()
    .then(countRpc)
    .catch(() => undefined)
}

export const rpcStats = () => {
  const methods = Object.fromEntries([...counts.entries()].sort())
  const unpriced = [...counts.keys()].filter((method) => !(method in COMPUTE_UNITS))
  const cu = [...counts.entries()].reduce((total, [method, count]) => total + count * (COMPUTE_UNITS[method] ?? UNPRICED_METHOD_UNITS), 0)

  return { calls: [...counts.values()].reduce((total, count) => total + count, 0), methods, cu, unpriced }
}
