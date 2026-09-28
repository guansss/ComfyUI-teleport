import { api, app } from "./comfy"
import { INodeOutputSlot, LGraphNode } from "./comfy-shims"
import { emitter, Events } from "./events"
import { getAvailableClients, pushImageToClient } from "./host-rpc"
import { FALLBACK_TELEPORT_ID, getWebDir } from "./shared"
import { intercept } from "./utils/object"
import { ComfyApp, NodeId } from "@comfyorg/comfyui-frontend-types"

interface PatchableNode extends LGraphNode {
  _teleportPatchEnabled?: boolean
}

const TELEPORT_NODE_CLASSES = new Set(["TeleportNext", "TeleportPrevious"])

const SLOT_TYPE_INPUT = 1
const SLOT_TYPE_OUTPUT = 2

const promptToWorkflowMap = new Map<string, string>()
const previewNodeToTeleportNodeMap: Record<string, NodeId> = {}
const previewNodeToImageMap: Record<string, string> = {}

function generateTeleportId(existingIds?: string[]): string {
  let nextTeleportId = 1
  let letters = ""
  do {
    let value = nextTeleportId
    nextTeleportId += 1

    letters = ""
    do {
      value -= 1
      letters = String.fromCharCode(65 + (value % 26)) + letters
      value = Math.floor(value / 26)
    } while (value > 0)
  } while (existingIds?.includes(letters))
  return letters
}

function getClientWindowUrl(teleportId: string): string {
  const url = new URL(`${getWebDir()}/client.html`, window.location.href)
  url.searchParams.set("teleportId", teleportId)
  return url.toString()
}

function openTeleportWindow(teleportId: string) {
  window.open(
    getClientWindowUrl(teleportId),
    "_blank",
    "popup=yes,width=1000,height=780,resizable=yes,scrollbars=no",
  )
}

function getTeleportNodeMode(node: LGraphNode) {
  return node.comfyClass === "TeleportPrevious" ? "previous" : "next"
}

function buildTeleportIdWidget(node: LGraphNode) {
  const existingWidget = node.widgets?.find((widget) => widget.name === "ID")
  if (existingWidget) return existingWidget

  const existingTeleportIds = app.isGraphReady
    ? app.rootGraph.nodes
        .map((n) => (isTeleportNode(n) ? getTeleportId(n as LGraphNode) : null))
        .filter((id): id is string => id !== null)
    : []
  const defaultId = generateTeleportId(existingTeleportIds)
  const newWidget = node.addWidget(
    "text",
    "ID",
    defaultId,
    (value) => {
      emitter.dispatchEvent(
        new CustomEvent("teleportIdChanged", {
          detail: { nodeId: node.id, teleportId: String(value) },
        }),
      )
    },
    { serialize: false },
  )
  return newWidget
}

function getTeleportId(node: LGraphNode) {
  const idWidget = node.widgets?.find((widget) => widget.name === "ID")
  const widgetValue = idWidget?.value

  if (typeof widgetValue === "string") {
    return widgetValue.trim()
  }
  return null
}

function buildOpenWindowButton(node: LGraphNode) {
  const openButton = node.addWidget(
    "button",
    "Open Window",
    "",
    () => openTeleportWindow(getTeleportId(node) ?? FALLBACK_TELEPORT_ID),
    { serialize: false },
  )
  openButton.serialize = false
  const updateLabel = () => {
    const teleportId = getTeleportId(node) ?? FALLBACK_TELEPORT_ID
    const matchedClients = getAvailableClients().filter(
      (client) => client.teleportId === teleportId,
    )
    openButton.label = `Open Window (${matchedClients.length})`
  }
  updateLabel()
  const onClientsChanged = () => updateLabel()
  emitter.addEventListener("clientsChanged", onClientsChanged)
  const onTeleportIdChanged = (event: Events["teleportIdChanged"]) => {
    if (event.detail.nodeId === node.id) {
      updateLabel()
    }
  }
  emitter.addEventListener("teleportIdChanged", onTeleportIdChanged)

  intercept(node, "onConfigure", (fn) => {
    fn?.()
    updateLabel()
  })
  intercept(node, "onRemoved", (fn) => {
    fn?.()
    emitter.removeEventListener("clientsChanged", onClientsChanged)
    emitter.removeEventListener("teleportIdChanged", onTeleportIdChanged)
  })
}

