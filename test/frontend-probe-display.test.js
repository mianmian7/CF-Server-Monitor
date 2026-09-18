import assert from 'node:assert/strict'
import { shouldShowThreeNetProbe } from '../src/frontend/utils/probeDisplay.js'

const ct = { pingField: 'ping_ct', lossField: 'loss_ct', key: 'ct' }

assert.equal(shouldShowThreeNetProbe({ ping_ct: false, loss_ct: false }, ct), false)
assert.equal(shouldShowThreeNetProbe({ ping_ct: undefined, loss_ct: undefined }, ct), true)
assert.equal(shouldShowThreeNetProbe({ ping_ct: null, loss_ct: null }, ct), true)
assert.equal(shouldShowThreeNetProbe({ ping_ct: null, loss_ct: 100 }, ct), true)
assert.equal(shouldShowThreeNetProbe({ ping_ct: null, loss_ct: null, ping: [{ ts: 1, ct: 42 }] }, ct), true)
assert.equal(shouldShowThreeNetProbe({ ping_ct: false, loss_ct: false, ping: [{ ts: 1, ct: 42 }] }, ct), false)

console.log('frontend probe display tests passed')
