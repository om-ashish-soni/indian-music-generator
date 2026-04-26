import React, { useState, useEffect, useRef, useCallback } from 'react';

// Raga Yaman — Evening raga, romantic, peaceful
// Notes: Sa Re Ga Ma# Pa Dha Ni Sa' (Lydian-like with sharp Ma)
// Vadi: Ga, Samvadi: Ni
// Time: Early evening (6-9 PM)
// Taala: Teentaal (16 beats)

const RAGA_YAMAN = {
  name: 'Yaman',
  notes: ['Sa', 'Re', 'Ga', 'Ma#', 'Pa', 'Dha', 'Ni', "Sa'"],
  // Frequencies based on Sa = C4 (261.63 Hz), just intonation
  frequencies: [261.63, 294.33, 327.03, 367.91, 392.44, 441.50, 490.55, 523.25],
  vadi: 2,    // Ga
  samvadi: 6, // Ni
  aroha:  [0, 1, 2, 3, 4, 5, 6, 7], // ascending
  avaroha:[7, 6, 5, 4, 3, 2, 1, 0], // descending
  // Common phrases (pakad) for Yaman
  pakad: [
    [2, 3, 1, 0],         // Ga Ma# Re Sa
    [1, 2, 3, 4],         // Re Ga Ma# Pa
    [4, 5, 6, 7],         // Pa Dha Ni Sa'
    [6, 7, 5, 4, 2, 3],   // Ni Sa' Dha Pa Ga Ma#
    [3, 4, 5, 6, 7],      // Ma# Pa Dha Ni Sa'
    [2, 1, 0],            // Ga Re Sa
  ],
};

