import type { CopilotAudioProcessing } from '@phoenix/contracts'

export interface PcmPlayback {
  append(base64Audio: string): void
  clear(): void
  stop(): void
}

export interface AudioProcessingSession {
  context: AudioContext
  inputMeter: AnalyserNode
  outputMeter: AnalyserNode
  playback: PcmPlayback
  stop(): Promise<void>
}

export async function createRealtimeAudioSession (
  stream: MediaStream,
  socket: WebSocket,
  config: CopilotAudioProcessing,
  outputDeviceId: string
): Promise<AudioProcessingSession> {
  const context = new AudioContext({ latencyHint: 'interactive' })
  await context.resume()
  await setAudioOutput(context, outputDeviceId)
  const input = context.createGain()
  const graph = createProcessingGraph(context, input, config)
  const playback = createPcmPlayback(context, input)
  const microphone = await startMicrophoneCapture(context, stream, socket)
  return {
    context,
    inputMeter: graph.inputMeter,
    outputMeter: graph.outputMeter,
    playback,
    stop: async () => {
      microphone.stop()
      playback.stop()
      graph.disconnect()
      await context.close()
    }
  }
}

export function signalLevel (analyser: AnalyserNode): string {
  const samples = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(samples)
  let sum = 0
  for (const sample of samples) {
    const normalized = (sample - 128) / 128
    sum += normalized * normalized
  }
  const rms = Math.sqrt(sum / samples.length)
  return rms < 0.0001 ? 'silent' : `${Math.round(20 * Math.log10(rms))} dB`
}

async function startMicrophoneCapture (
  context: AudioContext,
  stream: MediaStream,
  socket: WebSocket
): Promise<{ stop(): void }> {
  await context.audioWorklet.addModule('/pcm-capture-worklet.js')
  const source = context.createMediaStreamSource(stream)
  const worklet = new AudioWorkletNode(context, 'phoenix-pcm-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 0
  })
  source.connect(worklet)
  worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
    if (socket.readyState !== WebSocket.OPEN) return
    const samples = downsampleAudio(event.data, context.sampleRate, 24_000)
    socket.send(JSON.stringify({
      audio: encodePcm16(samples),
      type: 'input_audio_buffer.append'
    }))
  }
  return {
    stop: () => {
      worklet.port.onmessage = null
      source.disconnect()
      worklet.disconnect()
    }
  }
}

function createPcmPlayback (context: AudioContext, destination: AudioNode): PcmPlayback {
  let nextStartTime = 0
  const sources = new Set<AudioBufferSourceNode>()
  const clear = (): void => {
    for (const source of sources) {
      try { source.stop() } catch {}
      source.disconnect()
    }
    sources.clear()
    nextStartTime = 0
  }
  return {
    append: base64Audio => {
      const pcm = decodePcm16(base64Audio)
      if (pcm.length === 0) return
      const buffer = context.createBuffer(1, pcm.length, 24_000)
      buffer.copyToChannel(pcm, 0)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(destination)
      sources.add(source)
      source.onended = () => {
        sources.delete(source)
        source.disconnect()
      }
      nextStartTime = Math.max(nextStartTime, context.currentTime + 0.025)
      source.start(nextStartTime)
      nextStartTime += buffer.duration
    },
    clear,
    stop: clear
  }
}

