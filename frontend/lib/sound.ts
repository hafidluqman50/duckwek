'use client'

/** WebAudio synth: every sound is generated, no audio files. Unlocks on the first tap. */
type MusicMode = 'lobby' | 'race' | null

class SoundEngine {
  private ac: AudioContext | null = null
  private master!: GainNode
  private sfxBus!: GainNode
  private musBus!: GainNode
  private musId: ReturnType<typeof setInterval> | null = null
  private musMode: MusicMode = null
  private wanted: MusicMode = null
  sfxOn = true
  musicOn = true
  volume = 0.6

  load() {
    try {
      const s = JSON.parse(localStorage.getItem('duckwek.sound') || '{}')
      if (typeof s.sfx === 'boolean') this.sfxOn = s.sfx
      if (typeof s.music === 'boolean') this.musicOn = s.music
    } catch {}
  }

  save() {
    try {
      localStorage.setItem('duckwek.sound', JSON.stringify({ sfx: this.sfxOn, music: this.musicOn }))
    } catch {}
  }

  setVolume(v: number) {
    this.volume = v
    if (this.ac) this.master.gain.value = v
  }

  unlock(): AudioContext | null {
    try {
      if (!this.ac) {
        const AC = window.AudioContext || (window as any).webkitAudioContext
        if (!AC) return null
        this.ac = new AC()
        this.master = this.ac.createGain()
        this.master.gain.value = this.volume
        this.master.connect(this.ac.destination)
        this.sfxBus = this.ac.createGain()
        this.sfxBus.gain.value = 0.9
        this.sfxBus.connect(this.master)
        this.musBus = this.ac.createGain()
        this.musBus.gain.value = 0.28
        this.musBus.connect(this.master)
      }
      if (this.ac.state === 'suspended') this.ac.resume().then(() => this.music(this.wanted))
      return this.ac
    } catch {
      return null
    }
  }

  private tone(f: number, dur: number, type: OscillatorType = 'square', vol = 0.2, at = 0, slide = 0, bus?: GainNode) {
    const ac = this.ac
    if (!ac) return
    const t = ac.currentTime + at
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(f, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(bus || this.sfxBus)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private noise(dur: number, vol = 0.2, freq = 1000, at = 0, ftype: BiquadFilterType = 'bandpass', bus?: GainNode, attack = 0.01) {
    const ac = this.ac
    if (!ac) return
    const t = ac.currentTime + at
    const len = Math.max(1, Math.floor(ac.sampleRate * dur))
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    const f = ac.createBiquadFilter()
    const g = ac.createGain()
    src.buffer = buf
    f.type = ftype
    f.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(bus || this.sfxBus)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  private quack(at = 0, p = 1) {
    const ac = this.ac
    if (!ac) return
    const t = ac.currentTime + at
    const o = ac.createOscillator()
    const f = ac.createBiquadFilter()
    const g = ac.createGain()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(560 * p, t)
    o.frequency.exponentialRampToValueAtTime(300 * p, t + 0.16)
    f.type = 'bandpass'
    f.frequency.setValueAtTime(1300 * p, t)
    f.frequency.exponentialRampToValueAtTime(700 * p, t + 0.16)
    f.Q.value = 4
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    o.connect(f)
    f.connect(g)
    g.connect(this.sfxBus)
    o.start(t)
    o.stop(t + 0.2)
  }

  play(name: 'tap' | 'quack' | 'shuffle' | 'sign' | 'coin' | 'sparkle' | 'error' | 'beep' | 'go' | 'splash' | 'cheer' | 'shutter' | 'crowd' | 'fanfare' | 'sting' | 'join') {
    if (!this.sfxOn || !this.unlock()) return
    switch (name) {
      case 'tap': return this.tone(720, 0.05, 'square', 0.05)
      case 'quack': this.quack(0, 1); return this.quack(0.2, 1.08)
      case 'shuffle': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.07, 'square', 0.08, i * 0.045)); return this.quack(0.2, 1.15)
      case 'sign': return [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.18, i * 0.07))
      case 'coin': this.tone(988, 0.08, 'square', 0.12); return this.tone(1319, 0.3, 'square', 0.12, 0.08)
      case 'sparkle': return [1568, 2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.1, i * 0.06))
      case 'error': return this.tone(220, 0.25, 'sawtooth', 0.12, 0, 150)
      case 'beep': return this.tone(440, 0.18, 'square', 0.16)
      case 'go': this.tone(880, 0.45, 'square', 0.16); this.quack(0.05, 1.2); return this.noise(0.6, 0.12, 2500, 0, 'highpass')
      case 'splash': return this.noise(0.09, 0.05, 900 + Math.random() * 700)
      case 'cheer': this.quack(0, 1.3); return this.tone(1200, 0.08, 'square', 0.06, 0.02)
      case 'join': return this.quack(0, 1.4)
      case 'shutter': this.noise(0.05, 0.4, 3500, 0, 'highpass'); return this.noise(0.07, 0.3, 2500, 0.09, 'highpass')
      case 'crowd': this.noise(2.6, 0.22, 900, 0, 'bandpass', undefined, 0.5); return this.noise(2.2, 0.12, 2200, 0.2, 'bandpass', undefined, 0.4)
      case 'fanfare':
        return [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.6], [1047, 0.72]].forEach(([f, at]) => {
          const d = at >= 0.7 ? 0.9 : 0.14
          this.tone(f, d, 'square', 0.13, at)
          this.tone(f / 2, d, 'triangle', 0.12, at)
        })
      case 'sting': return [392, 523, 659].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, i * 0.1))
    }
  }

  music(mode: MusicMode) {
    this.wanted = mode
    if (!this.musicOn || !this.ac || this.ac.state !== 'running') mode = null
    if (mode === this.musMode) return
    if (this.musId) clearInterval(this.musId)
    this.musId = null
    this.musMode = mode
    if (!mode) return
    const race = mode === 'race'
    const dt = race ? 0.2 : 0.27
    const bass = race ? [82, 82, 98, 82, 110, 82, 123, 110] : [131, 0, 98, 0, 110, 0, 87, 0]
    const mel = race ? [659, 784, 988, 784, 659, 784, 1175, 988, 659, 784, 988, 1319, 1175, 988, 784, 659] : [523, 0, 659, 784, 0, 659, 587, 0, 523, 0, 659, 880, 784, 0, 659, 0]
    let step = 0
    this.musId = setInterval(() => {
      const b = bass[step % bass.length]
      const m = mel[step % mel.length]
      if (b) this.tone(b, dt * 0.9, 'triangle', 0.5, 0, 0, this.musBus)
      if (m && (race || step % 2 === 0 || step % 3 === 0)) this.tone(m, dt * 0.6, 'square', 0.12, 0, 0, this.musBus)
      if (race) {
        this.noise(0.04, 0.12, 7000, 0, 'highpass', this.musBus)
        if (step % 4 === 0) this.tone(150, 0.12, 'sine', 0.6, 0, 40, this.musBus)
      }
      step++
    }, dt * 1000)
  }

  toggleSfx() {
    this.sfxOn = !this.sfxOn
    this.save()
  }

  toggleMusic() {
    this.musicOn = !this.musicOn
    this.save()
    const w = this.wanted
    this.musMode = null
    if (this.musId) clearInterval(this.musId)
    this.musId = null
    this.music(w)
  }
}

export const sound = new SoundEngine()
