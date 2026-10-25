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
    const { setLanguage } = await vite.ssrLoadModule('/src/frontend/utils/i18n.js')
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
    assert.equal(emptyBucket.threeNetDetails.value[0].points[0].pingColor, 'rgba(255, 255, 255, 0.08)')

    const backfill = makeCard({
      ping_ct: false, loss_ct: false, ping_cu: false, loss_cu: false,
      ping_cm: 42, loss_cm: 0, ping_bd: 55, loss_bd: 0,
      ping_node_1: null, loss_node_1: 100,
      ping: [{ ts: 1, cm: 42, bd: 55, node_1: null }, { ts: 2, cm: 43, bd: 56, node_1: 80 }],
      loss: [{ ts: 1, cm: 0, bd: 0, node_1: 100 }, { ts: 2, cm: 0, bd: 0, node_1: 0 }]
    })
    assert.deepEqual(backfill.threeNetDetails.value.map(row => row.key), ['cm', 'bd', 'node_1'])
    const failedPoint = backfill.threeNetDetails.value[2].points[0]
    assert.match(failedPoint.pingTooltip, /TIMEOUT/)
    assert.equal(failedPoint.pingColor, 'var(--accent-red)')
    assert.equal(backfill.threeNetDetails.value[2].points[1].ping, 80)
    assert.equal(backfill.threeNetDetails.value[2].averageLoss, 50)
    assert.equal(backfill.threeNetDetails.value[0].points[0].lossColor, 'var(--accent-green)')

    const historyDisabled = makeCard({ loss: [{ ts: 1, ct: false }], ping_ct: null, loss_ct: null })
    assert.equal(historyDisabled.threeNetDetails.value.some(row => row.key === 'ct'), false)
    const realtimeWins = makeCard({ loss: [{ ts: 1, ct: false }], ping_ct: 42, loss_ct: 0 })
    assert.equal(realtimeWins.threeNetDetails.value[0].key, 'ct')

    const names = useServerCardData({
      server: { ping_ct: false, loss_ct: false, ping_cu: false, loss_cu: false, ping_cm: false, loss_cm: false },
      sysConfig: { custom_bd_name: 'My BGP', node_1_name: 'Tokyo', latency_window: { points: 3 } }
    })
    assert.deepEqual(names.threeNetDetails.value.map(row => row.label), ['My BGP', 'Tokyo', 'Node 2'])
    const disabled = Object.fromEntries(['ct', 'cu', 'cm', 'bd', 'node_1', 'node_2', 'node_3', 'node_4']
      .flatMap(key => [[`ping_${key}`, false], [`loss_${key}`, false]]))
    assert.equal(makeCard(disabled).hasThreeNetDetails.value, false)

    for (const [lang, text] of [['zh', '无样本'], ['zh-TW', '無樣本'], ['ja', 'サンプルなし']]) {
      assert.equal(await setLanguage(lang), true)
      assert.equal(noSample.formatPingValue(null, null), text)
      assert.equal(noSample.formatLossValue(null, null), text)
    }
    await setLanguage('en')
  } finally {
    await vite.close()
  }
})