function patchTeleportNode(teleportNode: LGraphNode) {
  buildTeleportIdWidget(teleportNode)
  buildOpenWindowButton(teleportNode)

  const mode = getTeleportNodeMode(teleportNode)
  let activeTargetNode: LGraphNode | null = null

  const setActiveTargetNode = (nodeId: NodeId, overwrite = false): LGraphNode | null => {
    if (activeTargetNode && activeTargetNode.id === nodeId) {
      return activeTargetNode
    }
    if (!overwrite && activeTargetNode) {
      return activeTargetNode
    }
    const targetNode = app.rootGraph.getNodeById(nodeId) as LGraphNode | null
    if (targetNode) {
      resetTargetNode()
      patchTargetNode(teleportNode, targetNode)
      // despite NodeId being defined as a string, it's actually a number for some reason...
      previewNodeToTeleportNodeMap[String(targetNode.id)] = teleportNode.id
      sendImageFromImageNode(teleportNode, targetNode)
      activeTargetNode = targetNode
      return targetNode
    }
    return null
  }
  const resetTargetNode = () => {
    if (activeTargetNode) {
      unpatchTargetNode(activeTargetNode)
      delete previewNodeToTeleportNodeMap[String(activeTargetNode.id)]
      activeTargetNode = null
    }
  }

  intercept(
    teleportNode,
    "onConnectionsChange",
    function (fn, slotType, index, isConnected, link, slot) {
      fn?.()
      const currentNode = this as LGraphNode

      if (mode === "next" && slotType === SLOT_TYPE_OUTPUT) {
        // when a link is added, make this node the target node if there is no active one
        if (link && isConnected) {
          setActiveTargetNode(link.target_id, false)
          return
        }

        // when a link is removed, find other connected nodes and make one of them the target node
        const links = (slot as INodeOutputSlot).links ?? []
        for (const linkId of links) {
          const nextLink = app.rootGraph.getLink(linkId)
          if (!nextLink) {
            continue
          }

          const patchedNode = setActiveTargetNode(nextLink.target_id, true)
          if (patchedNode) {
            return
          }
        }

        // when no connected nodes are found, reset the active target node
        resetTargetNode()
      } else if (mode === "previous" && slotType === SLOT_TYPE_INPUT) {
        if (link && isConnected) {
          setActiveTargetNode(link.origin_id, false)
          return
        }

        const prevLinkId = currentNode.inputs?.[0]?.link
        if (prevLinkId) {
          const prevLink = app.rootGraph.getLink(prevLinkId)
          if (prevLink) {
            const patchedNode = setActiveTargetNode(prevLink.origin_id, true)
            if (patchedNode) {
              return
            }
          }
        }

        resetTargetNode()
      }
    },
  )

  intercept(teleportNode, "onRemoved", function (fn) {
    fn?.()
    resetTargetNode()
  })
}

function sendImageFromImageNode(teleportNode: LGraphNode, targetNode: LGraphNode) {
  const image = targetNode.imgs?.[0]
  if (image?.src) {
    sendImage(teleportNode, image.src)
  }
}

function sendImage(teleportNode: LGraphNode, imageUrl: string) {
  let teleportId = getTeleportId(teleportNode)
  if (teleportId === null) {
    teleportId = FALLBACK_TELEPORT_ID
    app.extensionManager.toast.add({
      severity: "warn",
      life: 2000,
      detail: `ComfyUI.Teleport: Node ${teleportNode.title}(${teleportNode.id}) has no Teleport ID, using default ID: "${FALLBACK_TELEPORT_ID}"`,
    })
  }
  void pushImageToClient(imageUrl, teleportId)
}

function patchTargetNode(teleportNode: LGraphNode, targetNode: LGraphNode) {
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
      sendImageFromImageNode(teleportNode, this)
    },
  })
  ;(targetNode as PatchableNode)._teleportPatchEnabled = true
}

function unpatchTargetNode(targetNode: LGraphNode) {
  if ((targetNode as PatchableNode)._teleportPatchEnabled) {
    ;(targetNode as PatchableNode)._teleportPatchEnabled = false
  }
}

function isPromptAssociatedWithActiveWorkflow(promptId: string): boolean {
  return promptToWorkflowMap.get(promptId) === app.extensionManager.workflow.activeWorkflow.key
}

function isTeleportNode(node: ComfyApp["rootGraph"]["nodes"][number]): boolean {
  return TELEPORT_NODE_CLASSES.has(Object.getPrototypeOf(node)?.comfyClass)
}

async function initialize() {
  app.registerExtension({
    name: "ComfyUI.Teleport",
    nodeCreated(node) {
      if (!isTeleportNode(node)) return
      patchTeleportNode(node as LGraphNode)
    },
  })

  intercept(api, "queuePrompt", async function (fn) {
    const result = await fn()
    if (result.prompt_id) {
      const workflowKey = app.extensionManager.workflow.activeWorkflow?.key
      if (workflowKey) {
        promptToWorkflowMap.set(result.prompt_id, workflowKey)
      }
    }
    return result
  })

  api.addEventListener("b_preview_with_metadata", ({ detail: { jobId, displayNodeId, blob } }) => {
    const promptId = jobId
    if (!isPromptAssociatedWithActiveWorkflow(promptId)) return
    const teleportNodeId = previewNodeToTeleportNodeMap[String(displayNodeId)]
    if (!teleportNodeId) return
    const teleportNode = app.rootGraph.getNodeById(teleportNodeId) as LGraphNode | null
    if (!teleportNode) return

    if (previewNodeToImageMap[String(displayNodeId)]) {
      URL.revokeObjectURL(previewNodeToImageMap[String(displayNodeId)])
    }
    const imageUrl = URL.createObjectURL(blob)
    previewNodeToImageMap[String(displayNodeId)] = imageUrl
    sendImage(teleportNode, imageUrl)
  })
}

void initialize()
