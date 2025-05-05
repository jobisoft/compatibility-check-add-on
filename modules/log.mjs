// Enable debug mode on debug installs.
const self = await messenger.management.getSelf();

// A simple log wrapper.
export function log(...args) {
    let page = browser.extension.getBackgroundPage();

    if (page.debug || self.installType == "development") {
        console.log("[Add-on Compatibility Checker]", ...args);
    }
}
