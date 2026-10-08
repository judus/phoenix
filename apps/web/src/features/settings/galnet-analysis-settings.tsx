import { Section, SettingsList, SettingRow, SettingToggle, Select, Status } from '@phoenix/ui'
import { useGalnetBackground, type GalnetBackgroundApi } from '../../components/use-galnet-background.js'

export function GalnetAnalysisSettings({ api }: { api: GalnetBackgroundApi }) {
  const { status, error, pending, change } = useGalnetBackground(api)
  return <Section title="GalNet intelligence" description="Optional background AI analysis, separate from Copilot permissions. Uses your configured model and API credit.">
    <SettingsList>
      <SettingRow title="Analyse new coverage automatically" scope="Installation"
        description="Checks every 15 minutes for new or revised articles and changed Community Goal briefings. Older articles require manual catch-up in GalNet. An in-flight request may still finish after switching off. Off until explicitly enabled.">
        <SettingToggle label={status?.enabled ? 'On' : 'Off'} checked={status?.enabled ?? false} disabled={!status || pending}
          onChange={() => status && void change(signal => api.saveGalnetBackground({ enabled: !status.enabled, dailyLimit: status.dailyLimit }, signal))} />
      </SettingRow>
      <SettingRow title="Daily background limit" scope="Installation"
        description="Maximum queued analysis attempts per UTC day, including manual catch-up and failed attempts. Not a monetary cap; individual article analysis remains separate.">
        <Select aria-label="Daily GalNet analysis limit" value={status?.dailyLimit ?? 10} disabled={!status || pending}
          onChange={event => { const dailyLimit = Number(event.target.value); if (status) void change(signal => api.saveGalnetBackground({ enabled: status.enabled, dailyLimit }, signal)) }}>
          {[1, 5, 10, 20, 50].map(value => <option key={value} value={value}>{value}</option>)}
        </Select>
      </SettingRow>
    </SettingsList>
    {status && <Status wrap tone="muted">{status.requestsToday} / {status.dailyLimit} attempts today · {status.pending} queued{!status.configured ? ' · Configure an API key and restart PHOENIX to analyse.' : ''}</Status>}
    {error && <Status tone="danger" wrap>{error}</Status>}
  </Section>
}
