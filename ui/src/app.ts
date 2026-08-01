// @ts-expect-error I don't know how to properly get this to work
import { app } from "/scripts/app.js"

import { ComfyApp } from "@comfyorg/comfyui-frontend-types"

declare const app: ComfyApp

export { app }
