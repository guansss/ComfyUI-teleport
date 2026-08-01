import type {
  ComfyApp,
  ComfyExtension,
  ComfyNodeDef,
  NodeLocatorId,
  SerializedNodeId,
} from "@comfyorg/comfyui-frontend-types"

type Rect = { [key: string]: unknown }
type Point = { [key: string]: unknown }

export type INodeOutputSlot = LGraphNode["outputs"][number]

type _LGraphNode = Parameters<ComfyApp["positionNodes"]>[0][number]

type ExecutionId = ReturnType<ComfyApp["addConfigureHandler"]>

type NodeExecutionOutput = Parameters<
  NonNullable<ComfyExtension["onNodeOutputsUpdated"]>
>[0][NodeLocatorId]

type ExecutableLGraphNode = GetExecutableLGraphNode<ComfyApp["rootGraph"]["nodes"][number]>
type GetExecutableLGraphNode<T> = T extends { getInnerNodes: (...args: any[]) => infer R }
  ? R extends unknown[]
    ? R[number]
    : never
  : never

type ComfyWorkflow = Exclude<Parameters<ComfyApp["loadGraphData"]>[3], string | undefined | null>
type ExecutedWsMessage = NonNullable<
  NonNullable<ComfyWorkflow["changeTracker"]>["nodeOutputs"]
>[string]

type _LGraphNodeConstructor = _LGraphNode["constructor"]
interface LGraphNodeConstructor<T extends LGraphNode = LGraphNode> extends _LGraphNodeConstructor {
  type?: string
  comfyClass: string
  title: string
  nodeData?: ComfyNodeDef & { [key: symbol]: unknown }
  category?: string
  new (): T
}

type BaseWidget = ReturnType<LGraphNode["addWidget"]>

// Copied from https://github.com/Comfy-Org/ComfyUI_frontend/blob/dfefba0729333852f351f3bc9a16958f1ca8690e/src/types/litegraph-augmentation.d.ts
export interface LGraphNode extends _LGraphNode {
  constructor: LGraphNodeConstructor

  /**
   * Callback fired on each node after the graph is configured
   */
  onAfterGraphConfigured?(): void
  onGraphConfigured?(): void
  /**
   * Callback fired when node execution completes.
   * Output contains known media properties (images, audio, video) plus
   * arbitrary node-specific outputs (text, ui, custom properties).
   */
  onExecuted?(output: NodeExecutionOutput): void
  onNodeCreated?(this: LGraphNode): void
  /** Flattens a subgraph node into its executable inner nodes. */
  getInnerNodes?(
    nodesByExecutionId: Map<ExecutionId, ExecutableLGraphNode>,
    subgraphNodePath?: readonly SerializedNodeId[],
    nodes?: ExecutableLGraphNode[],
    subgraphs?: Set<LGraphNode>,
  ): ExecutableLGraphNode[]
  recreate?(): Promise<LGraphNode>
  refreshComboInNode?(defs: Record<string, ComfyNodeDef>): Promise<void>
  /**
   * @deprecated primitive node.
   * Used by virtual nodes (primitives) to insert their values into the graph prior to queueing.
   * Externally used by
   * - https://github.com/pythongosssss/ComfyUI-Custom-Scripts/blob/bbda5e52ad580c13ceaa53136d9c2bed9137bd2e/web/js/presetText.js#L160-L182
   * - https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite/blob/4c7858ddd5126f7293dc3c9f6e0fc4c263cde079/web/js/VHS.core.js#L1889-L1889
   */
  applyToGraph?(extraLinks?: unknown[]): void
  onExecutionStart?(): unknown
  /**
   * Callback invoked when the node is dragged over from an external source, i.e.
   * a file or another HTML element.
   * @param e The drag event
   * @returns {boolean} True if the drag event should be handled by this node, false otherwise
   */
  onDragOver?(e: DragEvent): boolean
  /**
   * Callback invoked when the node is dropped from an external source, i.e.
   * a file or another HTML element.
   * @param e The drag event
   * @returns {boolean} True if the drag event should be handled by this node, false otherwise
   */
  onDragDrop?(e: DragEvent): Promise<boolean> | boolean

  index?: number
  runningInternalNodeId?: SerializedNodeId

  comfyClass?: string

  /**
   * If the node is a frontend only node and should not be serialized into the prompt.
   */
  isVirtualNode?: boolean

  // addDOMWidget<T extends HTMLElement = HTMLElement, V extends object | string = string>(
  //   name: string,
  //   type: string,
  //   element: T,
  //   options?: DOMWidgetOptions<V>,
  // ): DOMWidget<T, V>

  animatedImages?: boolean
  imgs?: HTMLImageElement[]
  images?: ExecutedWsMessage["output"]
  /** Container for the node's video preview */
  videoContainer?: HTMLElement
  /** Whether the node's preview media is loading */
  isLoading?: boolean
  /** Whether a file is being uploaded to this node */
  isUploading?: boolean
  /** The content type of the node's preview media */
  previewMediaType?: "image" | "video" | "audio" | "model"
  /** If true, output images are stored but not rendered below the node */
  hideOutputImages?: boolean

  preview: string[]
  /** Index of the currently selected image on a multi-image node such as Preview Image */
  imageIndex?: number | null
  imageRects: Rect[]
  overIndex?: number | null
  pointerDown?: { index: number | null; pos: Point } | null
  /**
   * @deprecated No longer needed as we use {@link useImagePreviewWidget}
   */
  setSizeForImage?(force?: boolean): void
  /** @deprecated Unused */
  inputHeight?: unknown

  /** The y offset of the image preview to the top of the node body. */
  imageOffset?: number
  /** Callback for pasting an image file into the node */
  pasteFile?(file: File): void
  /** Callback for pasting multiple files into the node */
  pasteFiles?(files: File[]): void

  /** Used internally for sizing the node during creation */
  _initialMinSize?: { width: number; height: number }
}
