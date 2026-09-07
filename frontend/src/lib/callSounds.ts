// Synthesized audio tones using Web Audio API for WhatsApp-like Call sounds

class SoundManager {
  private ctx: AudioContext | null = null
  private ringOscillator: OscillatorNode | null = null
  private ringGain: GainNode | null = null
  private ringTimer: any = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (AudioCtx) this.ctx = new AudioCtx()
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  // Outgoing ringing tone (classic telecom ring-back tone)
  startOutgoingRinging() {
    this.stop()
    const ctx = this.getContext()
    if (!ctx) return

    let step = 0
    this.ringTimer = setInterval(() => {
      if (!ctx || ctx.state === 'closed') return
      try {
        const osc1 = ctx.createOscillator()
        const osc2 = ctx.createOscillator()
        const gain = ctx.createGain()

        osc1.type = 'sine'
        osc2.type = 'sine'
        osc1.frequency.setValueAtTime(440, ctx.currentTime) // 440 Hz
        osc2.frequency.setValueAtTime(480, ctx.currentTime) // 480 Hz

        gain.gain.setValueAtTime(0.08, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.6)

        osc1.connect(gain)
        osc2.connect(gain)
        gain.connect(ctx.destination)

        osc1.start(ctx.currentTime)
        osc2.start(ctx.currentTime)
        osc1.stop(ctx.currentTime + 1.6)
        osc2.stop(ctx.currentTime + 1.6)
      } catch {
        // ignore audio err
      }
      step++
    }, 3500)
  }

  // Incoming WhatsApp ringtone (melodic chime)
  startIncomingRingtone() {
    this.stop()
    const ctx = this.getContext()
    if (!ctx) return

    const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
    let step = 0

    this.ringTimer = setInterval(() => {
      if (!ctx || ctx.state === 'closed') return
      try {
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12)
          gain.gain.setValueAtTime(0.1, ctx.currentTime + idx * 0.12)
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.3)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(ctx.currentTime + idx * 0.12)
          osc.stop(ctx.currentTime + idx * 0.12 + 0.3)
        })
      } catch {
        // ignore
      }
      step++
    }, 2000)
  }

  // End call beep
  playEndCallBeep() {
    this.stop()
    const ctx = this.getContext()
    if (!ctx) return
    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(420, ctx.currentTime)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.35)
    } catch {
      // ignore
    }
  }

  // New message notification sound
  playMessagePop() {
    const ctx = this.getContext()
    if (!ctx) return
    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.15)
    } catch {
      // ignore
    }
  }

  stop() {
    if (this.ringTimer) {
      clearInterval(this.ringTimer)
      this.ringTimer = null
    }
    if (this.ringOscillator) {
      try {
        this.ringOscillator.stop()
        this.ringOscillator.disconnect()
      } catch {
        // ignore
      }
      this.ringOscillator = null
    }
    if (this.ringGain) {
      try {
        this.ringGain.disconnect()
      } catch {
        // ignore
      }
      this.ringGain = null
    }
  }
}

export const callSounds = new SoundManager()
