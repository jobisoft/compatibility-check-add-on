/**
 * Attribution:
 * - initially created by John Bieling
 * - maintained 2021, 2022, 2023, 2024 and 2025 by Klaus Buecher/opto
 * - Icons from https://www.freepik.com and from https://www.flaticon.com/
 * - versioncompare from https://jsfiddle.net/vanowm/p7uvtbor/
 */

import * as utils from "./modules/utils.mjs"

// Enforce database rebuild every 24h.
// This value is also queried by the utils.mjs module.
var rebuildIntervalInMinutes = 24 * 60;

// Enable debug mode in production (it is enabled automatically in add-on debug
// install mode). This value is queried by the log.mjs module (one could set it
// there directly).
var debug = false;

// Hide browserAction label if supported.
if (browser.browserAction.setLabel) {
  browser.browserAction.setLabel({ label: "" });
}

// Schedule rebuilds.
browser.alarms.create("update", { periodInMinutes: rebuildIntervalInMinutes });
browser.alarms.onAlarm.addListener((alarm) => utils.checkAddons({ action: "rebuild" }));
// The following needs to update the button and the local information, but no need
// to query remote servers.
browser.management.onInstalled.addListener((info) => utils.checkAddons({ action: "installed", info }));
browser.management.onUninstalled.addListener((info) => utils.checkAddons({ action: "uninstalled", info }));
browser.management.onEnabled.addListener((info) => utils.checkAddons({ action: "enabled", info }));
browser.management.onDisabled.addListener((info) => utils.checkAddons({ action: "disabled", info }));

utils.checkAddons({ delay: false });
