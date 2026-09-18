/**
 * Web Audio API Sound Synthesizer for Baghchal
 * Zero external audio files required, works offline seamlessly.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('baghchal_muted');
      this.muted = saved === 'true';
    }
  }

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('baghchal_muted', String(this.muted));
    }
    return this.muted;
  }

  /**
   * Sound when placing a piece (warm resonant wood click + subtle goat myaa if goat)
   */
  public playPlace(piece?: 'tiger' | 'goat') {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    if (piece === 'goat') {
      // Play goat bleat with slight wood tap
      this.playGoatBleat(0, 0.32, undefined, 0.2);
    }

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * Sound when moving a piece (subtle wooden slide tap or goat bleat)
   */
  public playMove(piece?: 'tiger' | 'goat') {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    if (piece === 'goat') {
      this.playGoatBleat(Math.random() * 40 - 20, 0.28, undefined, 0.18);
    }

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.09);
  }

  /**
   * Authentic Goat "Myaa-a-a" Bleat Synthesizer
   * Creates characteristic vocal formant with 10-12Hz vibrato tremolo.
   */
  public playGoatBleat(
    pitchOffset: number = 0,
    duration: number = 0.35,
    startTime?: number,
    volume: number = 0.22
  ) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = startTime !== undefined ? startTime : this.ctx.currentTime;
    const baseFreq = Math.max(220, Math.min(650, 420 + pitchOffset));

    // Vocal carrier oscillator (sawtooth has rich odd & even harmonics for vocal simulation)
    const carrier = this.ctx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(baseFreq, t);
    // Slight downward inflection at the end of the bleat
    carrier.frequency.setValueAtTime(baseFreq, t + duration * 0.6);
    carrier.frequency.exponentialRampToValueAtTime(baseFreq * 0.88, t + duration);

    // Tremolo LFO for the signature vibrating goat bleat
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(11, t); // 11 Hz goat vibrato
    lfoGain.gain.setValueAtTime(18, t); // depth in Hz
    lfo.connect(carrier.frequency);

    // Bandpass formant filter to shape nasal goat vocal tract (/æ/ or /ja/)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(820 + pitchOffset * 0.8, t);
    filter.Q.setValueAtTime(3.5, t);

    // Amplitude envelope
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.04);
    gain.gain.setValueAtTime(volume * 0.9, t + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Audio routing
    carrier.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    carrier.start(t);
    carrier.stop(t + duration);
    lfo.start(t);
    lfo.stop(t + duration);
  }

  /**
   * Sound when tiger captures a goat:
   * Authentic Royal Bengal Tiger Roar + Sub-bass chest growl & ferocious attack
   */
  public playAttack() {
    this.playTigerRoar();
  }

  public playTigerRoar() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Initial heavy paw impact strike
    const strikeOsc = this.ctx.createOscillator();
    const strikeGain = this.ctx.createGain();
    strikeOsc.type = 'triangle';
    strikeOsc.frequency.setValueAtTime(220, t);
    strikeOsc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
    strikeGain.gain.setValueAtTime(0.4, t);
    strikeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    strikeOsc.connect(strikeGain);
    strikeGain.connect(this.ctx.destination);
    strikeOsc.start(t);
    strikeOsc.stop(t + 0.14);

    // 2. Deep chesty sub-bass tiger growl (sawtooth with 28Hz flutter)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(115, t);
    subOsc.frequency.linearRampToValueAtTime(80, t + 0.25);
    subOsc.frequency.exponentialRampToValueAtTime(36, t + 0.55);

    // Throat flutter LFO
    const flutterLfo = this.ctx.createOscillator();
    const flutterGain = this.ctx.createGain();
    flutterLfo.frequency.setValueAtTime(32, t);
    flutterGain.gain.setValueAtTime(22, t);
    flutterLfo.connect(subOsc.frequency);

    const subFilter = this.ctx.createBiquadFilter();
    subFilter.type = 'lowpass';
    subFilter.frequency.setValueAtTime(340, t);
    subFilter.frequency.exponentialRampToValueAtTime(120, t + 0.55);

    subGain.gain.setValueAtTime(0.001, t);
    subGain.gain.linearRampToValueAtTime(0.42, t + 0.08);
    subGain.gain.setValueAtTime(0.38, t + 0.3);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(this.ctx.destination);

    subOsc.start(t);
    subOsc.stop(t + 0.58);
    flutterLfo.start(t);
    flutterLfo.stop(t + 0.58);

    // 3. Ferocious resonant snarl / roar formant layer
    const roarOsc = this.ctx.createOscillator();
    const roarGain = this.ctx.createGain();
    const roarFilter = this.ctx.createBiquadFilter();

    roarOsc.type = 'sawtooth';
    roarOsc.frequency.setValueAtTime(260, t);
    roarOsc.frequency.linearRampToValueAtTime(180, t + 0.22);
    roarOsc.frequency.exponentialRampToValueAtTime(65, t + 0.5);

    roarFilter.type = 'bandpass';
    roarFilter.frequency.setValueAtTime(650, t);
    roarFilter.frequency.linearRampToValueAtTime(420, t + 0.35);
    roarFilter.Q.setValueAtTime(4.2, t);

    roarGain.gain.setValueAtTime(0.001, t);
    roarGain.gain.linearRampToValueAtTime(0.35, t + 0.06);
    roarGain.gain.exponentialRampToValueAtTime(0.001, t + 0.52);

    roarOsc.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(this.ctx.destination);

    roarOsc.start(t);
    roarOsc.stop(t + 0.52);

    // 4. White noise rasp breath
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(850, t);
      noiseFilter.Q.setValueAtTime(2.0, t);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.001, t);
      noiseGain.gain.linearRampToValueAtTime(0.2, t + 0.08);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      whiteNoise.start(t);
      whiteNoise.stop(t + 0.4);
    } catch (e) {
      // Noise buffer fallback
    }
  }

  /**
   * Sound when a tiger gets trapped
   */
  public playTrap() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, t); // D5
    osc.frequency.setValueAtTime(440, t + 0.1); // A4

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  /**
   * Special March Fanfare when Goats Win by trapping all tigers:
   * A march rhythm where all 20 goats bleat "myaa-a-a" together twice in triumphant chorus!
   */
  public playGoatMarchVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Helper for a punchy marching drum thump
    const playMarchBeat = (time: number) => {
      if (!this.ctx) return;
      const kick = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      kick.type = 'triangle';
      kick.frequency.setValueAtTime(120, time);
      kick.frequency.exponentialRampToValueAtTime(35, time + 0.18);
      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      kick.connect(gain);
      gain.connect(this.ctx.destination);
      kick.start(time);
      kick.stop(time + 0.2);
    };

    // Helper to spawn 20 goats bleating together
    const play20GoatsTogether = (waveStartTime: number) => {
      // 20 distinct frequency profiles from deep adult goats to young goats
      const goatPitches = [
        -90, -75, -60, -45, -30, -15, -5, 0, 10, 25,
        40, 55, 70, 85, 100, 115, 130, 150, 170, 190,
      ];

      goatPitches.forEach((pitch, i) => {
        // Micro-stagger between 0ms and 95ms so it feels like an authentic natural herd
        const microJitter = (i * 0.0045) + (Math.sin(i * 1.7) * 0.02);
        const goatStart = waveStartTime + Math.max(0, microJitter);
        const goatDuration = 0.38 + (i % 5) * 0.03;
        // Individual volume balanced so 20 voices don't clip
        this.playGoatBleat(pitch, goatDuration, goatStart, 0.07);
      });
    };

    // Wave 1: March step 1 + 20 Goats in unison
    playMarchBeat(t);
    play20GoatsTogether(t + 0.05);

    // Wave 2: March step 2 + 20 Goats in unison (the second "myaa")
    const wave2Time = t + 0.72;
    playMarchBeat(wave2Time);
    play20GoatsTogether(wave2Time + 0.05);

    // Followed by uplifting brassy victory fanfare chords
    const fanfareTime = t + 1.45;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25]; // C E G C E

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const noteStart = fanfareTime + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteStart);

      gain.gain.setValueAtTime(0.2, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(noteStart);
      osc.stop(noteStart + 0.45);
    });
  }

  /**
   * Triumphant Tiger Victory Roar + Flourish
   */
  public playTigerVictory() {
    this.playTigerRoar();
    setTimeout(() => {
      this.playVictory();
    }, 450);
  }

  /**
   * Uplifting harmonic victory sound
   */
  public playVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25]; // C E G C

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const start = t + idx * 0.12;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(start);
      osc.stop(start + 0.4);
    });
  }

  /**
   * Gentle defeat sound
   */
  public playDefeat() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [392.0, 349.23, 311.13, 261.63];

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const start = t + idx * 0.14;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(start);
      osc.stop(start + 0.35);
    });
  }

  /**
   * Sound when game starts or multiplayer match connects (bright upbeat chime)
   */
  public playGameStart() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const notes = [329.63, 440.0, 659.25]; // E4, A4, E5 chime

      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const start = t + idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch (e) {
      console.warn('playGameStart error:', e);
    }
  }
}

export const sound = new SoundEngine();
