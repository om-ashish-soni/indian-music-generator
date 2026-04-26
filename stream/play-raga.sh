#!/usr/bin/env bash
# play-raga — stream Indian classical music for a given raga / artist / mood
#
# Resolves a search query via yt-dlp and plays the top result with mpv (audio only).
# Designed for headless / terminal listening — no browser required.
#
# Usage:
#   play-raga                       # interactive raga picker
#   play-raga yaman                 # canonical raga (uses curated default artist)
#   play-raga "ravi shankar jog"    # free-form query
#   play-raga --list                # list curated ragas
#   play-raga --stop                # stop any playing mpv
#
# Requires: yt-dlp, mpv, ALSA (aplay). Install:
#   pipx install yt-dlp
#   sudo apt install mpv

set -euo pipefail

# --- curated raga -> artist+context map ---------------------------------------
declare -A RAGAS=(
  # morning / devotional
  [bhairav]="Pandit Jasraj raga bhairav morning vocal"
  [todi]="Pandit Bhimsen Joshi raga todi"
  [ahir-bhairav]="Hariprasad Chaurasia raga ahir bhairav bansuri"
  # late morning / afternoon
  [bhimpalasi]="Hariprasad Chaurasia raga bhimpalasi flute"
  [multani]="Pandit Bhimsen Joshi raga multani"
  [desh]="Ravi Shankar raga desh sitar"
  # evening / romantic
  [yaman]="Hariprasad Chaurasia raga yaman bansuri"
  [yaman-kalyan]="Ravi Shankar raga yaman kalyan sitar"
  [puriya-dhanashree]="Nikhil Banerjee raga puriya dhanashree sitar"
  [marwa]="Pandit Bhimsen Joshi raga marwa"
  # night / meditative
  [malkauns]="Hariprasad Chaurasia raga malkauns bansuri meditation"
  [darbari]="Ustad Amir Khan raga darbari kanada"
  [bageshree]="Nikhil Banerjee raga bageshree sitar"
  [bhairavi]="Hariprasad Chaurasia raga bhairavi bansuri"
  # joyful / pastoral
  [khamaj]="Ravi Shankar raga khamaj sitar"
  [pahadi]="Hariprasad Chaurasia raga pahadi flute"
  [kafi]="Ravi Shankar raga kafi"
  # collaborations / albums
  [call-of-the-valley]="Call of the Valley Hariprasad Chaurasia Shivkumar Sharma"
  [jugalbandi]="Ravi Shankar Hariprasad Chaurasia jugalbandi sitar bansuri"
)

list_ragas() {
  printf '%s\n' "Curated ragas (alphabetical):"
  for k in $(echo "${!RAGAS[@]}" | tr ' ' '\n' | sort); do
    printf '  %-22s -> %s\n' "$k" "${RAGAS[$k]}"
  done
}

stop_playback() {
  if pgrep -x mpv >/dev/null 2>&1; then
    pkill -x mpv || true
    # wait up to 3s for clean exit
    for _ in 1 2 3 4 5 6; do
      pgrep -x mpv >/dev/null 2>&1 || break
      sleep 0.5
    done
    pkill -9 -x mpv 2>/dev/null || true
    echo "Stopped."
  else
    echo "Nothing playing."
  fi
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: '$1' not found. Install it first." >&2
    exit 1
  }
}

play_query() {
  local query="$1"
  require yt-dlp
  require mpv

  echo "Searching: $query"
  local title url
  title=$(yt-dlp --get-title "ytsearch1:$query" 2>/dev/null | head -1)
  url=$(yt-dlp --get-url -f bestaudio "ytsearch1:$query" 2>/dev/null | head -1)

  if [[ -z "$url" ]]; then
    echo "error: no result found." >&2
    exit 1
  fi

  echo "Now playing: $title"
  echo "Stop with: $0 --stop  (or  pkill mpv)"

  # Stop any previous instance, then start fresh in background.
  pkill -x mpv 2>/dev/null || true
  # wait until all mpv processes are actually gone (avoid mixed playback)
  for _ in 1 2 3 4 5 6; do
    pgrep -x mpv >/dev/null 2>&1 || break
    sleep 0.5
  done
  pkill -9 -x mpv 2>/dev/null || true
  sleep 0.2

  nohup mpv --no-video --vo=null --ao=alsa --really-quiet "$url" \
    >/tmp/play-raga.log 2>&1 &
  disown
  echo "PID: $!"
}

interactive_pick() {
  echo "Pick a raga (or type a free-form query):"
  list_ragas
  echo
  read -rp "raga> " choice
  [[ -z "$choice" ]] && { echo "cancelled."; exit 0; }
  if [[ -n "${RAGAS[$choice]:-}" ]]; then
    play_query "${RAGAS[$choice]}"
  else
    play_query "$choice"
  fi
}

# --- main ---------------------------------------------------------------------
case "${1:-}" in
  ""|"-i"|"--interactive")
    interactive_pick ;;
  "--list"|"-l")
    list_ragas ;;
  "--stop"|"-s")
    stop_playback ;;
  "-h"|"--help")
    sed -n '2,12p' "$0" | sed 's/^# \?//' ;;
  *)
    key="${1,,}"  # lowercase
    if [[ -n "${RAGAS[$key]:-}" ]]; then
      play_query "${RAGAS[$key]}"
    else
      play_query "$*"
    fi ;;
esac
