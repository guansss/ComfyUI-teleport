import os

import nodes
import server
from aiohttp import web


class TeleportBase:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "image": ("IMAGE",),
                "latent": ("LATENT",),
            },
        }

    RETURN_TYPES = ("IMAGE", "LATENT")
    RETURN_NAMES = ("image", "latent")
    FUNCTION = "execute"
    CATEGORY = "Teleport"
    OUTPUT_NODE = True

    def execute(self, image=None, latent=None):
        return {"ui": {"my_custom_text": ["Update info here"]}, "result": (image, latent)}


class TeleportNext(TeleportBase):
    pass


class TeleportPrevious(TeleportBase):
    pass


NODE_CLASS_MAPPINGS = {
    "TeleportNext": TeleportNext,
    "TeleportPrevious": TeleportPrevious,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "TeleportNext": "Teleport Next",
    "TeleportPrevious": "Teleport Previous",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]

# Define the path to our extension
workspace_path = os.path.dirname(__file__)
dist_path = os.path.join(workspace_path, "dist")
dist_locales_path = os.path.join(workspace_path, "dist/locales")

# Register the static route for serving our React app assets
if os.path.exists(dist_path):
    # Also register the standard ComfyUI extension web directory

    project_name = os.path.basename(workspace_path)

    try:
        # Method added in https://github.com/comfyanonymous/ComfyUI/pull/8357
        from comfy_config import config_parser

        project_config = config_parser.extract_node_configuration(workspace_path)
        project_name = project_config.project.name
    except Exception as e:
        print(
            f"Could not load project config, using default name '{project_name}': {e}"
        )

    nodes.EXTENSION_WEB_DIRS[project_name] = os.path.join(workspace_path, "dist")
else:
    print("ComfyUI Teleport: Web directory not found")
