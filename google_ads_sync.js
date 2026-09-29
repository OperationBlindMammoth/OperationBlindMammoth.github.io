/**
 * Densmore Drone Services - Google Ads Analyzer & GitHub Bridge (Combined / Manual)
 * 
 * NOTE: For automated daily scheduling, this process is split into two timed scripts:
 * 1. google_ads_export.js -> Scheduled daily at ~5:00 PM (Dumps fresh day metrics to Sheets)
 *    [Antigravity AI audits the sheet at 6:00 PM and updates negatives.txt on GitHub]
 * 2. google_ads_apply.js  -> Scheduled daily at ~7:00 PM (Applies GitHub negatives/keywords live)
 * 
 * This file remains available for running all operations at once manually if needed.
 */

const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1OvSHBe9QoQ1BSwURiNNgbdwzQ6ATlvG8X3gHCZXBoMk/edit";
const GITHUB_NEGATIVES_URL = "https://raw.githubusercontent.com/OperationBlindMammoth/OperationBlindMammoth.github.io/main/negatives.txt";
const GITHUB_KEYWORDS_URL = "https://raw.githubusercontent.com/OperationBlindMammoth/OperationBlindMammoth.github.io/main/keywords.txt";

function main() {
  Logger.log("Starting Densmore Drone Services Full Automation Sync...");
  
  const spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);

  // 1. Sync Negative Keywords from GitHub
  syncNegativeKeywordsFromGitHub(spreadsheet);

  // 2. Sync Positive Target Keywords from GitHub into General LiDAR
  syncPositiveKeywordsFromGitHub(spreadsheet);

  // 3. Export 30-Day Campaign Performance Overview
  exportCampaignPerformance(spreadsheet);

  // 4. Export Day-by-Day Performance
  exportDailyPerformance(spreadsheet);

  // 5. Export Search Terms Report
  exportSearchTerms(spreadsheet);

  // 6. Export Active Keywords Report
  exportKeywords(spreadsheet);

  Logger.log(">>> Full Sync finished successfully! Dashboard: " + spreadsheet.getUrl());
}

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
      "Save ~20% on Spray Chemicals",
      "Houston & Texas Ag Drones",
      "FAA Part 107 Certified"
    ],
    descriptions: [
      "Precision crop health analytics and variable rate prescription maps for spray drones.",
      "Accurate NDVI vegetation index mapping for Texas growers and custom spray operators."
    ]
  }
};

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

function syncNegativeKeywordsFromGitHub(ss) {
  let sheet = ss.getSheetByName("Negative_Keywords_Active") || ss.insertSheet("Negative_Keywords_Active");
  sheet.clear();
  sheet.appendRow(["Active Negative Keyword", "Source", "Last Synced"]);
  sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#fce8e6");

  try {
    const response = UrlFetchApp.fetch(GITHUB_NEGATIVES_URL);
    const rawText = response.getContentText();
    const lines = rawText.split("\n");

    const campaigns = AdsApp.campaigns().withCondition("Status = ENABLED").get();
    const activeCampaigns = [];
    while (campaigns.hasNext()) {
      activeCampaigns.push(campaigns.next());
    }

    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#")) continue;

      for (let c = 0; c < activeCampaigns.length; c++) {
        try {
          activeCampaigns[c].createNegativeKeyword(line);
        } catch (e) {
          // Ignore if already added
        }
      }
      sheet.appendRow([line, "GitHub (negatives.txt)", new Date().toLocaleDateString()]);
      count++;
    }
    Logger.log(">>> Successfully synced " + count + " negative keywords from GitHub!");
  } catch (err) {
    Logger.log("Error syncing negatives from GitHub: " + err);
  }
}

