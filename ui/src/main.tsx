import { app } from "./app"
import { pushImageToClient } from "./host-rpc"
import { INodeOutputSlot, LGraphNode } from "./types"
import "./utils/i18n"
import type { ComfyApp, NodeId } from "@comfyorg/comfyui-frontend-types"

declare global {
  interface Window {
    app?: ComfyApp
  }
}

interface PatchableNode extends LGraphNode {
  _teleportPatchEnabled?: boolean
}

const TELEPORT_NODE_CLASS = "Teleport"
const TELEPORT_WINDOW_NAME = "comfyui-teleport-window"

const PATCHABLE_NODE_TYPES = ["PreviewImage", "SaveImage"]

let teleportWindow: Window | null = null

function getClientWindowUrl(): string {
  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.hostname}:5173/client.html`
  }

  return "/teleport/client.html"
}

function focusOrOpenTeleportWindow() {
  if (teleportWindow && !teleportWindow.closed) {
    teleportWindow.focus()
    return
  }

  teleportWindow = window.open(
    getClientWindowUrl(),
    TELEPORT_WINDOW_NAME,
    "popup=yes,width=1000,height=780,resizable=yes,scrollbars=no",
  )
}

function patchTeleportNode(node: LGraphNode) {
  node.addWidget("button", "Open Teleport Window", "", () => {
    focusOrOpenTeleportWindow()
  })

  let activeTargetNodeId: NodeId | undefined

  const originalOnConnectionsChange = node.onConnectionsChange
  node.onConnectionsChange = function (...args) {
    const [type, index, isConnected, link, slot] = args
    if (originalOnConnectionsChange) {
      originalOnConnectionsChange.apply(this, args)
    }

    if (!link) return
    // type=1 for input, type=2 for output
    if (type !== 2) return

    const targetNode = app.rootGraph.getNodeById(link.target_id) as LGraphNode | null
    if (!targetNode) return

    const processTargetNode = (targetNode: LGraphNode) => {
      patchTargetNode(this as LGraphNode, targetNode)
      activeTargetNodeId = targetNode.id
      sendNodeImage(targetNode.imgs)
    }

    if (isConnected) {
      // only the first connected target node will be patched, subsequent connections will be ignored
      if (activeTargetNodeId !== undefined) {
        return
      }
      if (PATCHABLE_NODE_TYPES.includes(targetNode.type)) {
        processTargetNode(targetNode)
      }
    } else {
      if (activeTargetNodeId) {
        unpatchTargetNode(targetNode)
        activeTargetNodeId = undefined
      }

      const links = (slot as INodeOutputSlot).links
      if (!links) return

      for (let i = 0; i < links.length; i++) {
        const nextLink = app.rootGraph.getLink(links[i])
        if (nextLink) {
          const nextTargetNode = app.rootGraph.getNodeById(nextLink.target_id) as LGraphNode | null
          if (nextTargetNode) {
            if (PATCHABLE_NODE_TYPES.includes(nextTargetNode.type)) {
              processTargetNode(nextTargetNode)
            }
          }
        }
      }
    }
  }
}

function sendNodeImage(imgs: LGraphNode["imgs"]) {
  const image = imgs?.[0]
  if (image?.src) {
    console.log("ComfyUI.Teleport: pushing image to client", image.src)
    void pushImageToClient(image.src)
  }
}

function patchTargetNode(teleportNode: LGraphNode, targetNode: LGraphNode) {
  console.log("ComfyUI.Teleport: patchTargetNode", teleportNode, targetNode)
  if ((targetNode as PatchableNode)._teleportPatchEnabled !== undefined) {
    ;(targetNode as PatchableNode)._teleportPatchEnabled = true
    return
  }
  let descriptor = Object.getOwnPropertyDescriptor(targetNode, "imgs")
  if (descriptor?.get === undefined) {
    // if it's a data descriptor, we need to convert it to an accessor descriptor to allow getter/setter
    descriptor = {
      configurable: true,
      enumerable: true,
    }
  }
  let imgs: LGraphNode["imgs"] = targetNode.imgs
  Object.defineProperty(targetNode, "imgs", {
    ...descriptor,
    get: function (this: PatchableNode): LGraphNode["imgs"] {
      if (descriptor.get) {
        return descriptor.get.call(this)
      }
      return imgs
    },
    set: function (this: PatchableNode, value: LGraphNode["imgs"]) {
      imgs = value
      if (descriptor.set) {
        descriptor.set.call(this, value)
      }

      if (!this._teleportPatchEnabled) {
        return
      }
      sendNodeImage(value)
    },
  })
  ;(targetNode as PatchableNode)._teleportPatchEnabled = true
}

function unpatchTargetNode(targetNode: LGraphNode) {
  console.log("ComfyUI.Teleport: unpatchTargetNode", targetNode)
  if ((targetNode as PatchableNode)._teleportPatchEnabled) {
    ;(targetNode as PatchableNode)._teleportPatchEnabled = false
  }
}

async function initialize() {
  app.registerExtension({
    name: "ComfyUI.Teleport",
    nodeCreated(node) {
      if (Object.getPrototypeOf(node)?.comfyClass !== TELEPORT_NODE_CLASS) {
        return
      }
      patchTeleportNode(node as LGraphNode)
    },
  })
}

void initialize()
