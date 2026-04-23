# Unreal Replay Server

A very simple Node.js + Express server for Unreal Engine replay chunk upload and playback.

## Features

- Upload and download replay headers
- Upload and download replay chunks
- Mark replays as complete
- Local filesystem storage
- Binary data handling

## Installation

1. Clone or download the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Server

Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

The server runs on `http://localhost:2000` by default.

## API Usage Reference

### 1. Health Check

```bash
curl http://localhost:2000/health
```

### 2. Upload Replay Header

```bash
curl -X POST \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@path/to/header.bin" \
  http://localhost:2000/replay/my-session/header
```

### 3. Upload Replay Chunk

```bash
curl -X POST \
  -H "Content-Type: application/octet-stream" \
  --data-binary "@path/to/chunk.bin" \
  http://localhost:2000/replay/my-session/chunks/0
```

### 4. Download Replay Header

```bash
curl http://localhost:2000/replay/my-session/header -o replay.header
```

### 5. Download Replay Chunk

```bash
curl http://localhost:2000/replay/my-session/chunks/0 -o stream.0
```

### 6. Mark Replay Complete

```bash
curl -X POST http://localhost:2000/replay/my-session/complete
```

## Storage Structure

Data is stored in the `data/` directory:

```text
data/
  sessions/
    <sessionName>/
      replay.header
      manifest.json
      chunks/
        stream.0
        stream.1
        ...
```
# Replay-system-server
