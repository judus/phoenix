import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('The PHOENIX Windows installer currently requires x64 Windows.')
}

const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
const payloadRoot = resolve(projectRoot, 'dist/payload/win32-x64')
const outputRoot = resolve(projectRoot, 'dist/installer')
const workRoot = resolve(outputRoot, '.windows-x64')
const launcher = resolve(workRoot, 'Phoenix.exe')

if (!existsSync(resolve(payloadRoot, 'manifest.json'))) {
  throw new Error('The Windows payload is missing. Run npm run payload:build first.')
}

rmSync(workRoot, { force: true, recursive: true })
mkdirSync(workRoot, { recursive: true })
mkdirSync(outputRoot, { recursive: true })
compileLauncher(launcher)

const compiler = findInnoSetupCompiler()
const template = readFileSync(resolve(projectRoot, 'scripts/package/windows/phoenix.iss'), 'utf8')
const definition = resolve(workRoot, 'phoenix.iss')
writeFileSync(definition, renderTemplate(template, {
  LauncherPath: installerValue(launcher),
  LicensePath: installerValue(resolve(projectRoot, 'LICENSE')),
  OutputRoot: installerValue(outputRoot),
  PayloadRoot: installerValue(payloadRoot),
  PhoenixVersion: installerValue(packageJson.version)
}))
execFileSync(compiler, [definition], { cwd: projectRoot, stdio: 'inherit' })

rmSync(workRoot, { force: true, recursive: true })
console.log(`PHOENIX Windows test installer created under ${outputRoot}`)

function compileLauncher (output) {
  const programFiles = process.env['ProgramFiles(x86)'] ?? process.env.ProgramFiles
  const vswhere = resolve(programFiles, 'Microsoft Visual Studio/Installer/vswhere.exe')
  const installationPath = execFileSync(vswhere, [
    '-latest',
    '-products',
    '*',
    '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property',
    'installationPath'
  ], { encoding: 'utf8' }).trim()
  if (!installationPath) throw new Error('Visual C++ Build Tools were not found.')

  const vcvars = resolve(installationPath, 'VC/Auxiliary/Build/vcvars64.bat')
  const source = resolve(projectRoot, 'apps/launcher/windows/phoenix-launcher.cpp')
  const compileScript = resolve(workRoot, 'compile-launcher.cmd')
  writeFileSync(compileScript, `@echo off\r\ncall "${vcvars}"\r\nif errorlevel 1 exit /b %errorlevel%\r\ncl.exe /nologo /O2 /MT /std:c++17 /DUNICODE /D_UNICODE /EHsc "${source}" /Fe:"${output}" /link /SUBSYSTEM:WINDOWS shell32.lib user32.lib\r\n`)
  execFileSync('cmd.exe', ['/d', '/c', compileScript], { cwd: workRoot, stdio: 'inherit' })
}

function findInnoSetupCompiler () {
  const candidates = [
    process.env.INNO_SETUP_COMPILER,
    resolve(process.env.ProgramFiles ?? 'C:\\Program Files', 'Inno Setup 7/ISCC.exe'),
    resolve(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Inno Setup 7/ISCC.exe'),
    resolve(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Inno Setup 6/ISCC.exe')
  ].filter(Boolean)
  const compiler = candidates.find(existsSync)
  if (!compiler) throw new Error('Inno Setup compiler was not found. Set INNO_SETUP_COMPILER to ISCC.exe.')
  return compiler
}

function renderTemplate (template, values) {
  return Object.entries(values).reduce((rendered, [name, value]) => {
    const marker = `@@${name}@@`
    if (!rendered.includes(marker)) throw new Error(`Inno Setup template marker is missing: ${marker}`)
    return rendered.replaceAll(marker, value)
  }, template)
}

function installerValue (value) {
  if (/["\r\n]/u.test(value)) throw new Error(`Unsafe Inno Setup value: ${value}`)
  return value
}
