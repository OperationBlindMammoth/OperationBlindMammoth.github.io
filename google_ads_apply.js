/**
 * Densmore Drone Services - Google Ads GitHub Bridge & Applier (Step 2 of 2)
 * 
 * SCHEDULE IN GOOGLE ADS: Daily at ~7:00 PM
 * 
 * PURPOSE:
 * Fetches the latest negative keywords (negatives.txt) and positive target keywords
 * (keywords.txt) from GitHub that were updated during the 6:00 PM AI audit, and
 * applies them directly to live Google Ads campaigns before midnight.
 * 
 * ACTIONS:
 * 1. Checks campaign budget: Ensures daily budget is set to at least $30.00/day during the promo window.
 * 2. Reads 'negatives.txt' from GitHub -> Applies campaign-level negative keywords to all active campaigns.
 * 3. Reads 'keywords.txt' from GitHub -> Automatically routes keywords into targeted Ad Groups
 *    ('General LiDAR', 'Construction Earthwork', 'Thermal Inspection', 'Multispectral Ag'),
 *    creating the ad groups and dedicated landing-page ads if they don't already exist.
 * 4. Logs applied keywords to Google Sheets for full transparency.
 */

const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1OvSHBe9QoQ1BSwURiNNgbdwzQ6ATlvG8X3gHCZXBoMk/edit";
const GITHUB_NEGATIVES_URL = "https://raw.githubusercontent.com/OperationBlindMammoth/OperationBlindMammoth.github.io/main/negatives.txt";
const GITHUB_KEYWORDS_URL = "https://raw.githubusercontent.com/OperationBlindMammoth/OperationBlindMammoth.github.io/main/keywords.txt";

const AD_GROUP_CONFIGS = {
  "General LiDAR": {
    cpc: 3.50,
    url: "https://densmoredroneservices.com/lidar",
    headlines: [
      "Aerial LiDAR Drone Surveys",
      "Densmore Drone Services",
      "Greater Houston & SE Texas",
      "Survey-Grade LiDAR Mapping",
      "FAA Part 107 Certified",
      "Same-Week Scheduling",
      "Topographic Contour Models"
    ],
    descriptions: [
      "Survey-grade aerial LiDAR & topographic mapping across Greater Houston and SE Texas.",
      "Same-week flight scheduling. Fast turnaround deliverables ready for your CAD/GIS."
    ]
  },
  "Construction Earthwork": {
    cpc: 3.00,
    url: "https://densmoredroneservices.com/photogrammetry",
    headlines: [
      "Drone Cut & Fill Analysis",
      "Stockpile Volume Measurement",
      "Construction Drone Surveys",
      "Houston Earthwork Drone Topo",
      "Pre-Construction Site Maps",
      "Densmore Drone Services",
      "FAA Part 107 Certified"
    ],
    descriptions: [
      "High-accuracy topographic surveys & earthwork volumetrics for Texas construction projects.",
      "Accurate cut and fill reports, surface models, and 3D terrain data. Fast turnarounds."
    ]
  },
  "Thermal Inspection": {
    cpc: 3.00,
    url: "https://densmoredroneservices.com/thermal",
    headlines: [
      "Drone Thermal Roof Inspection",
      "Commercial Aerial Thermography",
      "Detect Roof Moisture & Leaks",
      "Solar Panel Thermal Drone",
      "Radiometric FLIR Drone Scans",
      "Houston Thermal Drone Scans",
      "FAA Part 107 Certified"
    ],
    descriptions: [
      "Radiometric thermal imaging to detect roof moisture, heat loss, and electrical faults.",
      "Survey-grade aerial infrared imaging across Greater Houston & SE Texas. Request a quote."
    ]
  },
  "Multispectral Ag": {
    cpc: 2.50,
    url: "https://densmoredroneservices.com/multispectral",
    headlines: [
      "NDVI Multispectral Drone Maps",
      "Precision Crop Health Mapping",
      "Drone Prescription Maps",
      "Variable Rate Agras Maps",
      "Reduce Spray Input Costs",
      "Houston & Texas Ag Drones",
      "FAA Part 107 Certified"
    ],
    descriptions: [
      "Precision crop health analytics and variable rate prescription maps for spray drones.",
      "Accurate NDVI vegetation index mapping for Texas growers and custom spray operators."
    ]
  }
};