function exportCampaignPerformance(ss) {
  let sheet = ss.getSheetByName("Campaign_Overview") || ss.insertSheet("Campaign_Overview");
  sheet.clear();
  sheet.appendRow(["Campaign Name", "Status", "Impressions", "Clicks", "CTR (%)", "Avg CPC ($)", "Total Cost ($)", "Conversions"]);
  sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#e6f4ea");

  const query = `
    SELECT campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS AND campaign.status != 'REMOVED'
  `;

  const rows = AdsApp.search(query);
  while (rows.hasNext()) {
    const row = rows.next();
    sheet.appendRow([
      row.campaign.name, row.campaign.status, row.metrics.impressions, row.metrics.clicks,
      (row.metrics.ctr * 100).toFixed(2) + "%",
      (row.metrics.averageCpc / 1000000).toFixed(2),
      (row.metrics.costMicros / 1000000).toFixed(2),
      row.metrics.conversions
    ]);
  }
}

function exportDailyPerformance(ss) {
  let sheet = ss.getSheetByName("Daily_Performance") || ss.insertSheet("Daily_Performance");
  sheet.clear();
  sheet.appendRow(["Date", "Campaign Name", "Impressions", "Clicks", "CTR (%)", "Avg CPC ($)", "Cost ($)", "Conversions"]);
  sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#ede7f6");

  const query = `
    SELECT segments.date, campaign.name, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.cost_micros, metrics.conversions
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS AND campaign.status != 'REMOVED'
    ORDER BY segments.date DESC, campaign.name ASC
  `;

  const rows = AdsApp.search(query);
  while (rows.hasNext()) {
    const row = rows.next();
    sheet.appendRow([
      row.segments.date,
      row.campaign.name,
      row.metrics.impressions,
      row.metrics.clicks,
      (row.metrics.ctr * 100).toFixed(2) + "%",
      (row.metrics.averageCpc / 1000000).toFixed(2),
      (row.metrics.costMicros / 1000000).toFixed(2),
      row.metrics.conversions
    ]);
  }
}

function exportSearchTerms(ss) {
  let sheet = ss.getSheetByName("Search_Terms_Report") || ss.insertSheet("Search_Terms_Report");
  sheet.clear();
  sheet.appendRow(["Ad Group", "Search Term", "Match Type", "Impressions", "Clicks", "Avg CPC ($)", "Total Cost ($)", "Conversions"]);
  sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#e8f0fe");

  const query = `
    SELECT ad_group.name, search_term_view.search_term, segments.search_term_match_type, metrics.impressions, metrics.clicks, metrics.average_cpc, metrics.cost_micros, metrics.conversions
    FROM search_term_view
    WHERE segments.date DURING LAST_30_DAYS
    ORDER BY metrics.cost_micros DESC
  `;

  const rows = AdsApp.search(query);
  while (rows.hasNext()) {
    const row = rows.next();
    sheet.appendRow([
      row.adGroup.name, row.searchTermView.searchTerm, row.segments.searchTermMatchType,
      row.metrics.impressions, row.metrics.clicks,
      (row.metrics.averageCpc / 1000000).toFixed(2),
      (row.metrics.costMicros / 1000000).toFixed(2),
      row.metrics.conversions
    ]);
  }
}

function exportKeywords(ss) {
  let sheet = ss.getSheetByName("Active_Keywords") || ss.insertSheet("Active_Keywords");
  sheet.clear();
  sheet.appendRow(["Ad Group", "Keyword", "Match Type", "Status", "Impressions", "Clicks", "Avg CPC ($)", "Total Cost ($)", "Conversions"]);
  sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#fef7e0");

  const query = `
    SELECT ad_group.name, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, metrics.impressions, metrics.clicks, metrics.average_cpc, metrics.cost_micros, metrics.conversions
    FROM keyword_view
    WHERE segments.date DURING LAST_30_DAYS AND ad_group_criterion.status != 'REMOVED'
    ORDER BY ad_group.name ASC, metrics.clicks DESC
  `;

  const rows = AdsApp.search(query);
  while (rows.hasNext()) {
    const row = rows.next();
    sheet.appendRow([
      row.adGroup.name, row.adGroupCriterion.keyword.text, row.adGroupCriterion.keyword.matchType,
      row.adGroupCriterion.status, row.metrics.impressions, row.metrics.clicks,
      (row.metrics.averageCpc / 1000000).toFixed(2),
      (row.metrics.costMicros / 1000000).toFixed(2),
      row.metrics.conversions
    ]);
  }
}
