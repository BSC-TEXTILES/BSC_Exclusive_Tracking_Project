// Notification sound generator using Web Audio API
// No external files needed — generates tones programmatically

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export function playNotificationSound(type: 'message' | 'notification' | 'alert' | 'success' = 'notification') {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const now = ctx.currentTime

    if (type === 'message') {
      // Two-tone pleasant message sound
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, now)
      osc1.frequency.setValueAtTime(1100, now + 0.1)
      gain1.gain.setValueAtTime(0.15, now)
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.25)
    } else if (type === 'notification') {
      // Soft chime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(659, now)
      osc.frequency.setValueAtTime(784, now + 0.1)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.3)
    } else if (type === 'alert') {
      // Urgent double beep
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(800, now)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.setValueAtTime(0, now + 0.1)
      gain.gain.setValueAtTime(0.08, now + 0.15)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.3)
    } else if (type === 'success') {
      // Rising tone
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523, now)
      osc.frequency.setValueAtTime(659, now + 0.1)
      osc.frequency.setValueAtTime(784, now + 0.2)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.4)
    }
  } catch {
    // Audio not supported or user hasn't interacted yet
  }
}

export function requestAudioPermission() {
  try {
    const ctx = new AudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }
    ctx.close()
  } catch {
    // Silent
  }
}
