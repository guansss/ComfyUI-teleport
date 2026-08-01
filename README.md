# ComfyUI Teleport

ComfyUI Teleport is a custom node extension that mirrors image previews into a separate browser window.

## Features

- Adds a `Teleport` node to ComfyUI workflows.
- Node input/output: `IMAGE -> IMAGE` (pass-through).
- Adds an `Open Teleport Window` button directly on the node.
- Streams the latest Teleport image to a dedicated viewer window.
- Uses `birpc` + `BroadcastChannel` to keep host and client windows synced.

## Installation

### Manual Installation

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/guansss/ComfyUI-teleport.git
cd ComfyUI-teleport/ui
npm install
npm run build
```

Restart ComfyUI after build completes.

## Usage

1. Add the `Teleport` node to your workflow.
2. Connect an image output into the Teleport node input.
3. Click `Open Teleport Window` on the node.
4. Run the workflow. The separate Teleport window updates with the latest image.

## Development

```bash
cd ui
npm install
npm run build
```

Notes:
- This repository currently targets manual verification only.
- `PublisherId` in `pyproject.toml` is intentionally kept as a placeholder until publishing.

## Project Structure

```text
ComfyUI-teleport/
├── __init__.py                 # ComfyUI node + static route registration
├── pyproject.toml              # Comfy registry metadata
├── dist/                       # Built frontend assets (generated)
└── ui/
    ├── public/
    │   ├── client.html         # Viewer window shell
    │   └── locales/
    ├── src/
    │   ├── main.tsx            # Teleport node frontend hooks
    │   ├── host-rpc.ts         # Host-side RPC bridge
    │   ├── client/
    │   │   ├── client.tsx      # Teleport viewer app
    │   │   └── client-rpc.ts   # Client-side RPC handlers
    │   └── utils/
    │       ├── i18n.ts
    │       └── rpc.ts
```

## License

MIT
