import { app } from "./comfy"
import { pushImageToClient } from "./host-rpc"
import { INodeOutputSlot, LGraphNode } from "./types"
import "./utils/i18n"
import { NodeId } from "@comfyorg/comfyui-frontend-types"

interface PatchableNode extends LGraphNode {
  _teleportPatchEnabled?: boolean
}

const TELEPORT_NODE_CLASSES = new Set(["TeleportNext", "TeleportPrevious"])
const TELEPORT_WINDOW_NAME_PREFIX = "comfyui-teleport-window"

const DEFAULT_TELEPORT_ID = ""

const SLOT_TYPE_INPUT = 1
const SLOT_TYPE_OUTPUT = 2

const teleportWindows = new Map<string, Window>()
let nextTeleportId = 0

function generateTeleportId() {
  let value = nextTeleportId
  nextTeleportId += 1

  let letters = ""
  do {
    value -= 1
    letters = String.fromCharCode(65 + (value % 26)) + letters
    value = Math.floor(value / 26)
  } while (value > 0)

  return letters
}

function getClientWindowUrl(teleportId: string): string {
  const url = new URL(
    import.meta.env.DEV
      ? `${window.location.protocol}//${window.location.hostname}:5173/client.html`
      : "/teleport/client.html",
    window.location.href,
  )
  url.searchParams.set("teleportId", teleportId)
  return url.toString()
}

function focusOrOpenTeleportWindow(teleportId: string) {
  const existingWindow = teleportWindows.get(teleportId)
  if (existingWindow && !existingWindow.closed) {
    existingWindow.focus()
    return
  }

  const windowName = `${TELEPORT_WINDOW_NAME_PREFIX}-${teleportId}`
  const newWindow = window.open(
    getClientWindowUrl(teleportId),
    windowName,
    "popup=yes,width=1000,height=780,resizable=yes,scrollbars=no",
  )

  if (newWindow) {
    teleportWindows.set(teleportId, newWindow)
  }
}

function getTeleportNodeMode(node: LGraphNode) {
  return node.comfyClass === "TeleportPrevious" ? "previous" : "next"
}

function ensureTeleportIdWidget(node: LGraphNode) {
  const existingWidget = node.widgets?.find((widget) => widget.name === "ID")
  if (!existingWidget) {
    const newWidget = node.addWidget("text", "ID", generateTeleportId(), undefined)
    return newWidget.value as string
  }
}

function getTeleportId(node: LGraphNode) {
  const idWidget = node.widgets?.find((widget) => widget.name === "ID")
  const widgetValue = idWidget?.value

  if (typeof widgetValue === "string") {
    return widgetValue.trim()
  }
  return null
}

function patchTeleportNode(node: LGraphNode) {
  ensureTeleportIdWidget(node)

  node.addWidget("button", "Open Window", "", () => {
    let teleportId = getTeleportId(node)
    if (teleportId === null) {
      teleportId = DEFAULT_TELEPORT_ID
    }
    focusOrOpenTeleportWindow(teleportId)
  })

  const mode = getTeleportNodeMode(node)
  let activeTargetNode: LGraphNode | null = null

  const originalOnConnectionsChange = node.onConnectionsChange
  node.onConnectionsChange = function (...args) {
    const [slotType, , isConnected, link, slot] = args
    if (originalOnConnectionsChange) {
      originalOnConnectionsChange.apply(this, args)
    }

    const currentNode = this as LGraphNode

    const patchNode = (nodeId: NodeId, overwrite = false): LGraphNode | null => {
      if (activeTargetNode && activeTargetNode.id === nodeId) {
        return activeTargetNode
      }
      if (!overwrite && activeTargetNode) {
        return activeTargetNode
      }
      const node = app.rootGraph.getNodeById(nodeId) as LGraphNode | null
      if (node) {
        resetNode()
        patchTargetNode(currentNode, node)
        sendNodeImage(currentNode, node)
        activeTargetNode = node
        return node
      }
      return null
    }
    const resetNode = () => {
      if (activeTargetNode) {
        unpatchTargetNode(activeTargetNode)
        activeTargetNode = null
      }
    }

    if (mode === "next" && slotType === SLOT_TYPE_OUTPUT) {
      // when a link is added, make this node the target node if there is no active one
      if (link && isConnected) {
        patchNode(link.target_id, false)
        return
      }

      // when a link is removed, find other connected nodes and make one of them the target node
      const links = (slot as INodeOutputSlot).links ?? []
      for (const linkId of links) {
        const nextLink = app.rootGraph.getLink(linkId)
        if (!nextLink) {
          continue
        }

        const patchedNode = patchNode(nextLink.target_id, true)
        if (patchedNode) {
          return
        }
      }

      // when no connected nodes are found, reset the active target node
      resetNode()
    } else if (mode === "previous" && slotType === SLOT_TYPE_INPUT) {
      if (link && isConnected) {
        patchNode(link.origin_id, false)
        return
      }

      const prevLinkId = currentNode.inputs?.[0]?.link
      if (prevLinkId) {
        const prevLink = app.rootGraph.getLink(prevLinkId)
        if (prevLink) {
          const patchedNode = patchNode(prevLink.origin_id, true)
          if (patchedNode) {
            return
          }
        }
      }

      resetNode()
    }
  }
}

function sendNodeImage(teleportNode: LGraphNode, targetNode: LGraphNode) {
  const image = targetNode.imgs?.[0]
  if (image?.src) {
    let teleportId = getTeleportId(teleportNode)
    if (teleportId === null) {
      teleportId = DEFAULT_TELEPORT_ID
      app.extensionManager.toast.add({
        severity: "warn",
        life: 2000,
        detail: `ComfyUI.Teleport: Node ${teleportNode.title}(${teleportNode.id}) has no Teleport ID, using default ID: "${DEFAULT_TELEPORT_ID}"`,
      })
    }
    console.log("ComfyUI.Teleport: pushing image to client", teleportNode, teleportId, image.src)
    void pushImageToClient(image.src, teleportId)
  }
}

function patchTargetNode(teleportNode: LGraphNode, targetNode: LGraphNode) {
  console.log(
    "ComfyUI.Teleport: patchTargetNode",
    teleportNode,
    targetNode,
    getTeleportId(teleportNode),
  )

  // if the node is already patched, just enable it and return
  if ((targetNode as PatchableNode)._teleportPatchEnabled !== undefined) {
    ;(targetNode as PatchableNode)._teleportPatchEnabled = true
    return
  }

  let descriptor = Object.getOwnPropertyDescriptor(targetNode, "imgs")
  if (descriptor?.get === undefined) {
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
      sendNodeImage(teleportNode, this)
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
      if (!TELEPORT_NODE_CLASSES.has(Object.getPrototypeOf(node)?.comfyClass)) {
        return
      }
      patchTeleportNode(node as LGraphNode)
    },
  })
}

void initialize()
