#!/usr/bin/env python3
"""Raga Yaman — sitar + bansuri + harmonium + tanpura, synthesized live."""
import numpy as np
import sys
import subprocess

SR = 22050  # sample rate
DUR = 75.0  # seconds

# Raga Yaman frequencies (Sa = C4)
SA = 261.63
NOTES = {
    'Sa':  SA,
    'Re':  SA * 9/8,    # 294.33
    'Ga':  SA * 5/4,    # 327.03
    'Ma#': SA * 45/32,  # 367.91
    'Pa':  SA * 3/2,    # 392.44
    'Dha': SA * 5/3,    # 436.05
    'Ni':  SA * 15/8,   # 490.55
    "Sa'": SA * 2,      # 523.25
}
SEQ = list(NOTES.keys())

# Pakad phrases for Yaman
PAKAD = [
    ['Ga', 'Ma#', 'Re', 'Sa'],
    ['Re', 'Ga', 'Ma#', 'Pa'],
    ['Pa', 'Dha', 'Ni', "Sa'"],
    ['Ni', "Sa'", 'Dha', 'Pa', 'Ga', 'Ma#'],
    ['Ma#', 'Pa', 'Dha', 'Ni', "Sa'"],
    ['Ga', 'Re', 'Sa'],
    ['Sa', 'Re', 'Ga', 'Ma#', 'Pa', 'Dha', 'Ni', "Sa'"],
    ["Sa'", 'Ni', 'Dha', 'Pa', 'Ma#', 'Ga', 'Re', 'Sa'],
]

def env_pluck(n_samples, attack=0.005, decay_t=2.5):
    """Sharp attack, exp decay — sitar pluck."""
    t = np.arange(n_samples) / SR
    atk = np.minimum(t / attack, 1.0)
    dec = np.exp(-t / decay_t)
    return atk * dec

def env_flute(n_samples, attack=0.08, release=0.15):
    """Soft attack/release — bansuri."""
    t = np.arange(n_samples) / SR
    total = n_samples / SR
    e = np.ones(n_samples)
    atk_n = int(attack * SR)
    rel_n = int(release * SR)
    if atk_n > 0:
        e[:atk_n] = np.linspace(0, 1, atk_n)
    if rel_n > 0 and rel_n < n_samples:
        e[-rel_n:] = np.linspace(1, 0, rel_n)
    return e

def env_bellows(n_samples, attack=0.15, release=0.2):
    """Slow swell — harmonium."""
    return env_flute(n_samples, attack, release)

def sitar_note(freq, duration, prev_freq=None):
    n = int(duration * SR)
    t = np.arange(n) / SR

    # Meend (pitch glide from prev note)
    if prev_freq is not None:
        glide_n = min(int(0.08 * SR), n)
        f = np.ones(n) * freq
        f[:glide_n] = np.geomspace(prev_freq, freq, glide_n)
    else:
        f = np.ones(n) * freq

    # Gamak (subtle vibrato)
    gamak = 1.0 + 0.008 * np.sin(2 * np.pi * 4.5 * t)
    f = f * gamak

    phase = np.cumsum(2 * np.pi * f / SR)

    # Sawtooth + triangle + slight detuned pair → buzzy
    wave = (
        0.5 * (2 * (phase / (2*np.pi) - np.floor(0.5 + phase / (2*np.pi)))) +
        0.3 * (2 * np.abs(2 * (phase / (2*np.pi) - np.floor(0.5 + phase / (2*np.pi)))) - 1) +
        0.25 * (2 * ((phase * 1.005) / (2*np.pi) - np.floor(0.5 + (phase * 1.005) / (2*np.pi)))) +
        0.15 * np.sin(phase * 2)  # octave overtone
    )

    env = env_pluck(n, attack=0.005, decay_t=duration * 0.7)
    return wave * env * 0.35

def bansuri_note(freq, duration):
    n = int(duration * SR)
    t = np.arange(n) / SR

    # Vibrato
    vib = 1.0 + 0.012 * np.sin(2 * np.pi * 5.5 * t)
    phase = 2 * np.pi * freq * t * vib

    wave = (
        0.7 * np.sin(phase) +
        0.2 * np.sin(phase * 2) +
        0.08 * np.sin(phase * 3)
    )

    # Breath noise
    noise = (np.random.rand(n) - 0.5) * 0.08
    # Simple bandpass-ish: high-pass via diff
    noise = np.diff(np.concatenate([[0], noise]))

    env = env_flute(n, attack=0.08, release=0.15)
    return (wave + noise) * env * 0.28

