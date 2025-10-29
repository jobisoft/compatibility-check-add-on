/**
 * Attribution:
 * - initially created by John Bieling
 * - maintained 2021, 2022, 2023, 2024 and 2025 by Klaus Buecher/opto
 * - Icons from https://www.freepik.com and from https://www.flaticon.com/
 * - versioncompare from https://jsfiddle.net/vanowm/p7uvtbor/
 */

import * as utils from "./modules/utils.mjs"

// Init badge with neutral state.
await messenger.browserAction.setBadgeText({ text: "…" });
await messenger.browserAction.setBadgeBackgroundColor({ color: "blue" });
await messenger.browserAction.disable();

// Determine if build is ESR and store this information for later use.
const { buildID } = await browser.runtime.getBrowserInfo();
const buildInfo = await utils.getBuildById(buildID);
const buildIsESR = buildInfo?.version?.endsWith("esr") || false;
await browser.storage.session.set({ buildIsESR });

// Store major local version for later use.
const majorLocalVersion = await browser.runtime.getBrowserInfo()
    .then(rv => rv.version)
    .then(rv => rv.split(".").at(0))
    .then(rv => parseInt(rv, 10));
await browser.storage.session.set({ majorLocalVersion });

// Schedule rebuilds.
browser.alarms.create("update", { periodInMinutes: utils.REBUILD_INTERVAL_IN_MINUTES });
browser.alarms.onAlarm.addListener((alarm) => utils.checkAddons({ action: "rebuild" }));
// The following needs to update the button and the local information, but no need
// to query remote servers.
browser.management.onInstalled.addListener((info) => utils.checkAddons({ action: "installed", info }));
browser.management.onUninstalled.addListener((info) => utils.checkAddons({ action: "uninstalled", info }));
browser.management.onEnabled.addListener((info) => utils.checkAddons({ action: "enabled", info }));
browser.management.onDisabled.addListener((info) => utils.checkAddons({ action: "disabled", info }));

utils.checkAddons({ delay: false });
