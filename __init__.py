import os

import nodes
import server
from aiohttp import web


class Teleport:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("image",)
    FUNCTION = "execute"
    CATEGORY = "image"
    OUTPUT_NODE = True

    def execute(self, image):
        return {"ui": {"my_custom_text": ["Update info here"]}, "result": (image,)}


NODE_CLASS_MAPPINGS = {
    "Teleport": Teleport,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Teleport": "Teleport",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]

# Define the path to our extension
workspace_path = os.path.dirname(__file__)
dist_path = os.path.join(workspace_path, "dist")
dist_locales_path = os.path.join(workspace_path, "dist/locales")

# Print the current paths for debugging
print(f"ComfyUI Teleport workspace path: {workspace_path}")
print(f"Dist path: {dist_path}")
print(f"Dist locales path: {dist_locales_path}")
print(f"Locales exist: {os.path.exists(dist_locales_path)}")

# Register the static route for serving our React app assets
if os.path.exists(dist_path):
    # Add the routes for the extension
    server.PromptServer.instance.app.add_routes(
        [
            web.static("/teleport/", dist_path),
        ]
    )

    # Register the locale files route
    if os.path.exists(dist_locales_path):
        server.PromptServer.instance.app.add_routes(
            [
                web.static("/locales/", dist_locales_path),
            ]
        )
        print("Registered locale files route at /locales/")
    else:
        print("WARNING: Locale directory not found!")

    # Also register the standard ComfyUI extension web directory

    project_name = os.path.basename(workspace_path)

    try:
        # Method added in https://github.com/comfyanonymous/ComfyUI/pull/8357
        from comfy_config import config_parser

        project_config = config_parser.extract_node_configuration(workspace_path)
        project_name = project_config.project.name
        print(f"project name read from pyproject.toml: {project_name}")
    except Exception as e:
        print(
            f"Could not load project config, using default name '{project_name}': {e}"
        )

    nodes.EXTENSION_WEB_DIRS[project_name] = os.path.join(workspace_path, "dist")
else:
    print("ComfyUI Teleport: Web directory not found")