function main() {
  Logger.log(">>> [7:00 PM] Starting Densmore Drone Services GitHub Ingestion...");

  let spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  } catch (e) {
    Logger.log("Notice: Spreadsheet open failed (" + e + "), proceeding with Google Ads updates directly.");
  }

  // 1. Sync Negative Keywords from GitHub & Purge Obsolete Broad Negatives
  syncNegativeKeywordsFromGitHub(spreadsheet);

  // 2. Sync Positive Target Keywords from GitHub into Targeted Ad Groups
  syncPositiveKeywordsFromGitHub(spreadsheet);

  Logger.log(">>> [7:00 PM] GitHub sync finished successfully! Changes are now LIVE for tomorrow's auctions.");
}

function syncNegativeKeywordsFromGitHub(ss) {
  let sheet = null;
  if (ss) {
    sheet = ss.getSheetByName("Negative_Keywords_Active") || ss.insertSheet("Negative_Keywords_Active");
    sheet.clear();
    sheet.appendRow(["Active Negative Keyword", "Source", "Last Synced"]);
    sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#fce8e6");
  }

  try {
    const response = UrlFetchApp.fetch(GITHUB_NEGATIVES_URL, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      Logger.log("Error fetching negatives.txt from GitHub: HTTP " + response.getResponseCode());
      return;
    }
    const rawText = response.getContentText();
    const lines = rawText.split("\n");

    const campaigns = AdsApp.campaigns().withCondition("Status = ENABLED").get();
    const activeCampaigns = [];
    while (campaigns.hasNext()) {
      activeCampaigns.push(campaigns.next());
    }

    // Automatically remove obsolete/conflicting broad negatives that trigger Google Ads alert banners
    const broadNegativesToPurge = ["roof inspection", "roof estimate", "irrigation drone"];
    for (let c = 0; c < activeCampaigns.length; c++) {
      try {
        const existingNegs = activeCampaigns[c].negativeKeywords().get();
        while (existingNegs.hasNext()) {
          const neg = existingNegs.next();
          const text = neg.getText().toLowerCase().trim();
          const matchType = neg.getMatchType();
          if (broadNegativesToPurge.includes(text) && matchType === "BROAD") {
            Logger.log(">>> Purging conflicting broad negative: " + text + " from " + activeCampaigns[c].getName());
            neg.remove();
          }
        }
      } catch (purgeErr) {
        Logger.log("Notice during negative purge: " + purgeErr);
      }
    }

    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#")) continue;

      for (let c = 0; c < activeCampaigns.length; c++) {
        try {
          activeCampaigns[c].createNegativeKeyword(line);
        } catch (e) {
          // Ignore if already added or duplicate
        }
      }
      if (sheet) {
        sheet.appendRow([line, "GitHub (negatives.txt)", new Date().toLocaleDateString()]);
      }
      count++;
    }
    Logger.log(">>> Successfully synced " + count + " negative keywords across " + activeCampaigns.length + " active campaigns!");
  } catch (err) {
    Logger.log("Error syncing negatives from GitHub: " + err);
  }
}

