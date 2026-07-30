# Joplin Dictate

Record your voice, transcribe it **locally** with [whisper.cpp](https://github.com/ggerganov/whisper.cpp), and turn it into a Joplin note or to-do. Transcription runs entirely on your machine — no audio leaves your computer. An optional step can polish the transcript with a local, OpenAI-compatible LLM.

## Features

- One-click dictation from a dedicated Joplin panel (and the note toolbar / Tools menu).
- **Pause / Resume** and **Cancel** while recording.
- Transcribe an existing **WAV file** instead of recording.
- Local transcription via `whisper.cpp` (`whisper-cli`).
- Optional transcript **polishing** (grammar/punctuation/filler removal) via any OpenAI-compatible chat endpoint.
- Creates the note in the currently selected notebook, or a configurable fallback notebook.

## Requirements

> **Platform note:** recording uses `pw-record` from **PipeWire**, so this plugin currently targets **Linux**. File transcription works anywhere `whisper-cli` runs.

- **PipeWire** (`pw-record`) for audio capture — on Fedora: `sudo dnf install pipewire-utils`.
- **whisper.cpp**, built locally, with a ggml model (e.g. `ggml-small.en.bin`).
- Joplin **3.6** or newer.
- (Optional) A local OpenAI-compatible LLM server for transcript polishing.

## Installation

### From the Joplin plugin store (recommended)
Tools → Options → Plugins, search for **Dictate**, install, and restart Joplin.

### Manual
Download the `.jpl` from the [releases](https://github.com/NormG/joplin-dictate-plugin/releases) and install it via Tools → Options → Plugins → Install from file.

## Configuration

Tools → Options → **Dictate**:

- **Whisper.cpp directory** — root of your whisper.cpp checkout (default: `~/whisper.cpp`).
- **Whisper model file** — path to the ggml model (default: `~/whisper.cpp/models/ggml-small.en.bin`).
- **whisper-cli binary** — path to the built executable (default: `~/whisper.cpp/build/bin/whisper-cli`).
- **Polish transcripts with LLM** — off by default.
- **LLM server URL** — OpenAI-compatible base URL (e.g. `http://localhost:1234`).
- **LLM model name** — model identifier sent to that server.
- **Use selected notebook** — create the note in the notebook currently selected in Joplin.
- **Default notebook ID** — fallback notebook when the above is disabled.

## Usage

Open the **Dictate** panel (toolbar mic button or Tools → Dictate):

1. **Dictate** — start recording. The button turns into **Stop**.
2. **Pause / Resume** — pause capture; you must Resume before you can Stop.
3. **Cancel** — discard the current recording.
4. **Stop** — finish, transcribe, and create the note.
5. **Transcribe file…** — pick a WAV file to transcribe instead of recording.

## Building from source

```bash
npm install
npm run dist   # produces publish/dev.normg.joplin-dictate.jpl
```

## License

[MIT](./LICENSE) © Norm Green
