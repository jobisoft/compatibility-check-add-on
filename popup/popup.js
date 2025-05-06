import { log } from "../modules/log.mjs"
import { compareVer } from "../modules/utils.mjs";

const BEST_ICON_SIZE = 32;

const RELEASE_COMPATIBLE_CERTAIN = 8;
const RELEASE_COMPATIBLE_UNCERTAIN = 4;
const NEXT_ESR_COMPATIBLE = 2;
const ESR_COMPATIBLE = 1;

function findBestSize(icons) {
  if (!icons) {
    return "https://addons.thunderbird.net/static/img/addon-icons/default-32.png";
  }

  const allIcons = Object
    .entries(icons)
    .map(e => ({ size: e[0], url: e[1] }));
  const bestIcon = allIcons.reduce(
    (acc, cur) => Math.abs(BEST_ICON_SIZE - cur.size) < Math.abs(BEST_ICON_SIZE - acc.size) ? cur : acc,
    { size: 0, url: allIcons[0].url }
  );
  return bestIcon.url;
}

function getDataForAddonId(id, reportData) {
  if (!reportData) {
    return null;
  }
  let data = reportData.addons.find(e => e.id == id);
  if (!data) {
    return null
  }
  return data;
}

async function onLoad() {
  // Localize.
  for (let element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = browser.i18n.getMessage(element.dataset.i18n);
  }

  let { reportData } = await messenger.storage.local.get({ reportData: null });
  let { lastCheck } = await messenger.storage.local.get({ lastCheck: 0 });

  let lastUpdate = new Date(reportData.generated);
  document.getElementById("lastUpdate").textContent = lastUpdate.toLocaleString();

  let { addonData } = await messenger.storage.local.get({ addonData: null });
  log({ addonData });
  if (!addonData) {
    let infoElement = document.getElementById("info");
    infoElement.style.display = "block";
    return;
  }

  let tableElement = document.getElementById("compatibilityTable");
  let esrOnlyExperiments = 0;
  let releaseExperiments = 0;
  let releaseIncompatible = 0;
  let webextensions = 0;
  let unknown = 0;

  let columns = new Map();
  let rows = [];
  let html = [];

  const TYPE_MAP = {
    "release": "Release",
    "next-esr": "next&nbsp;ESR",
    "current-esr": "ESR"
  }

  for (let addon of Object.values(addonData)) {
    webextensions++;

    let compatibilityRating = 0;
    for (let type of Object.keys(TYPE_MAP)) {
      let compatEntry = addon.compat.find(e => e.type == type);
      if (compatEntry?.extVersion) {
        if (type == "current-esr") {
          compatibilityRating += ESR_COMPATIBLE;
        }
        if (type == "next-esr") {
          compatibilityRating += NEXT_ESR_COMPATIBLE;
        }
        if (type == "release") {
          if (!compatEntry.isExperiment || addon.dedicatedSupportOnRelease) {
            compatibilityRating += RELEASE_COMPATIBLE_CERTAIN;
          } else {
            compatibilityRating += RELEASE_COMPATIBLE_UNCERTAIN;
          }
        }
      }
    }

    let displayName = addon.name;
    let release = addon.compat.find(e => e.type == "release");
    let isReleaseIncompatible = (!release || !release.extVersion);
    let isReleaseExperiment = release && release.isExperiment && addon.dedicatedSupportOnRelease;
    let isEsrOnlyExperiment = release && release.isExperiment && !addon.dedicatedSupportOnRelease;

    if (isReleaseIncompatible) {
      releaseIncompatible++;
    }

    if (isReleaseExperiment) {
      releaseExperiments++;
      displayName = `<div style="display: flex; flex-direction: column;">
                <span>${addon.name}</span>
                <span style="font-size: 0.85em; color: #666;">Experiment/Legacy Add-on (${browser.i18n.getMessage("subtext_committed_to_monthly")
        })</span>
              </div>`
    }

    if (isEsrOnlyExperiment) {
      esrOnlyExperiments++;
      displayName = `<div style="display: flex; flex-direction: column;">
                <span>${addon.name}</span>
                <span style="font-size: 0.85em; color: #666;">Experiment/Legacy Add-on</span>
              </div>`
    }

    if (isReleaseIncompatible && addon.alternatives?.length > 0) {
      // Filter for alternatives compatible with Release.
      let alternative = addon.alternatives.find(alt => {
        if (alt.name && alt.link && !alt.id) {
          // This is a now a built-in feature.
          return true;
        }

        let data = getDataForAddonId(alt.id, reportData);
        return (data && data.compat.find(e => e.type == "release")?.extVersion);
      })

      if (alternative?.name) {
        displayName = `<div style="display: flex; flex-direction: column;">
                  <span>${addon.name}</span>
                  <span style="font-size: 0.85em; color: #666;">${browser.i18n.getMessage("subtext_alternative")}: ${alternative.id && alternative.link
            ? `<a href="${alternative.link}">${alternative.name}</a>`
            : alternative.link
              ? `<a href="https://extension-finder.thunderbird.net/?id=${encodeURIComponent(addon.id)}&q=${encodeURIComponent(addon.name)}">${alternative.name}</a>`
              : `${alternative.name}`
          }</span>
                </div>`
      }
    }

    if (addon.isUnknown) {
      unknown++;
      displayName = `<div style="display: flex; flex-direction: column;">
      <span>${addon.name}</span>
      <span style="font-size: 0.85em; color: #666;">${browser.i18n.getMessage("subtext_not_listed")}</span>
    </div>`
    }

    let cells = new Map();
    cells.set("icon", `<td><img width="${BEST_ICON_SIZE}" src="${findBestSize(addon.icons)}"></td>`);
    cells.set("name", `<td>${displayName}</td>`);

    addon.compat.forEach(e => {
      const compatible = !!e.extVersion;
      const classes = [];
      if (e.experiment) classes.push("experiment");
      if (compatible) {
        classes.push("compatible");
      } else {
        classes.push("incompatible");
      }

      let title = `compatible version: ${compatible ? `v${e.extVersion}` : "none"}`
      let value = compatible ? e.type == "release" && isEsrOnlyExperiment ? "(✔)" : "✔" : "❌"
      cells.set(
        e.type,
        `<td title="${title}" class="${classes.join(" ")}">${value}</td>`
      );
      // Keep track of available columns.
      columns.set(e.type, e.appVersion);
    });

    rows.push({ cells, compatibilityRating });
  }

  html.push("<thead>");
  html.push("<tr class='header'>")
  html.push(`<th colspan=2>${browser.i18n.getMessage("table_header")}</th>`);
  for (let type of ["current-esr", "next-esr", "release"]) {
    if (columns.has(type)) html.push(`<th>TB&nbsp;${columns.get(type)} (${TYPE_MAP[type]})</th>`)
  }
  html.push("</tr>")
  html.push("</thead>");
  html.push("<tbody>");

  rows.sort((a, b) => a.compatibilityRating - b.compatibilityRating);
  for (let { cells } of rows) {
    html.push(`<tr>`);
    html.push(cells.get("icon"));
    html.push(cells.get("name"));
    for (let type of ["current-esr", "next-esr", "release"]) {
      if (columns.has(type)) {
        if (cells.has(type)) {
          html.push(cells.get(type))
        } else {
          html.push(
            `<td title="${browser.i18n.getMessage("subtext_not_listed")}" class="unknown">❓</td>`
          )
        }
      }
    }
    html.push("</tr>")
  }
  html.push("</tbody>");

  tableElement.insertAdjacentHTML("afterbegin", html.join("\n"));
  tableElement.style.display = "block";

  log("results", { webextensions, esrOnlyExperiments, releaseIncompatible, unknown });

  let localVersion = await browser.runtime.getBrowserInfo().then(rv => rv.version);
  let localVersionIsRelease = compareVer(localVersion, columns.get("release")) >= 0;

  const box = document.querySelector('#status-box');
  if (
    webextensions > 0 &&
    !releaseIncompatible &&
    !esrOnlyExperiments &&
    !releaseExperiments &&
    !localVersionIsRelease
  ) { // only pure WebExtensions
    box.dataset.status = 'compatible';
    box.textContent = `${browser.i18n.getMessage("suggestion_upgrade_to_release")}`
  } else if (
    webextensions > 0 &&
    !releaseIncompatible &&
    !esrOnlyExperiments &&
    releaseExperiments > 0 &&
    !localVersionIsRelease
  ) { // only pure WebExtensions and supported Release-Experiments
    box.dataset.status = 'compatible';
    box.textContent = `${browser.i18n.getMessage("suggestion_upgrade_to_release")}`
  } else if (
    webextensions > 0 &&
    !releaseIncompatible &&
    esrOnlyExperiments > 0
  ) { // some ESR-only-Experiments
    box.dataset.status = 'incompatible';
    box.textContent = localVersionIsRelease
      ? browser.i18n.getMessage("suggestion_move_back_to_esr_unsupported_experiments")
      : browser.i18n.getMessage("suggestion_stay_on_esr_unsupported_experiments")
  } else if (
    webextensions > 0 &&
    releaseIncompatible > 0
  ) { // some incompatible
    box.dataset.status = 'incompatible';
    box.textContent = localVersionIsRelease
      ? browser.i18n.getMessage("suggestion_move_back_to_esr_incompatible")
      : browser.i18n.getMessage("suggestion_stay_on_esr_incompatible")
  }
}

await onLoad();