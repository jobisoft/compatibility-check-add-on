// Enable debug mode on debug installs.
const self = await messenger.management.getSelf();

// Enable debug mode in production (it is enabled automatically in add-on debug
// install mode).
const debug = false;

// A simple log wrapper.
export function log(...args) {
    if (debug || self.installType == "development") {
        console.log("[Add-on Compatibility Checker]", ...args);
    }
}
