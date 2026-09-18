import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeImportedPingNodeValue,
  normalizePingNodeFields
} from '../src/handlers/admin.js';
import { buildAgentConfig } from '../src/utils/agentConfig.js';

const PING_NODE_FIELDS = ['custom_ct', 'custom_cu', 'custom_cm', 'custom_bd', 'node_1', 'node_2', 'node_3', 'node_4'];
const siteDefaults = Object.fromEntries(PING_NODE_FIELDS.map(field => [field, `${field}.example.com`]))

const saveAndRead = (field, input) => {
  const normalized = normalizePingNodeFields({ [field]: input })
  assert.equal(normalized.valid, true, `${field} input should be valid`)
  // Match the admin handler's D1 binding: empty values become NULL.
  const stored = normalized.values[field] || null
  return JSON.parse(JSON.stringify({ [field]: stored }))
}

test('null and empty per-server ping nodes inherit global defaults after save/read', () => {
  for (const field of PING_NODE_FIELDS) {
    for (const input of [null, '']) {
      const roundTripped = saveAndRead(field, input)
      assert.equal(buildAgentConfig(roundTripped, siteDefaults)[field], siteDefaults[field], `${field}=${String(input)}`)
    }
  }
})

test("explicit 0/'0' ping nodes survive save/read and remain disabled", () => {
  for (const field of PING_NODE_FIELDS) {
    for (const input of [0, '0']) {
      const roundTripped = saveAndRead(field, input)
      assert.equal(roundTripped[field], '0', `${field} should persist the disable sentinel`)
      assert.equal(buildAgentConfig(roundTripped, siteDefaults)[field], '', `${field}=${String(input)}`)
    }
  }
})

test('configured ping nodes survive save/read and override global defaults', () => {
  for (const field of PING_NODE_FIELDS) {
    const value = `${field}.custom.example.com:443`
    const roundTripped = saveAndRead(field, value)
    assert.equal(buildAgentConfig(roundTripped, siteDefaults)[field], value, field)
  }
})

test('import normalization distinguishes null, empty, and explicit disable for all fields', () => {
  for (const field of PING_NODE_FIELDS) {
    assert.equal(normalizeImportedPingNodeValue(null), null, `${field}: null`)
    assert.equal(normalizeImportedPingNodeValue(''), '', `${field}: empty`)
    assert.equal(normalizeImportedPingNodeValue(0), '0', `${field}: numeric zero`)
    assert.equal(normalizeImportedPingNodeValue('0'), '0', `${field}: string zero`)

    assert.equal(buildAgentConfig({ [field]: normalizeImportedPingNodeValue(null) }, siteDefaults)[field], siteDefaults[field])
    assert.equal(buildAgentConfig({ [field]: normalizeImportedPingNodeValue('') }, siteDefaults)[field], siteDefaults[field])
    assert.equal(buildAgentConfig({ [field]: normalizeImportedPingNodeValue('0') }, siteDefaults)[field], '')
  }
})
