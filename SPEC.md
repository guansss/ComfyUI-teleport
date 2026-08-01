# SPEC for ComfyUI-teleport

## Goal

Build a ComfyUI extension (custom node) that allows users to view images in a separate window.

## Features

- A new node called "Teleport" that can be added to the ComfyUI workflow.
- The node will have an input for an image and an output for the same image.
- The node will have a button that, when clicked, opens a new browser window (not tab).
- The new window will display the node's input image, and update in real-time as the input image changes.

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
    │   ├── App.tsx             # Main React component
    │   ├── App.css             # Styles for the UI
    │   ├── index.css           # Global styles and theme variables
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

#### ComfyUI Node

The node will have an input for an image and an output for the same image. The main part of it is a preview of the input image. Below this preview is a button that opens the client window.

#### Frontend

The frontend will use RPC (Remote Procedure Call) to communicate between the host and client windows. The RPC util is already implemented in `utils/rpc.ts` and used by `host-rpc.ts` and `client-rpc.ts`.

During development, the client window will load `client.tsx` via Vite's development server. In production, the client window will load the built `client.js` file from the `dist` directory.

When the client window is establishing the connection, it will show a loading state. Once the connection is established, it will display the image received from the host window. If the connection is lost, the client window will show a disconnected state and attempt to reconnect.

## References

- [ComfyUI Custom Nodes Documentation](https://docs.comfy.org/custom-nodes/overview)

## Notes

- No testing.
