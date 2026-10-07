import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const androidRoot = join(root, 'apps/android')
const apk = join(androidRoot, 'app/build/outputs/apk/debug/app-debug.apk')
const activity = 'io.github.judus.phoenix.debug/io.github.judus.phoenix.MainActivity'

export function parseDevices(output) {
  return output.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^(\S+)\s+(device|offline|unauthorized)\b(.*)$/)
    return match ? [{ serial: match[1], state: match[2], model: match[3].match(/\bmodel:(\S+)/)?.[1]?.replaceAll('_', ' ') }] : []
  })
}

export function wirelessAddress(input) {
  const value = input.trim()
  const match = value.match(/^(?:\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+):(\d+)$/)
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 65535) {
    throw new Error('Enter the IP address and port shown by Android, for example 192.168.1.20:37123.')
  }
  return value
}

export function parseOptions(args) {
  const options = { build: true, serial: undefined, help: false }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-build') options.build = false
    else if (args[i] === '--help') options.help = true
    else if (args[i] === '--serial' && args[i + 1] && !args[i + 1].startsWith('--')) options.serial = args[++i]
    else throw new Error('Usage: npm run android:install -- [--serial DEVICE_SERIAL] [--no-build]')
  }
  return options
}

/** Pairing codes go directly to adb's interactive stdin, never through arguments or this script. */
export async function installAndroid(options, { run, ask, log, adb = 'adb', platform = process.platform, hasApk = () => existsSync(apk) }) {
  const devices = async () => parseDevices(await run(adb, ['devices', '-l']))
  let available = await devices()
  let serial = options.serial
  if (serial) {
    if (!available.some(device => device.serial === serial && device.state === 'device')) {
      throw new Error(`Device ${serial} is not ready. Check adb devices and authorize USB debugging or connect wireless debugging first.`)
    }
  } else {
    if (!available.some(device => device.state === 'device')) {
      for (const device of available) log(`${device.serial}: ${device.state} (authorize debugging on the device or reconnect it).`)
      log('Enable Developer options → Wireless debugging on Android. Keep both devices on the same network.')
      const mode = (await ask('[1] Pair a new device, [2] Connect an already paired device: ')).trim()
      if (mode !== '1' && mode !== '2') throw new Error('Choose 1 for pairing or 2 for an existing pairing.')
      if (mode === '1') {
        const endpoint = wirelessAddress(await ask('Open “Pair device with pairing code”. Pairing IP address:port: '))
        log('Enter Android’s ADB pairing code when adb asks (not the PHOENIX pairing code).')
        await run(adb, ['pair', endpoint], { interactive: true })
        available = await devices() // Android may automatically connect through mDNS after pairing.
      }
      if (mode === '2' || !available.some(device => device.state === 'device')) {
        const endpoint = wirelessAddress(await ask('Connection IP address:port from the main Wireless debugging screen (NOT the pairing port): '))
        log((await run(adb, ['connect', endpoint])).trim())
        available = await devices()
        if (!available.some(device => device.serial === endpoint && device.state === 'device')) {
          throw new Error('ADB did not connect to that device. Check its connection port, Wi-Fi and Wireless debugging setting, then retry.')
        }
        serial = endpoint
      }
    }
    if (!serial) {
      const ready = available.filter(device => device.state === 'device')
      if (ready.length === 1) serial = ready[0].serial
      else {
        ready.forEach((device, index) => log(`${index + 1}. ${device.model ?? 'Android device'} (${device.serial})`))
        const choice = (await ask('Install on which device? Enter its number: ')).trim()
        if (!/^\d+$/.test(choice) || !ready[Number(choice) - 1]) throw new Error('Choose a device number from the list.')
        serial = ready[Number(choice) - 1].serial
      }
    }
  }
  log(`Installing the PHOENIX debug app on ${serial}. Existing app data will be kept.`)
  if (options.build) {
    await run(platform === 'win32' ? 'gradlew.bat' : './gradlew', ['assembleDebug'], {
      cwd: androidRoot, interactive: true, shell: platform === 'win32'
    })
  }
  if (!hasApk()) throw new Error('Debug APK not found. Run without --no-build to build it first.')
  log((await run(adb, ['-s', serial, 'install', '-r', apk])).trim())
  // No uninstall/data clear, signature/downgrade bypass, or fallback to a different device.
  log((await run(adb, ['-s', serial, 'shell', 'am', 'start', '-W', '-n', activity])).trim())
  log('PHOENIX opened. Android ADB pairing and PHOENIX device authorization are separate.')
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      shell: options.shell ?? false,
      stdio: options.interactive ? 'inherit' : ['ignore', 'pipe', 'pipe']
    })
    let output = ''
    let errors = ''
    child.stdout?.on('data', chunk => { output += chunk })
    child.stderr?.on('data', chunk => { errors += chunk })
    child.on('error', error => reject(new Error(`Cannot run ${command}: ${error.message}. Check Android SDK platform-tools and JAVA_HOME (JDK 17/21).`)))
    child.on('close', (code, signal) => code === 0 ? resolve(output) : reject(new Error(
      `${command} failed (${signal ?? code}). ${errors.trim() || output.trim()}`
    )))
  })
}

async function ask(question) {
  if (!process.stdin.isTTY) throw new Error('Device selection/pairing needs an interactive terminal. Connect a device first or pass --serial DEVICE_SERIAL.')
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  try { return await prompt.question(question) } finally { prompt.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2))
    if (options.help) console.log('Usage: npm run android:install -- [--serial DEVICE_SERIAL] [--no-build]\nBuild, choose/connect a device, install without clearing app data, and launch the debug app.\nRequires JDK 17/21 and Android SDK; set ANDROID_HOME or put adb on PATH.')
    else {
      const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
      const adb = sdk ? join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb') : 'adb'
      await installAndroid(options, { run, ask, log: console.log, adb })
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
