# Indian Music Generator

> A Claude Code skill for Indian classical music — generate browser-based raga
> synthesizers as React artifacts, **and** stream real recordings of Hindustani
> masters from the terminal.

This started as a synthesis-only skill: ask Claude for a raga, get a self-contained
React `.jsx` artifact that synthesizes sitar, bansuri, harmonium, and tanpura
using the Web Audio API. That works, and is fun for visualization and
exploration — but synthesized oscillators don't really sound like Pandit Ravi
Shankar. So the repo also ships a small streaming layer (`yt-dlp` + `mpv`) that
plays actual recordings of the masters straight from the terminal.

Two complementary modes:

| Mode      | What it does                                                | Use when                                  |
| --------- | ----------------------------------------------------------- | ----------------------------------------- |
| **Synth** | Generates a React artifact — browser-based, interactive UI, controls, mandala visualization | You want to *play with* a raga, learn structure, see notes |
| **Stream**| Resolves a search query and plays the top YouTube result via `mpv` | You actually want to *listen* — meditation, study, focus |

---

## Quick start

### As a Claude Code skill

Drop [`SKILL.md`](./SKILL.md) into `~/.claude/skills/indian-music-generator/`
and ask Claude things like:

```
play a peaceful evening raga
generate a meditative malkauns with sitar and tanpura
create a morning bhairav with harmonium drone
```

Claude will produce a self-contained `.jsx` artifact (see
[`examples/raga-yaman-player.jsx`](./examples/raga-yaman-player.jsx) for what
that looks like).

### Stream real music from the terminal

```bash
# one-time setup
pipx install yt-dlp
sudo apt install mpv          # or your platform's equivalent

# play
./stream/play-raga.sh yaman
./stream/play-raga.sh malkauns
./stream/play-raga.sh "ravi shankar raga jog"
./stream/play-raga.sh --list   # see all curated ragas
./stream/play-raga.sh --stop   # stop playback
```

The streamer maps short raga names to curated artist+raga searches (Hariprasad
Chaurasia for bansuri ragas, Ravi Shankar / Nikhil Banerjee for sitar, Bhimsen
Joshi for vocal-driven study, etc.) and falls back to free-form queries for
anything else. See [`stream/RAGAS.md`](./stream/RAGAS.md) for the full
reference and listening guide.

### Browser synth example

Open [`examples/raga-yaman-player.jsx`](./examples/raga-yaman-player.jsx) — it's
a single-file React component using the Web Audio API. Drop into any React
project (Vite, CRA, Next.js) with Tailwind CSS, render `<RagaYamanPlayer />`,
and click Play. Includes:

- Karplus-Strong-flavored sitar synthesis with **meend** (pitch glide) and **gamak** (note oscillation)
- Bansuri with vibrato and breath noise
- Detuned-oscillator harmonium chorus
- Continuous tanpura drone (Sa + Pa + Sa octave)
- Live mandala visualization driven by FFT energy
- Per-instrument volume + tempo controls

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                  User prompt to Claude                            │
│        "play a calm evening raga with sitar and flute"            │
└──────────────────┬───────────────────────────────────────────────┘
                   │
                   ▼
            ┌──────────────┐
            │   SKILL.md   │  ← Claude maps mood → raga → instruments
            └──────┬───────┘
                   │
        ┌──────────┴──────────────────────┐
        ▼                                 ▼
  ┌──────────────┐                ┌──────────────────┐
  │   SYNTH      │                │    STREAM        │
  │ (browser)    │                │   (terminal)     │
  ├──────────────┤                ├──────────────────┤
  │ React + Web  │                │ yt-dlp searches  │
  │ Audio API    │                │ ──> stream URL   │
  │              │                │                  │
  │ Sitar / flute│                │ mpv decodes via  │
  │ harmonium /  │                │ ffmpeg ──> ALSA  │
  │ tanpura osc. │                │                  │
  │              │                │ Real recordings  │
  │ Mandala viz  │                │ of Hindustani    │
  │              │                │ masters          │
  └──────┬───────┘                └────────┬─────────┘
         │                                 │
         ▼                                 ▼
   browser audio                      system speakers
```

The two modes don't interact — synth runs in a browser tab, stream runs as a
background `mpv` process talking to ALSA. You can run both simultaneously for a
synth-vs-master comparison.

---

## Why both?

I wanted to learn what makes a raga *sound* like itself — vadi, samvadi, pakad,
meend, the time-of-day association. The synth path forces you to encode all of
that in code: which notes are allowed, how they bend into each other, where the
drone sits. Building the synth is a way to internalize the theory.

But for actual spiritual listening — meditation, focus work, evening unwinding —
you want a real bansuri recorded by Hariprasad Chaurasia, not a sawtooth wave.
So the streaming path exists for that. Both serve the goal: deeper engagement
with this music.

---

## Repo layout

```
indian-music-generator/
├── SKILL.md                          # Claude Code skill definition
├── README.md                         # This file
├── examples/
│   └── raga-yaman-player.jsx         # Reference React synthesizer artifact
├── stream/
│   ├── play-raga.sh                  # Terminal launcher (yt-dlp + mpv)
│   └── RAGAS.md                      # Time/mood/master reference guide
└── synth/
    └── yaman_aplay.py                # Pure-Python ALSA synth (numpy, no browser)
```

---

## Honest limitations

- **Synthesized timbre is not authentic.** Sawtooth + triangle oscillators give
  you "buzzy" but not "sitar." Real sitar timbre comes from the curved jawari
  bridge, sympathetic strings, and string-coupling effects that web-synth
  approximations can't capture. The synth is a teaching tool, not a recital.
- **Streaming depends on YouTube availability** — quality varies, links rot,
  geo-restrictions exist.
- **Microtonal subtleties** (shruti — 22 microtones beyond 12-EDO) are
  approximated with just-intonation ratios in the synth. Real Hindustani
  practice is more nuanced.

---

## Roadmap (ideas, not promises)

- [ ] More reference artifacts: Bhairav (morning), Malkauns (night), Bhimpalasi
- [ ] Karplus-Strong physical-modeling sitar in browser (closer to authentic)
- [ ] Tabla synthesis with proper tala cycles (theka patterns for Teentaal, Jhaptaal, Rupak)
- [ ] Local audio archive option — point the streamer at downloaded files instead of YouTube
- [ ] Spotify/local fallback in `play-raga.sh`

---

## Credits

- Built as a Claude Code skill — see [Anthropic Claude Code](https://claude.com/claude-code).
- Inspired by listening to the giants: Pandit Ravi Shankar, Pandit Hariprasad
  Chaurasia, Pandit Nikhil Banerjee, Pandit Shivkumar Sharma, Ustad Vilayat
  Khan, Pandit Bhimsen Joshi.

## License

MIT. See [LICENSE](./LICENSE).