function createProcessingGraph (
  context: AudioContext,
  source: AudioNode,
  config: CopilotAudioProcessing
): { inputMeter: AnalyserNode, outputMeter: AnalyserNode, disconnect(): void } {
  const nodes: AudioNode[] = []
  const inputMeter = context.createAnalyser()
  inputMeter.fftSize = 512
  source.connect(inputMeter)
  nodes.push(inputMeter)
  let current: AudioNode = inputMeter
  const append = (node: AudioNode): void => {
    current.connect(node)
    current = node
    nodes.push(node)
  }
  if (config.filters.highpass.enabled) append(createFilter(context, 'highpass', config.filters.highpass))
  if (config.filters.lowpass.enabled) append(createFilter(context, 'lowpass', config.filters.lowpass))
  if (config.filters.presence.enabled) {
    const presence = createFilter(context, 'peaking', config.filters.presence)
    presence.gain.value = config.filters.presence.gainDb
    append(presence)
  }
  if (config.saturation.enabled && config.saturation.amount > 0) {
    const saturation = context.createWaveShaper()
    saturation.curve = saturationCurve(config.saturation.amount)
    saturation.oversample = 'none'
    append(saturation)
  }
  if (config.compressor.enabled) {
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = config.compressor.thresholdDb
    compressor.knee.value = config.compressor.kneeDb
    compressor.ratio.value = config.compressor.ratio
    compressor.attack.value = config.compressor.attackSeconds
    compressor.release.value = config.compressor.releaseSeconds
    append(compressor)
  }

  const spatial = context.createGain()
  nodes.push(spatial)
  if (config.room.enabled && config.room.mix > 0) {
    const dry = context.createGain()
    const wet = context.createGain()
    const convolver = context.createConvolver()
    dry.gain.value = Math.cos(config.room.mix * Math.PI / 2)
    wet.gain.value = Math.sin(config.room.mix * Math.PI / 2)
    convolver.normalize = false
    convolver.buffer = roomImpulse(context, config.room.durationSeconds, config.room.decay)
    current.connect(dry)
    current.connect(convolver)
    convolver.connect(wet)
    dry.connect(spatial)
    wet.connect(spatial)
    nodes.push(dry, wet, convolver)
  } else {
    current.connect(spatial)
  }
  if (config.reflection.enabled && config.reflection.gain > 0) {
    const reflection = context.createDelay(0.15)
    const reflectionGain = context.createGain()
    reflection.delayTime.value = config.reflection.delaySeconds
    reflectionGain.gain.value = config.reflection.gain
    current.connect(reflection)
    reflection.connect(reflectionGain)
    reflectionGain.connect(spatial)
    nodes.push(reflection, reflectionGain)
  }
  const output = context.createGain()
  output.gain.value = config.outputGain
  const outputMeter = context.createAnalyser()
  outputMeter.fftSize = 512
  spatial.connect(output)
  output.connect(outputMeter)
  outputMeter.connect(context.destination)
  nodes.push(output, outputMeter)
  return {
    inputMeter,
    outputMeter,
    disconnect: () => {
      source.disconnect()
      for (const node of nodes) node.disconnect()
    }
  }
}

function createFilter (
  context: AudioContext,
  type: BiquadFilterType,
  config: { frequencyHz: number, q: number }
): BiquadFilterNode {
  const filter = context.createBiquadFilter()
  filter.type = type
  filter.frequency.value = config.frequencyHz
  filter.Q.value = config.q
  return filter
}

function saturationCurve (amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(2048)
  const drive = 1 + amount * 20
  const normalization = Math.tanh(drive)
  for (let index = 0; index < curve.length; index += 1) {
    const input = index * 2 / (curve.length - 1) - 1
    curve[index] = Math.tanh(input * drive) / normalization
  }
  return curve
}

function roomImpulse (context: AudioContext, durationSeconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * durationSeconds))
  const impulse = context.createBuffer(2, length, context.sampleRate)
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const samples = impulse.getChannelData(channel)
    for (let index = 0; index < length; index += 1) {
      samples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, decay) * 0.25
    }
  }
  return impulse
}

function downsampleAudio (input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input
  const ratio = inputRate / outputRate
  const output = new Float32Array(Math.max(1, Math.floor(input.length / ratio)))
  for (let index = 0; index < output.length; index += 1) {
    const start = Math.floor(index * ratio)
    const end = Math.min(input.length, Math.floor((index + 1) * ratio))
    let sum = 0
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) sum += input[inputIndex] ?? 0
    output[index] = sum / Math.max(1, end - start)
  }
  return output
}

function encodePcm16 (samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index] ?? 0))
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
  }
  return bytesToBase64(bytes)
}

function decodePcm16 (base64Audio: string): Float32Array<ArrayBuffer> {
  const bytes = base64ToBytes(base64Audio)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const samples = new Float32Array(Math.floor(bytes.byteLength / 2))
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 0x8000
  }
  return samples
}

function bytesToBase64 (bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return window.btoa(binary)
}

function base64ToBytes (value: string): Uint8Array<ArrayBuffer> {
  const binary = window.atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function setAudioOutput (context: AudioContext, deviceId: string): Promise<void> {
  if (!deviceId) return
  const configurable = context as AudioContext & { setSinkId?: (id: string) => Promise<void> }
  await configurable.setSinkId?.(deviceId)
}