def harmonium_chord(freqs, duration):
    n = int(duration * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for freq in freqs:
        # Multiple detuned oscillators for reed chorus
        for detune in [1.0, 1.005, 0.997]:
            phase = 2 * np.pi * freq * detune * t
            out += 0.25 * (2 * (phase / (2*np.pi) - np.floor(0.5 + phase / (2*np.pi))))
            out += 0.15 * np.sign(np.sin(phase))  # square-ish

    out = out / len(freqs)
    # Soft low-pass via simple smoothing
    out = np.convolve(out, np.ones(8)/8, mode='same')

    env = env_bellows(n)
    return out * env * 0.22

def tanpura_drone(duration):
    """Continuous Sa-Pa-Sa drone."""
    n = int(duration * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)

    drone_notes = [
        (SA * 0.5, 0.0),
        (SA * 0.75, 0.7),  # Pa lower
        (SA * 0.5, 1.4),
        (SA * 0.25, 2.1),
    ]
    pluck_period = 2.8  # seconds per cycle

    for freq, offset in drone_notes:
        # Sawtooth + slight detune
        for det in [1.0, 1.003]:
            phase = 2 * np.pi * freq * det * t
            wave = 2 * (phase / (2*np.pi) - np.floor(0.5 + phase / (2*np.pi)))
            # Pluck envelope repeating every pluck_period * 4
            cycle = pluck_period * 4
            phase_t = (t + offset) % cycle
            pluck_env = np.exp(-phase_t / 1.5) * 0.3 + 0.06
            out += wave * pluck_env * 0.5

    return out * 0.18

def make_music():
    print("Generating Raga Yaman...", file=sys.stderr)

    total_samples = int(DUR * SR)
    output = np.zeros(total_samples)

    # Tanpura — full duration
    print("  tanpura...", file=sys.stderr)
    output += tanpura_drone(DUR)

    # Tempo: starts slow (alap), speeds up
    bpm = 65
    beat_dur = 60.0 / bpm

    # Generate sitar line — main melodic voice
    print("  sitar...", file=sys.stderr)
    t_cursor = 1.0  # start after 1s
    prev_f = None
    phrase_idx = 0
    beat_count = 0
    while t_cursor < DUR - 3:
        phrase = PAKAD[phrase_idx % len(PAKAD)]
        for note in phrase:
            f = NOTES[note]
            # Variable note duration — long in alap, shorter later
            if t_cursor < 15:
                dur = beat_dur * 1.8
            elif t_cursor < 35:
                dur = beat_dur * 1.2
            else:
                dur = beat_dur * 0.9

            note_audio = sitar_note(f, dur + 0.5, prev_f)  # tail past next note
            n = len(note_audio)
            start = int(t_cursor * SR)
            end = min(start + n, total_samples)
            output[start:end] += note_audio[:end - start]

            prev_f = f
            t_cursor += dur
            beat_count += 1
            if t_cursor >= DUR - 3:
                break
        phrase_idx += 1

    # Bansuri — call & response, octave above sitar
    print("  bansuri...", file=sys.stderr)
    t_cursor = 8.0  # bansuri enters after sitar establishes
    phrase_idx = 2
    while t_cursor < DUR - 3:
        phrase = PAKAD[phrase_idx % len(PAKAD)]
        for note in phrase:
            f = NOTES[note] * 2  # octave up
            dur = beat_dur * 1.5
            note_audio = bansuri_note(f, dur + 0.3)
            n = len(note_audio)
            start = int(t_cursor * SR)
            end = min(start + n, total_samples)
            output[start:end] += note_audio[:end - start]
            t_cursor += dur
            if t_cursor >= DUR - 3:
                break
        # Pause between phrases
        t_cursor += beat_dur * 4
        phrase_idx += 1

    # Harmonium — sustained chords
    print("  harmonium...", file=sys.stderr)
    t_cursor = 4.0
    chords = [
        [NOTES['Sa']*0.5, NOTES['Ga']*0.5, NOTES['Pa']*0.5],
        [NOTES['Re']*0.5, NOTES['Ma#']*0.5, NOTES['Dha']*0.5],
        [NOTES['Sa']*0.5, NOTES['Ga']*0.5, NOTES['Pa']*0.5],
        [NOTES['Pa']*0.5, NOTES['Ni']*0.5, NOTES['Re']*0.5],
    ]
    chord_idx = 0
    while t_cursor < DUR - 4:
        chord = chords[chord_idx % len(chords)]
        dur = beat_dur * 4
        chord_audio = harmonium_chord(chord, dur)
        n = len(chord_audio)
        start = int(t_cursor * SR)
        end = min(start + n, total_samples)
        output[start:end] += chord_audio[:end - start]
        t_cursor += dur
        chord_idx += 1

    # Fade in/out
    fade_n = int(1.5 * SR)
    output[:fade_n] *= np.linspace(0, 1, fade_n)
    output[-fade_n:] *= np.linspace(1, 0, fade_n)

    # Normalize gently — preserve dynamics
    peak = np.max(np.abs(output))
    if peak > 0.95:
        output = output * (0.9 / peak)

    # Convert to int16
    pcm = (output * 32767).astype(np.int16)
    return pcm

if __name__ == '__main__':
    pcm = make_music()
    print(f"Generated {len(pcm)/SR:.1f}s of audio. Playing via aplay...", file=sys.stderr)
    proc = subprocess.Popen(
        ['aplay', '-q', '-f', 'S16_LE', '-r', str(SR), '-c', '1'],
        stdin=subprocess.PIPE,
    )
    proc.stdin.write(pcm.tobytes())
    proc.stdin.close()
    proc.wait()
    print("Done.", file=sys.stderr)