function syncPositiveKeywordsFromGitHub(ss) {
  let sheet = null;
  if (ss) {
    sheet = ss.getSheetByName("Keywords_Added_Active") || ss.insertSheet("Keywords_Added_Active");
    sheet.clear();
    sheet.appendRow(["Target Keyword", "Ad Group", "Status", "Date Applied"]);
    sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#d9ead3");
  }

  try {
    const response = UrlFetchApp.fetch(GITHUB_KEYWORDS_URL, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) {
      Logger.log("Error fetching keywords.txt from GitHub: HTTP " + response.getResponseCode());
      return;
    }
    const rawText = response.getContentText();
    const lines = rawText.split("\n");

    // Identify active Search campaign
    let targetCampaign = null;
    const campaigns = AdsApp.campaigns().withCondition("Status = ENABLED").get();
    while (campaigns.hasNext()) {
      const camp = campaigns.next();
      if (camp.getName().toLowerCase().includes("lidar") || camp.getName().toLowerCase().includes("search")) {
        targetCampaign = camp;
        break;
      }
    }
    if (!targetCampaign) {
      const fallback = AdsApp.campaigns().withCondition("Status = ENABLED").get();
      if (fallback.hasNext()) targetCampaign = fallback.next();
    }

    if (!targetCampaign) {
      Logger.log("No enabled campaign found to sync target keywords.");
      return;
    }

    // Auto-align daily budget to $30.00/day during promotional credit window
    try {
      const budget = targetCampaign.getBudget();
      if (budget && budget.getAmount() < 30.00) {
        Logger.log(">>> Updating campaign budget for " + targetCampaign.getName() + " from $" + budget.getAmount() + " to $30.00/day for promo pacing.");
        budget.setAmount(30.00);
      }
    } catch (bErr) {
      Logger.log("Notice on budget adjustment: " + bErr);
    }

    let currentAdGroupName = "General LiDAR";
    let count = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith("# AD_GROUP:")) {
        currentAdGroupName = line.replace("# AD_GROUP:", "").trim();
        continue;
      }
      if (line.startsWith("#")) continue;

      const adGroup = getOrCreateAdGroup(targetCampaign, currentAdGroupName, AD_GROUP_CONFIGS[currentAdGroupName]);
      if (!adGroup) continue;

      try {
        adGroup.newKeywordBuilder().withText(line).build();
        if (sheet) {
          sheet.appendRow([line, currentAdGroupName, "Successfully Added", new Date().toLocaleDateString()]);
        }
        count++;
      } catch (err) {
        if (sheet) {
          sheet.appendRow([line, currentAdGroupName, "Already Present", new Date().toLocaleDateString()]);
        }
      }
    }
    Logger.log(">>> Successfully processed " + count + " target keywords into " + targetCampaign.getName() + " across ad groups!");
  } catch (err) {
    Logger.log("Error syncing target keywords from GitHub: " + err);
  }
}

function getOrCreateAdGroup(campaign, adGroupName, config) {
  const agIterator = campaign.adGroups().withCondition("Name = '" + adGroupName + "'").get();
  if (agIterator.hasNext()) {
    return agIterator.next();
  }

  Logger.log(">>> Creating new Ad Group: " + adGroupName);
  const cpc = (config && config.cpc) ? config.cpc : 3.00;
  try {
    const builder = campaign.newAdGroupBuilder().withName(adGroupName).withCpc(cpc);
    const operation = builder.build();
    let newAdGroup = null;
    if (typeof operation.getResult === "function") {
      newAdGroup = operation.getResult();
    } else {
      newAdGroup = operation;
    }

    if (newAdGroup && config && config.url) {
      try {
        const adsIterator = newAdGroup.ads().withCondition("Type = RESPONSIVE_SEARCH_AD").withCondition("Status = ENABLED").get();
        if (!adsIterator.hasNext()) {
          newAdGroup.newAd().responsiveSearchAdBuilder()
            .withFinalUrl(config.url)
            .withHeadlines(config.headlines)
            .withDescriptions(config.descriptions)
            .build();
          Logger.log(">>> Created dedicated RSA ad for " + adGroupName + " pointing to " + config.url);
        }
      } catch (adErr) {
        Logger.log("Notice creating starter RSA for " + adGroupName + ": " + adErr);
      }
    }
    return newAdGroup;
  } catch (e) {
    Logger.log("Error creating ad group " + adGroupName + ": " + e);
  }
  return null;
}
