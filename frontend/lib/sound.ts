'use client'

type MusicMode = 'lobby' | 'race' | null

class SoundEngine {
  private audioContext: AudioContext | null = null
  private master!: GainNode
  private sfxBus!: GainNode
  private musicBus!: GainNode
  private musicTimerId: ReturnType<typeof setInterval> | null = null
  private musicMode: MusicMode = null
  private wantedMusicMode: MusicMode = null
  sfxOn = true
  musicOn = true
  volume = 0.6

  load() {
    try {
      const stored = JSON.parse(localStorage.getItem('duckwek.sound') || '{}')

      if (typeof stored.sfx === 'boolean') this.sfxOn = stored.sfx

      if (typeof stored.music === 'boolean') this.musicOn = stored.music
    } catch {}
  }

  save() {
    try {
      localStorage.setItem('duckwek.sound', JSON.stringify({ sfx: this.sfxOn, music: this.musicOn }))
    } catch {}
  }

  setVolume(volume: number) {
    this.volume = volume

    if (this.audioContext) this.master.gain.value = volume
  }

  unlock(): AudioContext | null {
    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext

        if (!AudioContextClass) return null

        this.audioContext = new AudioContextClass()
        this.master = this.audioContext.createGain()
        this.master.gain.value = this.volume
        this.master.connect(this.audioContext.destination)
        this.sfxBus = this.audioContext.createGain()
        this.sfxBus.gain.value = 0.9
        this.sfxBus.connect(this.master)
        this.musicBus = this.audioContext.createGain()
        this.musicBus.gain.value = 0.28
        this.musicBus.connect(this.master)
      }

      if (this.audioContext.state === 'suspended') this.audioContext.resume().then(() => this.music(this.wantedMusicMode))

