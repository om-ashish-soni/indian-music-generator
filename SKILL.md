---
name: indian-music-generator
description: Generate creative Indian classical music featuring sitar, flute (bansuri), and harmonium based on a user's text prompt. Use this skill whenever the user asks to play, generate, compose, or create Indian music, raga-based music, sitar music, bansuri/flute music, harmonium music, or any fusion involving these instruments. Also trigger when users mention ragas, taalas, Indian scales, Hindustani or Carnatic music generation, meditation music with Indian instruments, or want an interactive music player with Indian classical instruments. Keywords: sitar, flute, bansuri, harmonium, raga, taala, Indian music, classical Indian, drone, tanpura, meend, gamak, alap, jor, jhala, gat.
---

# Indian Music Generator

This skill creates a React artifact that synthesizes **sitar**, **bansuri (flute)**, and **harmonium** audio in real-time using the Web Audio API based on a user's descriptive prompt.

## How It Works

1. The user provides a mood, raga, or descriptive prompt (e.g., "play a peaceful evening raga", "energetic morning sitar with flute", "meditative harmonium drone")
2. Claude interprets the prompt to select:
   - **Raga** (scale/mode) — e.g., Yaman, Bhairav, Malkauns, Darbari, Bhimpalasi
   - **Taala** (rhythm cycle) — e.g., Teentaal (16 beats), Jhaptaal (10), Rupak (7)
   - **Tempo** — slow (vilambit), medium (madhya), fast (drut)
   - **Mood/Time** — morning, afternoon, evening, night, meditative, joyful, melancholic
   - **Instrument mix** — which instruments are prominent vs. supportive
3. Claude generates a self-contained React `.jsx` artifact with all synthesis inline

## Instrument Synthesis Guidelines

### Sitar
- Use **sawtooth + triangle oscillators** with heavy detuning for the buzzing jawari tone
- Apply **pitch bends** (meend) between notes using `exponentialRampToValueAtTime`
- Add sympathetic string resonance via quiet background drones on Sa and Pa
- Use **amplitude modulation** for the characteristic pluck decay
- Implement **gamak** (oscillation around a note) with subtle LFO on frequency

### Bansuri (Flute)
- Use **sine + triangle oscillators** blended for warmth
- Apply **vibrato** via LFO on frequency (5-7 Hz, subtle depth)
- Use **breathy noise** layer: filtered white noise mixed at low volume
- Smooth **legato transitions** between notes with gentle glides
- Add slight **delay/reverb** for spaciousness

### Harmonium
- Use **square + sawtooth oscillators** with slight detuning for reed-like quality
- Layer **3-4 oscillators** at slightly different tunings for the chorus/beating effect
- Apply **low-pass filter** with moderate resonance for warmth
- Implement **bellows simulation** with slow amplitude envelope
- Play **sustained chords** following the raga's vadi/samvadi

### Tanpura Drone (Background)
- Always include a subtle tanpura drone on **Sa** and **Pa** (and sometimes Ma or Ni)
- Use **sawtooth oscillators** at very low volume with rich harmonics
- Apply slow amplitude modulation for the rolling tanpura effect

## Raga Reference

Map user moods/times to ragas:
- **Morning/Devotional**: Bhairav, Todi, Ahir Bhairav
- **Late Morning**: Asavari, Desh
- **Afternoon**: Bhimpalasi, Multani
- **Evening/Romantic**: Yaman, Puriya Dhanashree, Marwa
- **Night/Peaceful**: Malkauns, Darbari Kanada, Bageshree
- **Joyful/Celebratory**: Khamaj, Kafi, Pahadi
- **Melancholic/Longing**: Darbari, Todi, Marwa
- **Meditative**: Malkauns, Bhairavi, Ahir Bhairav

## UI Requirements

- Dark, rich background (deep indigo, burgundy, or saffron-black gradient) evoking Indian classical aesthetics
- Decorative elements inspired by Mughal/Rajasthani patterns (CSS-only)
- Display: current raga name, taala, tempo, active instruments
- Controls: Play/Pause, tempo slider, instrument volume sliders
- Visual feedback: animated waveform or mandala-style visualization that responds to the music
- Show the note sequence being played in real-time with Indian notation (Sa Re Ga Ma Pa Dha Ni)

## Output

A single `.jsx` file saved to `/mnt/user-data/outputs/` that is fully self-contained with all audio synthesis, UI, and visualization inline. No external audio files needed.
