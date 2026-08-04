import { generateTranslations } from "./scripts/generate-translations"
import react from "@vitejs/plugin-react"
import fs from "fs"
import path from "path"
import { parse as parseToml } from "toml"
import { defineConfig } from "vite"

interface RewriteComfyImportsOptions {
  isDev: boolean
}

function getExtensionNameFromPyproject(): string {
  const pyprojectPath = path.resolve(__dirname, "../pyproject.toml")

  try {
    const pyproject = fs.readFileSync(pyprojectPath, "utf8")
    const parsed = parseToml(pyproject) as { project?: { name?: unknown } }
    const projectName = parsed.project?.name
    if (typeof projectName === "string" && projectName.length > 0) {
      return projectName
    }
  } catch {
    // Fall back to a stable default if pyproject.toml cannot be read.
  }

  return "comfyui-teleport"
}

const extensionName = getExtensionNameFromPyproject()

// Plugin to correctly handle the ComfyUI scripts in development mode
const rewriteComfyImports = ({ isDev }: RewriteComfyImportsOptions) => {
  return {
    name: "rewrite-comfy-imports",
    resolveId(source: string) {
      if (!isDev) {
        return
      }
      if (source === "/scripts/app.js") {
        return "http://127.0.0.1:8188/scripts/app.js"
      }
      if (source === "/scripts/api.js") {
        return "http://127.0.0.1:8188/scripts/api.js"
      }
      return null
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: "./", // prevent assets from being loaded from the root path
  define: {
    __DEV__: mode === "development" || process.argv.includes("--watch"),
    __EXTENSION_NAME__: JSON.stringify(extensionName),
  },
  plugins: [
    react(),
    rewriteComfyImports({ isDev: mode === "development" }),
    generateTranslations(),
  ],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      // Don't bundle ComfyUI scripts - they will be loaded from the ComfyUI server
      external: ["/scripts/app.js", "/scripts/api.js"],
      input: {
        main: path.resolve(__dirname, "src/main.tsx"),
        client: path.resolve(__dirname, "src/client/index.ts"),
      },
      output: {
        // Output to the dist directory served by ComfyUI.
        dir: "../dist",
        entryFileNames: "[name].js",
        chunkFileNames: (chunk) => {
          if (chunk.isDynamicEntry) {
            // ComfyUI automatically loads every .js file in the dist directory, which causes the client code
            // to also be loaded in the host window. Luckily, .mjs files will not be loaded, so we can use this
            // for dynamic chunks (the ones that will be imported by import() statement). If at some point
            // ComfyUI starts auto-loading .mjs files, we may need to change this to a custom extension like .dynamicjs
            // and fetch the dynamic chunks manually in the client code.
            return "[name]-[hash].mjs"
          }
          return "[name]-[hash].js"
        },
        assetFileNames: "[name][extname]",
        // Split React into a separate vendor chunk for better caching
        manualChunks: {
          vendor: ["react", "react-dom"],
        },
      },
    },
  },
}))
