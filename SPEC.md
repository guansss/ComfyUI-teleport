# SPEC for ComfyUI-teleport

## Goal

Build a ComfyUI extension (custom node) that allows users to view images in a separate window.

## Features

- Available new nodes: `Teleport Next` and `Teleport Previous`.
- Images inside the nodes that connect to the Teleport nodes will be mirrored in a separate window.

## Tech Stack

- Frontend: Vite, React, shadcn/ui, TailwindCSS, i18next
- Backend: Python (ComfyUI)

## Project Structure

```
ComfyUI-teleport/
├── .github/                    # GitHub configurations
│   └── workflows/
│       └── react-build.yml     # Automatic build and publishing workflow
├── __init__.py                 # Python entry point for ComfyUI integration
├── pyproject.toml              # Project metadata for ComfyUI Registry
├── dist/                       # Built extension files (generated)
└── ui/                         # React application
    ├── public/
    │   ├── client.html         # HTML template for the client window
    │   └── locales/            # Internationalization files
    │       ├── en/
    │       │   └── main.json   # English translations
    │       └── zh/
    │           └── main.json   # Chinese translations
    ├── src/
    │   ├── main.tsx            # Entry point for React app
    │   ├── host-rpc.ts         # Host-side RPC functions
    │   ├── vite-env.d.ts       # Vite environment types
    │   ├── client/
    │   │   ├── client.tsx      # Client's entry point
    │   │   ├── client-rpc.ts   # Client-side RPC functions
    │   │   └── client.css      # Client-specific styles
    │   └── utils/
    │       └── i18n.ts         # Internationalization setup
    ├── eslint.config.js        # ESLint configuration
    ├── package.json            # npm dependencies
    ├── tsconfig.json           # TypeScript configuration
    ├── tsconfig.node.json      # TypeScript configuration for Node
    └── vite.config.ts          # Build configuration
```

## Implementation Details

#### Architecture

```
Extension
├── ComfyUI Node (Python)           # Handles image input/output and communicates with the frontend
└── Frontend (React)
    ├── Host (Main Window)          # Acts as the Teleport node
    └── Client (Separate Window)    # Displays the image in real-time
```

When the user clicks the "Open Teleport Window" button in the ComfyUI node, the frontend will open a new browser window. The new window will load the `client.html` file and initialize the React application.

#### ComfyUI Nodes

Teleport nodes:

- `Teleport Next`: Teleports the next node's image, i.e., the node that is connected to the Teleport node's output slot.
- `Teleport Previous`: Teleports the previous node's image, i.e., the node that is connected to the Teleport node's input slot.

The Teleport nodes supports two optional input types: `IMAGE` and `LATENT`, and the same output types. Any input data will be passed through to the output without modification. The main purpose of these types is to allow users to connect the Teleport nodes to other compatible nodes in the workflow.

Each Teleport node has an ID. The ID is auto-generated and persisted when the node is created, starting from `A` and incrementing alphabetically (e.g., `A`, `B`, `C`, ..., `Z`, `AA`, `AB`, ...). The ID is displayed in an input field on the node, and users can change it to any string they want. Modified IDs should also be persisted. Duplicate IDs are allowed.

Each Teleport node has a button labeled "Open Window". When clicked, it will open a new browser window and pass its ID to the window. If a window with the same ID is already open, it will focus on that window instead.

#### Frontend

The frontend will use RPC (Remote Procedure Call) to communicate between the host and client windows. The RPC util is already implemented in `utils/rpc.ts` and used by `host-rpc.ts` and `client-rpc.ts`.

During development, the client window will load `client.tsx` via Vite's development server. In production, the client window will load the built `client.js` file from the `dist` directory.

Each client window will have a unique ID passed from the host window. The client window will use this ID to establish a connection with the host window and receive image updates. The ID is displayed in the client window's title.

When the client window is establishing the connection, it will show a loading state. Once the connection is established, it will display the image received from the host window. If the connection is lost, the client window will show a disconnected state and attempt to reconnect.

The displayed image will fill the entire client window. When there is no image, a placeholder message will be shown.

The connection state indicator will be displayed in the top-right of the client window (floating above the image) when the connection is either loading or disconnected. When the connection is established, the connection state indicator will be hidden.

## References

- [ComfyUI Custom Nodes Documentation](https://docs.comfy.org/custom-nodes/overview)

## Notes

- No testing.
