// ComfyUI automatically loads every js file in the extension folder into the host window,
// including this file, so we need to check if we're in the client window before actually
// running the client code.
if (location.pathname.includes("client.html")) {
  void import("./client")
}
