export const isDisabledProbeValue = (value) => value === false || value === 'false'

export const shouldShowThreeNetProbe = (server, probe) => {
  if (!server || !probe) return false
  // Only an explicit disabled pair hides a probe. NULL/undefined means no sample,
  // and must remain visible as “No samples” rather than becoming “timeout”.
  return !(isDisabledProbeValue(server[probe.pingField]) && isDisabledProbeValue(server[probe.lossField]))
}
