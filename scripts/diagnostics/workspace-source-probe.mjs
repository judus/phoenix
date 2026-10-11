// No application startup, user data, network requests or control output.
// Run with: npx tsx watch --conditions=development scripts/diagnostics/workspace-source-probe.mjs
console.log(`Workspace load · process ${process.pid}`)
for (const name of ['contracts', 'elite', 'copilot']) {
  const specifier = `@phoenix/${name}`
  await import(specifier)
  console.log(`${specifier}: ${import.meta.resolve(specifier)}`)
}
