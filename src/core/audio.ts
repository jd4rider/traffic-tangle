// Tiny WebAudio synth: every sound is generated at runtime, so the game ships
// no audio files. The context is created only after the first gesture, which
// respects browser autoplay rules.

type Tone = {
  frequency: number
  duration: number
  type: OscillatorType
  gain: number
  delay?: number
  slideTo?: number
}

const MUSIC_NOTES = [261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 349.23]
const MUSIC_BASS = [130.81, 146.83, 174.61, 196.0]

export class SoundEngine {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private musicTimer: number | null = null
  private musicStep = 0
  soundOn = true
  musicOn = true

  unlock(): void {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume()
      return
    }
    const Ctor = typeof window !== 'undefined' ? window.AudioContext : undefined
    if (!Ctor) return
    this.context = new Ctor()
    this.master = this.context.createGain()
    this.master.gain.value = 0.5
    this.master.connect(this.context.destination)
    this.sfxBus = this.context.createGain()
    this.sfxBus.gain.value = 1
    this.sfxBus.connect(this.master)
    this.musicBus = this.context.createGain()
    this.musicBus.gain.value = 0.2
    this.musicBus.connect(this.master)
    if (this.musicOn) this.startMusic()
  }

  setSound(on: boolean): void {
    this.soundOn = on
  }

  setMusic(on: boolean): void {
    this.musicOn = on
    if (on) this.startMusic()
    else this.stopMusic()
  }

  private tone(tone: Tone): void {
    if (!this.soundOn || !this.context || !this.sfxBus) return
    const start = this.context.currentTime + (tone.delay ?? 0)
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = tone.type
    oscillator.frequency.setValueAtTime(tone.frequency, start)
    if (tone.slideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, tone.slideTo), start + tone.duration)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, tone.gain), start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration)
    oscillator.connect(gain)
    gain.connect(this.sfxBus)
    oscillator.start(start)
    oscillator.stop(start + tone.duration + 0.03)
  }

  click(): void {
    this.tone({ frequency: 560, duration: 0.05, type: 'sine', gain: 0.12 })
  }

  select(): void {
    this.tone({ frequency: 620, duration: 0.08, type: 'triangle', gain: 0.14 })
    this.tone({ frequency: 880, duration: 0.09, type: 'sine', gain: 0.08, delay: 0.04 })
  }

  draw(): void {
    this.tone({ frequency: 720, duration: 0.04, type: 'square', gain: 0.05 })
  }

  invalid(): void {
    this.tone({ frequency: 200, duration: 0.16, type: 'sawtooth', gain: 0.08, slideTo: 140 })
  }

  go(): void {
    this.tone({ frequency: 330, duration: 0.16, type: 'triangle', gain: 0.14 })
    this.tone({ frequency: 494, duration: 0.2, type: 'triangle', gain: 0.1, delay: 0.06 })
  }

  horn(): void {
    this.tone({ frequency: 392, duration: 0.16, type: 'triangle', gain: 0.1 })
    this.tone({ frequency: 494, duration: 0.18, type: 'triangle', gain: 0.08, delay: 0.02 })
  }

  light(): void {
    this.tone({ frequency: 988, duration: 0.06, type: 'sine', gain: 0.06 })
  }

  undo(): void {
    this.tone({ frequency: 420, duration: 0.12, type: 'sine', gain: 0.1, slideTo: 300 })
  }

  hint(): void {
    this.tone({ frequency: 880, duration: 0.12, type: 'sine', gain: 0.09 })
    this.tone({ frequency: 1175, duration: 0.16, type: 'sine', gain: 0.08, delay: 0.08 })
  }

  win(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((frequency, index) =>
      this.tone({ frequency, duration: 0.34, type: 'triangle', gain: 0.14, delay: index * 0.11 }),
    )
  }

  lose(): void {
    this.tone({ frequency: 392, duration: 0.3, type: 'triangle', gain: 0.1, slideTo: 261 })
    this.tone({ frequency: 261, duration: 0.36, type: 'sine', gain: 0.08, delay: 0.16 })
  }

  private startMusic(): void {
    if (!this.musicOn || !this.context || this.musicTimer !== null) return
    this.musicTimer = window.setInterval(() => this.musicTick(), 640)
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer)
      this.musicTimer = null
    }
  }

  private musicTick(): void {
    if (!this.context || !this.musicBus || !this.musicOn) return
    const context = this.context
    const start = context.currentTime
    const note = MUSIC_NOTES[this.musicStep % MUSIC_NOTES.length]
    const bass = MUSIC_BASS[Math.floor(this.musicStep / 4) % MUSIC_BASS.length]
    const voice = context.createOscillator()
    const gain = context.createGain()
    voice.type = 'triangle'
    voice.frequency.value = note
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.045, start + 0.09)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.62)
    voice.connect(gain)
    gain.connect(this.musicBus)
    voice.start(start)
    voice.stop(start + 0.66)

    const bassVoice = context.createOscillator()
    const bassGain = context.createGain()
    bassVoice.type = 'sine'
    bassVoice.frequency.value = bass
    bassGain.gain.setValueAtTime(0.0001, start)
    bassGain.gain.exponentialRampToValueAtTime(0.035, start + 0.1)
    bassGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)
    bassVoice.connect(bassGain)
    bassGain.connect(this.musicBus)
    bassVoice.start(start)
    bassVoice.stop(start + 0.95)
    this.musicStep += 1
  }
}

export const sound = new SoundEngine()