export default function RagaYamanPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(80); // BPM
  const [sitarVol, setSitarVol] = useState(0.6);
  const [fluteVol, setFluteVol] = useState(0.5);
  const [harmoniumVol, setHarmoniumVol] = useState(0.3);
  const [tanpuraVol, setTanpuraVol] = useState(0.25);
  const [currentNote, setCurrentNote] = useState('');
  const [phase, setPhase] = useState('Alap'); // Alap, Jor, Gat
  const [waveData, setWaveData] = useState(new Array(64).fill(0));

  const ctxRef = useRef(null);
  const masterRef = useRef(null);
  const sitarGainRef = useRef(null);
  const fluteGainRef = useRef(null);
  const harmoniumGainRef = useRef(null);
  const tanpuraGainRef = useRef(null);
  const analyserRef = useRef(null);
  const tanpuraNodesRef = useRef([]);
  const schedulerRef = useRef(null);
  const beatRef = useRef(0);
  const animFrameRef = useRef(null);

  const initAudio = () => {
    if (ctxRef.current) return ctxRef.current;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0.7;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    master.connect(analyser);
    analyser.connect(ctx.destination);

    const sitarGain = ctx.createGain();
    const fluteGain = ctx.createGain();
    const harmoniumGain = ctx.createGain();
    const tanpuraGain = ctx.createGain();

    // Reverb-ish — simple convolver with synthetic impulse
    const convolver = ctx.createConvolver();
    const impulseLen = ctx.sampleRate * 2.5;
    const impulse = ctx.createBuffer(2, impulseLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < impulseLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLen, 2.5);
      }
    }
    convolver.buffer = impulse;

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.18;
    const dryGain = ctx.createGain();
    dryGain.gain.value = 1.0;

    [sitarGain, fluteGain, harmoniumGain, tanpuraGain].forEach((g) => {
      g.connect(dryGain);
      g.connect(convolver);
    });
    convolver.connect(wetGain);
    dryGain.connect(master);
    wetGain.connect(master);

    ctxRef.current = ctx;
    masterRef.current = master;
    sitarGainRef.current = sitarGain;
    fluteGainRef.current = fluteGain;
    harmoniumGainRef.current = harmoniumGain;
    tanpuraGainRef.current = tanpuraGain;
    analyserRef.current = analyser;

    sitarGain.gain.value = sitarVol;
    fluteGain.gain.value = fluteVol;
    harmoniumGain.gain.value = harmoniumVol;
    tanpuraGain.gain.value = tanpuraVol;

    return ctx;
  };

  // ============ TANPURA (continuous drone) ============
  const startTanpura = () => {
    const ctx = ctxRef.current;
    const out = tanpuraGainRef.current;
    if (!ctx || !out) return;

    const tanpuraFreqs = [
      RAGA_YAMAN.frequencies[0] * 0.5, // Sa lower
      RAGA_YAMAN.frequencies[4] * 0.5, // Pa lower
      RAGA_YAMAN.frequencies[0] * 0.5,
      RAGA_YAMAN.frequencies[0] * 0.25, // Sa very low
    ];

    const nodes = [];
    tanpuraFreqs.forEach((freq, idx) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.value = freq;
      osc2.frequency.value = freq * 1.003;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1200;
      lp.Q.value = 2;

      const env = ctx.createGain();
      env.gain.value = 0;

      // Slow rolling LFO for the tanpura plucks
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.4 + idx * 0.05;
      lfoGain.gain.value = 0.06;
      lfo.connect(lfoGain);
      lfoGain.connect(env.gain);

      // base level
      env.gain.value = 0.06;

      osc1.connect(lp);
      osc2.connect(lp);
      lp.connect(env);
      env.connect(out);

      const t = ctx.currentTime + idx * 0.7;
      osc1.start(t);
      osc2.start(t);
      lfo.start(t);

      nodes.push({ osc1, osc2, lfo, env });
    });

    tanpuraNodesRef.current = nodes;
  };

  const stopTanpura = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime;
    tanpuraNodesRef.current.forEach(({ osc1, osc2, lfo, env }) => {
      try {
        env.gain.cancelScheduledValues(t);
        env.gain.setValueAtTime(env.gain.value, t);
        env.gain.linearRampToValueAtTime(0, t + 0.5);
        osc1.stop(t + 0.6);
        osc2.stop(t + 0.6);
        lfo.stop(t + 0.6);
      } catch (e) {}
    });
    tanpuraNodesRef.current = [];
  };

  // ============ SITAR (plucked, buzzy, with meend) ============
  const playSitar = (freq, startTime, duration, prevFreq = null) => {
    const ctx = ctxRef.current;
    const out = sitarGainRef.current;
    if (!ctx) return;

    // Main pluck — sawtooth + triangle with detune
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc3.type = 'sawtooth';

    if (prevFreq) {
      // Meend: glide from previous note
      osc1.frequency.setValueAtTime(prevFreq, startTime);
      osc1.frequency.exponentialRampToValueAtTime(freq, startTime + 0.08);
      osc2.frequency.setValueAtTime(prevFreq, startTime);
      osc2.frequency.exponentialRampToValueAtTime(freq, startTime + 0.08);
      osc3.frequency.setValueAtTime(prevFreq * 2, startTime);
      osc3.frequency.exponentialRampToValueAtTime(freq * 2, startTime + 0.08);
    } else {
      osc1.frequency.value = freq;
      osc2.frequency.value = freq;
      osc3.frequency.value = freq * 2; // octave up — sympathetic
    }
    osc1.detune.value = -8;
    osc2.detune.value = 8;
    osc3.detune.value = -3;

    // Gamak — subtle vibrato around the note
    const gamakLfo = ctx.createOscillator();
    const gamakGain = ctx.createGain();
    gamakLfo.frequency.value = 4.5;
    gamakGain.gain.value = freq * 0.008;
    gamakLfo.connect(gamakGain);
    gamakGain.connect(osc1.frequency);
    gamakGain.connect(osc2.frequency);

    // Bandpass to enhance midrange buzz
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq * 2.5;
    bp.Q.value = 3;

    // Pluck envelope — sharp attack, long decay
    const env = ctx.createGain();
    env.gain.value = 0;
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(0.55, startTime + 0.005); // sharp attack
    env.gain.exponentialRampToValueAtTime(0.25, startTime + 0.15);
    env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc1.connect(bp);
    osc2.connect(bp);
    osc3.connect(env);
    bp.connect(env);
    env.connect(out);

    osc1.start(startTime);
    osc2.start(startTime);
    osc3.start(startTime);
    gamakLfo.start(startTime);

    osc1.stop(startTime + duration + 0.05);
    osc2.stop(startTime + duration + 0.05);
    osc3.stop(startTime + duration + 0.05);
    gamakLfo.stop(startTime + duration + 0.05);
  };

  // ============ BANSURI (flute — breathy, vibrato) ============
  const playBansuri = (freq, startTime, duration) => {
    const ctx = ctxRef.current;
    const out = fluteGainRef.current;
    if (!ctx) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 2.001;

    // Vibrato
    const vibLfo = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vibLfo.frequency.value = 5.5;
    vibGain.gain.value = freq * 0.012;
    vibLfo.connect(vibGain);
    vibGain.connect(osc1.frequency);

    // Breath noise
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = freq * 2;
    noiseFilter.Q.value = 4;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.04;

    const env = ctx.createGain();
    env.gain.value = 0;
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(0.4, startTime + 0.08); // soft attack
    env.gain.linearRampToValueAtTime(0.35, startTime + duration * 0.6);
    env.gain.linearRampToValueAtTime(0.0, startTime + duration);

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.15;

    osc1.connect(env);
    osc2.connect(osc2Gain);
    osc2Gain.connect(env);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(env);
    env.connect(out);

    osc1.start(startTime);
    osc2.start(startTime);
    vibLfo.start(startTime);
    noise.start(startTime);

    const stopT = startTime + duration + 0.1;
    osc1.stop(stopT);
    osc2.stop(stopT);
    vibLfo.stop(stopT);
    noise.stop(stopT);
  };

  // ============ HARMONIUM (reedy, sustained) ============
  const playHarmonium = (freqs, startTime, duration) => {
    const ctx = ctxRef.current;
    const out = harmoniumGainRef.current;
    if (!ctx) return;

    freqs.forEach((freq, i) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc3.type = 'sawtooth';
      osc1.frequency.value = freq;
      osc2.frequency.value = freq * 1.005;
      osc3.frequency.value = freq * 2;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      lp.Q.value = 1.2;

      const env = ctx.createGain();
      env.gain.value = 0;
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(0.18 / freqs.length, startTime + 0.15); // bellows attack
      env.gain.linearRampToValueAtTime(0.16 / freqs.length, startTime + duration * 0.7);
      env.gain.linearRampToValueAtTime(0, startTime + duration);

      const oct3Gain = ctx.createGain();
      oct3Gain.gain.value = 0.1;

      osc1.connect(lp);
      osc2.connect(lp);
      osc3.connect(oct3Gain);
      oct3Gain.connect(lp);
      lp.connect(env);
      env.connect(out);

      osc1.start(startTime);
      osc2.start(startTime);
      osc3.start(startTime);

      const stopT = startTime + duration + 0.1;
      osc1.stop(stopT);
      osc2.stop(stopT);
      osc3.stop(stopT);
    });
  };

  // ============ COMPOSITION ENGINE ============
  // Generates a flowing alap/gat sequence
  const generatePhrase = (beat) => {
    const phraseIdx = Math.floor(beat / 8) % RAGA_YAMAN.pakad.length;
    return RAGA_YAMAN.pakad[phraseIdx];
  };

  const startScheduler = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    let lookAhead = ctx.currentTime + 0.1;
    let prevSitarFreq = null;
    let beatCounter = 0;

    const tick = () => {
      const now = ctx.currentTime;
      const beatDur = 60 / tempo;

      // Schedule ~1 second ahead
      while (lookAhead < now + 1.0) {
        const phrase = generatePhrase(beatCounter);
        const noteIdx = phrase[beatCounter % phrase.length];
        const freq = RAGA_YAMAN.frequencies[noteIdx];

        // Sitar — plays every beat with meend
        playSitar(freq, lookAhead, beatDur * 1.6, prevSitarFreq);
        prevSitarFreq = freq;

        // Bansuri — plays on beats 1, 3, 5 of each 8-beat phrase (call & response)
        if (beatCounter % 8 === 2 || beatCounter % 8 === 5) {
          const fluteIdx = phrase[(beatCounter + 1) % phrase.length];
          const fluteFreq = RAGA_YAMAN.frequencies[fluteIdx] * 2; // octave up
          playBansuri(fluteFreq, lookAhead + beatDur * 0.3, beatDur * 1.4);
        }

        // Harmonium — sustained chord every 4 beats (Sa-Ga-Pa or Re-Ma#-Dha)
        if (beatCounter % 4 === 0) {
          const useChord1 = (beatCounter / 4) % 2 === 0;
          const chord = useChord1
            ? [RAGA_YAMAN.frequencies[0] * 0.5, RAGA_YAMAN.frequencies[2] * 0.5, RAGA_YAMAN.frequencies[4] * 0.5]
            : [RAGA_YAMAN.frequencies[1] * 0.5, RAGA_YAMAN.frequencies[3] * 0.5, RAGA_YAMAN.frequencies[5] * 0.5];
          playHarmonium(chord, lookAhead, beatDur * 4);
        }

        // UI update — schedule the note display
        const noteName = RAGA_YAMAN.notes[noteIdx];
        const updateAt = lookAhead;
        const updateBeat = beatCounter;
        setTimeout(() => {
          setCurrentNote(noteName);
          beatRef.current = updateBeat;
          if (updateBeat < 32) setPhase('Alap');
          else if (updateBeat < 64) setPhase('Jor');
          else setPhase('Gat');
        }, Math.max(0, (updateAt - now) * 1000));

        lookAhead += beatDur;
        beatCounter++;
      }

      schedulerRef.current = setTimeout(tick, 50);
    };

    tick();
  };

  const stopScheduler = () => {
    if (schedulerRef.current) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
  };

  // Visualization loop
  useEffect(() => {
    if (!isPlaying) return;
    const draw = () => {
      const analyser = analyserRef.current;
      if (analyser) {
        const arr = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(arr);
        setWaveData(Array.from(arr));
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying]);

  const handlePlayPause = async () => {
    if (!isPlaying) {
      const ctx = initAudio();
      if (ctx.state === 'suspended') await ctx.resume();
      startTanpura();
      startScheduler();
      setIsPlaying(true);
    } else {
      stopScheduler();
      stopTanpura();
      setIsPlaying(false);
      setCurrentNote('');
    }
  };

  // Update gains live
  useEffect(() => { if (sitarGainRef.current) sitarGainRef.current.gain.value = sitarVol; }, [sitarVol]);
  useEffect(() => { if (fluteGainRef.current) fluteGainRef.current.gain.value = fluteVol; }, [fluteVol]);
  useEffect(() => { if (harmoniumGainRef.current) harmoniumGainRef.current.gain.value = harmoniumVol; }, [harmoniumVol]);
  useEffect(() => { if (tanpuraGainRef.current) tanpuraGainRef.current.gain.value = tanpuraVol; }, [tanpuraVol]);

  useEffect(() => {
    return () => {
      stopScheduler();
      stopTanpura();
      if (ctxRef.current) ctxRef.current.close();
    };
  }, []);

  // ============ MANDALA VISUALIZATION ============
  const Mandala = () => {
    const layers = 6;
    const petalsPerLayer = 12;
    const energy = waveData.reduce((a, b) => a + b, 0) / (waveData.length * 255);

    return (
      <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
        {Array.from({ length: layers }).map((_, layerIdx) => {
          const layerEnergy = waveData.slice(layerIdx * 8, (layerIdx + 1) * 8)
            .reduce((a, b) => a + b, 0) / (8 * 255);
          const radius = 30 + layerIdx * 18;
          const rotation = isPlaying ? (Date.now() / (1000 - layerIdx * 100)) % 360 : 0;
          return (
            <div
              key={layerIdx}
              className="absolute"
              style={{
                width: radius * 2,
                height: radius * 2,
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.05s linear',
              }}
            >
              {Array.from({ length: petalsPerLayer }).map((_, i) => {
                const angle = (i / petalsPerLayer) * 360;
                const scale = 0.7 + layerEnergy * 1.5;
                const opacity = 0.3 + layerEnergy * 0.7;
                return (
                  <div
                    key={i}
                    className="absolute top-1/2 left-1/2"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px) scale(${scale})`,
                      width: 8,
                      height: 16,
                      background: `linear-gradient(180deg, hsl(${(layerIdx * 60 + 30) % 360}, 80%, ${50 + layerEnergy * 20}%), hsl(${(layerIdx * 60 + 60) % 360}, 70%, 40%))`,
                      borderRadius: '50% 50% 0 0',
                      opacity,
                      boxShadow: `0 0 ${8 + layerEnergy * 12}px hsl(${(layerIdx * 60 + 30) % 360}, 80%, 60%)`,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
        {/* Center bindu */}
        <div
          className="absolute rounded-full"
          style={{
            width: 20 + energy * 30,
            height: 20 + energy * 30,
            background: 'radial-gradient(circle, #fff8dc, #ffb347, #cd5c00)',
            boxShadow: `0 0 ${20 + energy * 40}px rgba(255, 200, 100, 0.8)`,
          }}
        />
      </div>
    );
  };

  return (
    <div
      className="min-h-screen w-full p-6 flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at top, #2d0a3e 0%, #1a0729 40%, #0a0314 100%)',
        fontFamily: '"Georgia", serif',
      }}
    >
      <div
        className="max-w-2xl w-full p-8 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(74, 20, 100, 0.4), rgba(30, 10, 50, 0.6))',
          border: '2px solid rgba(255, 180, 80, 0.3)',
          boxShadow: '0 0 60px rgba(255, 140, 50, 0.15), inset 0 0 40px rgba(255, 180, 80, 0.05)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Decorative top border */}
        <div className="flex justify-center mb-2">
          <div className="text-amber-300 text-2xl tracking-widest opacity-60">
            ❀ ⋅ ❁ ⋅ ❀ ⋅ ❁ ⋅ ❀
          </div>
        </div>

        <h1
          className="text-center text-4xl mb-1 font-bold tracking-wide"
          style={{
            background: 'linear-gradient(90deg, #ffd700, #ff8c00, #ffd700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 30px rgba(255, 180, 80, 0.4)',
          }}
        >
          Raga Yaman
        </h1>
        <p className="text-center text-amber-200 text-sm italic mb-6 opacity-80">
          Evening · Romantic · Peaceful · Teentaal (16 beats)
        </p>

        {/* Mandala visualization */}
        <Mandala />

        {/* Current note display */}
        <div className="my-6 text-center">
          <div className="text-amber-100 text-xs uppercase tracking-widest opacity-60 mb-1">
            {phase} · Currently playing
          </div>
          <div
            className="text-5xl font-bold tracking-wider"
            style={{
              color: '#ffd700',
              textShadow: '0 0 20px rgba(255, 215, 0, 0.6)',
              minHeight: '1.2em',
            }}
          >
            {currentNote || '—'}
          </div>
          <div className="text-amber-300 text-xs mt-2 opacity-70">
            Sa Re Ga Ma# Pa Dha Ni Sa'
          </div>
        </div>

        {/* Play button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={handlePlayPause}
            className="px-8 py-3 rounded-full text-lg font-semibold transition-all duration-200 transform hover:scale-105"
            style={{
              background: isPlaying
                ? 'linear-gradient(135deg, #cd5c00, #8b3a00)'
                : 'linear-gradient(135deg, #ffb347, #ff8c00)',
              color: '#1a0729',
              border: '2px solid rgba(255, 215, 0, 0.6)',
              boxShadow: '0 4px 20px rgba(255, 140, 50, 0.4)',
            }}
          >
            {isPlaying ? '⏸  Pause' : '▶  Play'}
          </button>
        </div>

        {/* Sliders */}
        <div className="space-y-3 text-amber-100">
          <SliderRow label="Tempo (BPM)" value={tempo} min={40} max={140} step={1}
            onChange={setTempo} format={(v) => `${v} BPM`} />
          <SliderRow label="Sitar" value={sitarVol} min={0} max={1} step={0.01}
            onChange={setSitarVol} format={(v) => `${Math.round(v * 100)}%`} />
          <SliderRow label="Bansuri (Flute)" value={fluteVol} min={0} max={1} step={0.01}
            onChange={setFluteVol} format={(v) => `${Math.round(v * 100)}%`} />
          <SliderRow label="Harmonium" value={harmoniumVol} min={0} max={1} step={0.01}
            onChange={setHarmoniumVol} format={(v) => `${Math.round(v * 100)}%`} />
          <SliderRow label="Tanpura Drone" value={tanpuraVol} min={0} max={1} step={0.01}
            onChange={setTanpuraVol} format={(v) => `${Math.round(v * 100)}%`} />
        </div>

        {/* Decorative bottom border */}
        <div className="flex justify-center mt-6">
          <div className="text-amber-300 text-2xl tracking-widest opacity-60">
            ❀ ⋅ ❁ ⋅ ❀ ⋅ ❁ ⋅ ❀
          </div>
        </div>

        <p className="text-center text-amber-200/60 text-xs mt-4 italic">
          Vadi: Ga · Samvadi: Ni · Time: Sandhi prakash (twilight)
        </p>
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, format }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-32 text-sm">{label}</div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-amber-500"
        style={{ accentColor: '#ffb347' }}
      />
      <div className="w-16 text-right text-amber-300 text-sm">{format(value)}</div>
    </div>
  );
}
