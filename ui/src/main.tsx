import { app } from "./app"
import { pushImageToClient } from "./host-rpc"
import { INodeOutputSlot, LGraphNode } from "./types"
import "./utils/i18n"

interface PatchableNode extends LGraphNode {
  _teleportPatchEnabled?: boolean
}

const TELEPORT_NODE_CLASSES = new Set(["TeleportNext", "TeleportPrevious"])
const TELEPORT_WINDOW_NAME_PREFIX = "comfyui-teleport-window"

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
  if (existingWidget) {
    return getTeleportId(node)
  }

  const generatedId = generateTeleportId()
  node.addWidget("text", "ID", generatedId, undefined)
  return generatedId
}

function getTeleportId(node: LGraphNode) {
  const idWidget = node.widgets?.find((widget) => widget.name === "ID")
  const widgetValue = idWidget?.value

  if (typeof widgetValue === "string" && widgetValue.trim()) {
    return widgetValue.trim()
  }

  const generatedId = generateTeleportId()
  if (idWidget) {
    idWidget.value = generatedId
  }
  return generatedId
}

function patchTeleportNode(node: LGraphNode) {
  ensureTeleportIdWidget(node)

  node.addWidget("button", "Open Window", "", () => {
    focusOrOpenTeleportWindow(getTeleportId(node))
  })

  const mode = getTeleportNodeMode(node)
  let activeConnectedNode: LGraphNode | null = null

  const originalOnConnectionsChange = node.onConnectionsChange
  node.onConnectionsChange = function (...args) {
    const [slotType, index, isConnected, link, slot] = args
    if (originalOnConnectionsChange) {
      originalOnConnectionsChange.apply(this, args)
    }

    const currentNode = this as LGraphNode
    const teleportId = getTeleportId(currentNode)

    if (mode === "next" && slotType === SLOT_TYPE_OUTPUT) {
      if (link) {
        const targetNode = app.rootGraph.getNodeById(link.target_id) as LGraphNode | null
        if (!targetNode) {
          return
        }

        patchTargetNode(currentNode, targetNode, teleportId)
        activeConnectedNode = targetNode
        sendNodeImage(targetNode.imgs, teleportId)
        return
      }

      if (activeConnectedNode) {
        unpatchTargetNode(activeConnectedNode)
        activeConnectedNode = null
      }

      const links = (slot as INodeOutputSlot).links ?? []
      for (const linkId of links) {
        const nextLink = app.rootGraph.getLink(linkId)
        if (!nextLink) {
          continue
        }

        const nextTargetNode = app.rootGraph.getNodeById(nextLink.target_id) as LGraphNode | null
        if (nextTargetNode) {
          patchTargetNode(currentNode, nextTargetNode, teleportId)
          activeConnectedNode = nextTargetNode
          sendNodeImage(nextTargetNode.imgs, teleportId)
        }
      }
      return
    } else if (mode === "previous" && slotType === SLOT_TYPE_INPUT) {
      if (link) {
        const sourceNode = app.rootGraph.getNodeById(link.origin_id) as LGraphNode | null
        if (!sourceNode) {
          return
        }

        patchTargetNode(currentNode, sourceNode, teleportId)
        activeConnectedNode = sourceNode
        sendNodeImage(sourceNode.imgs, teleportId)
        return
      }

      if (activeConnectedNode) {
        unpatchTargetNode(activeConnectedNode)
        activeConnectedNode = null
      }

      const prevLinkId = currentNode.inputs?.[0]?.link
      if (prevLinkId) {
        const prevLink = app.rootGraph.getLink(prevLinkId)
        if (prevLink) {
          const prevSourceNode = app.rootGraph.getNodeById(prevLink.origin_id) as LGraphNode | null
          if (prevSourceNode) {
            patchTargetNode(currentNode, prevSourceNode, teleportId)
            activeConnectedNode = prevSourceNode
            sendNodeImage(prevSourceNode.imgs, teleportId)
          }
        }
      }
    }
  }
}

function sendNodeImage(imgs: LGraphNode["imgs"], teleportId: string) {
  const image = imgs?.[0]
  if (image?.src) {
    console.log("ComfyUI.Teleport: pushing image to client", teleportId, image.src)
    void pushImageToClient(image.src, teleportId)
  }
}

function patchTargetNode(teleportNode: LGraphNode, targetNode: LGraphNode, teleportId: string) {
  console.log("ComfyUI.Teleport: patchTargetNode", teleportNode, targetNode, teleportId)
  if ((targetNode as PatchableNode)._teleportPatchEnabled === true) {
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
      sendNodeImage(value, teleportId)
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
