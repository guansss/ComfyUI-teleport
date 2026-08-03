// @ts-expect-error I don't know how to properly get this to work
import { app } from "/scripts/app.js"
// @ts-expect-error I don't know how to properly get this to work
import { api } from "/scripts/api.js"

import { ComfyApi, ComfyApp } from "@comfyorg/comfyui-frontend-types"

declare const app: ComfyApp
declare const api: ComfyApi

export { api, app }
