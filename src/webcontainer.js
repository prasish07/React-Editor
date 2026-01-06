import { WebContainer } from "@webcontainer/api";

let webcontainer;
let bootingPromise = null;

export async function bootWebContainer() {
  // If already booted, return it
  if (webcontainer) return webcontainer;

  // If currently booting, wait for that to complete
  if (bootingPromise) return bootingPromise;

  // Start booting
  bootingPromise = WebContainer.boot()
    .then((container) => {
      webcontainer = container;
      bootingPromise = null;
      return container;
    })
    .catch((error) => {
      bootingPromise = null;
      throw error;
    });

  return bootingPromise;
}
