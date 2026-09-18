import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

const storage = new Map()
globalThis.localStorage = {
  getItem: key => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
}
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { language: 'en', languages: ['en'] }
})
globalThis.window = {
  location: { origin: 'http://localhost:8787', protocol: 'http:', host: 'localhost:8787', pathname: '/' },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
}

test('server card distinguishes no samples from a failed probe', async () => {
  const vite = await createServer({
    configFile: false,
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true },
    server: { middlewareMode: true }
  })

  try {
    const { useServerCardData } = await vite.ssrLoadModule('/src/frontend/composables/useServerCardData.js')
    const makeCard = server => useServerCardData({
      server: {
        id: 'server-1',
        name: 'Test server',
        ping: [],
        loss: [],
        ...server
      },
      sysConfig: {
        show_three_net_details: true,
        latency_window: { points: 3, hours: 1 }
      }
    })

    const noSample = makeCard({ ping_ct: null, loss_ct: null })
    assert.equal(noSample.threeNetDetails.value[0].latestPing, null)
    assert.equal(noSample.formatPingValue(null, null), 'No samples')
    assert.equal(noSample.formatLossValue(null, null), 'No samples')
    assert.equal(noSample.getPingColor(null, null), 'rgba(255, 255, 255, 0.08)')

    const failedProbe = makeCard({ ping_ct: null, loss_ct: 100 })
    assert.equal(failedProbe.formatPingValue(null, 100), 'TIMEOUT')
    assert.equal(failedProbe.formatLossValue(100, null), '100%')
    assert.equal(failedProbe.getPingColor(null, 100), 'var(--accent-red)')

    const zeroLoss = makeCard({ ping_ct: 42, loss_ct: 0 })
    assert.equal(zeroLoss.formatPingValue(42, 0), '42ms')
    assert.equal(zeroLoss.formatLossValue(0, 42), '0%')
    assert.equal(zeroLoss.getLossColor(0), 'var(--accent-green)')

    const emptyBucket = makeCard({
      ping_ct: 42,
      loss_ct: 0,
      ping: [{ ts: 1, ct: null }],
      loss: [{ ts: 1, ct: null }]
    })
    assert.match(emptyBucket.threeNetDetails.value[0].points[0].pingTooltip, /No samples/)
    assert.doesNotMatch(emptyBucket.threeNetDetails.value[0].points[0].pingTooltip, /Offline/)
  } finally {
    await vite.close()
  }
})