      return this.audioContext
    } catch {
      return null
    }
  }

  private tone(frequency: number, duration: number, type: OscillatorType = 'square', level = 0.2, delay = 0, slideTo = 0, bus?: GainNode) {
    const audioContext = this.audioContext

    if (!audioContext) return

    const startTime = audioContext.currentTime + delay
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, startTime)

    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, startTime + duration)

    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(level, startTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
    oscillator.connect(gain)
    gain.connect(bus || this.sfxBus)
    oscillator.start(startTime)
    oscillator.stop(startTime + duration + 0.02)
  }

  private noise(duration: number, level = 0.2, frequency = 1000, delay = 0, filterType: BiquadFilterType = 'bandpass', bus?: GainNode, attack = 0.01) {
    const audioContext = this.audioContext

    if (!audioContext) return

    const startTime = audioContext.currentTime + delay
    const length = Math.max(1, Math.floor(audioContext.sampleRate * duration))
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate)
    const channel = buffer.getChannelData(0)

    for (let index = 0; index < length; index++) channel[index] = Math.random() * 2 - 1

    const source = audioContext.createBufferSource()
    const filter = audioContext.createBiquadFilter()
    const gain = audioContext.createGain()

    source.buffer = buffer
    filter.type = filterType
    filter.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(level, startTime + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(bus || this.sfxBus)
    source.start(startTime)
    source.stop(startTime + duration + 0.02)
  }

  private quack(delay = 0, pitch = 1) {
    const audioContext = this.audioContext

    if (!audioContext) return

    const startTime = audioContext.currentTime + delay
    const oscillator = audioContext.createOscillator()
    const filter = audioContext.createBiquadFilter()
    const gain = audioContext.createGain()

    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(560 * pitch, startTime)
    oscillator.frequency.exponentialRampToValueAtTime(300 * pitch, startTime + 0.16)
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1300 * pitch, startTime)
    filter.frequency.exponentialRampToValueAtTime(700 * pitch, startTime + 0.16)
    filter.Q.value = 4
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(0.5, startTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18)
    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxBus)
    oscillator.start(startTime)
    oscillator.stop(startTime + 0.2)
  }

  play(name: 'tap' | 'quack' | 'shuffle' | 'sign' | 'coin' | 'sparkle' | 'error' | 'beep' | 'go' | 'splash' | 'cheer' | 'shutter' | 'crowd' | 'fanfare' | 'sting' | 'join') {
    if (!this.sfxOn || !this.unlock()) return

    switch (name) {
      case 'tap': return this.tone(720, 0.05, 'square', 0.05)
      case 'quack': this.quack(0, 1); return this.quack(0.2, 1.08)
      case 'shuffle': [523, 659, 784, 1047].forEach((frequency, index) => this.tone(frequency, 0.07, 'square', 0.08, index * 0.045)); return this.quack(0.2, 1.15)
      case 'sign': return [523, 659, 784].forEach((frequency, index) => this.tone(frequency, 0.16, 'triangle', 0.18, index * 0.07))
      case 'coin': this.tone(988, 0.08, 'square', 0.12); return this.tone(1319, 0.3, 'square', 0.12, 0.08)
      case 'sparkle': return [1568, 2093, 2637, 3136].forEach((frequency, index) => this.tone(frequency, 0.18, 'triangle', 0.1, index * 0.06))
      case 'error': return this.tone(220, 0.25, 'sawtooth', 0.12, 0, 150)
      case 'beep': return this.tone(440, 0.18, 'square', 0.16)
      case 'go': this.tone(880, 0.45, 'square', 0.16); this.quack(0.05, 1.2); return this.noise(0.6, 0.12, 2500, 0, 'highpass')
      case 'splash': return this.noise(0.09, 0.05, 900 + Math.random() * 700)
      case 'cheer': this.quack(0, 1.3); return this.tone(1200, 0.08, 'square', 0.06, 0.02)
      case 'join': return this.quack(0, 1.4)
      case 'shutter': this.noise(0.05, 0.4, 3500, 0, 'highpass'); return this.noise(0.07, 0.3, 2500, 0.09, 'highpass')
      case 'crowd': this.noise(2.6, 0.22, 900, 0, 'bandpass', undefined, 0.5); return this.noise(2.2, 0.12, 2200, 0.2, 'bandpass', undefined, 0.4)
      case 'fanfare':
        return [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.6], [1047, 0.72]].forEach(([frequency, delay]) => {
          const noteDuration = delay >= 0.7 ? 0.9 : 0.14

          this.tone(frequency, noteDuration, 'square', 0.13, delay)
          this.tone(frequency / 2, noteDuration, 'triangle', 0.12, delay)
        })
      case 'sting': return [392, 523, 659].forEach((frequency, index) => this.tone(frequency, 0.22, 'triangle', 0.14, index * 0.1))
    }
  }

  music(mode: MusicMode) {
    this.wantedMusicMode = mode

    if (!this.musicOn || !this.audioContext || this.audioContext.state !== 'running') mode = null

    if (mode === this.musicMode) return

    if (this.musicTimerId) clearInterval(this.musicTimerId)

    this.musicTimerId = null
    this.musicMode = mode

    if (!mode) return

    const race = mode === 'race'
    const stepSeconds = race ? 0.2 : 0.27
    const bass = race ? [82, 82, 98, 82, 110, 82, 123, 110] : [131, 0, 98, 0, 110, 0, 87, 0]
    const melody = race ? [659, 784, 988, 784, 659, 784, 1175, 988, 659, 784, 988, 1319, 1175, 988, 784, 659] : [523, 0, 659, 784, 0, 659, 587, 0, 523, 0, 659, 880, 784, 0, 659, 0]
    let step = 0

    this.musicTimerId = setInterval(() => {
      const bassNote = bass[step % bass.length]
      const melodyNote = melody[step % melody.length]

      if (bassNote) this.tone(bassNote, stepSeconds * 0.9, 'triangle', 0.5, 0, 0, this.musicBus)

      if (melodyNote && (race || step % 2 === 0 || step % 3 === 0)) this.tone(melodyNote, stepSeconds * 0.6, 'square', 0.12, 0, 0, this.musicBus)

      if (race) {
        this.noise(0.04, 0.12, 7000, 0, 'highpass', this.musicBus)

        if (step % 4 === 0) this.tone(150, 0.12, 'sine', 0.6, 0, 40, this.musicBus)
      }

      step++
    }, stepSeconds * 1000)
  }

  toggleSfx() {
    this.sfxOn = !this.sfxOn
    this.save()
  }

  toggleMusic() {
    this.musicOn = !this.musicOn
    this.save()

    const wantedMusicMode = this.wantedMusicMode

    this.musicMode = null

    if (this.musicTimerId) clearInterval(this.musicTimerId)

    this.musicTimerId = null
    this.music(wantedMusicMode)
  }
}

export const sound = new SoundEngine()
