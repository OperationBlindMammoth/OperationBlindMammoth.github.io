/**
 * Densmore Drone Services - Google Ads Analyzer & GitHub Bridge
 * 
 * Functions:
 * 1. Export Campaign Performance (30-day summary) -> 'Campaign_Overview'
 * 2. Export Daily Performance (Day-by-day breakdown) -> 'Daily_Performance'
 * 3. Export Search Terms Report -> 'Search_Terms_Report'
 * 4. Export Active Keywords -> 'Active_Keywords'
 * 5. Pull Negative Keywords from GitHub negatives.txt & apply -> 'Negative_Keywords_Active'
 * 6. Pull Target Keywords from GitHub keywords.txt & add to General LiDAR -> 'Keywords_Added_Active'
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

function syncPositiveKeywordsFromGitHub(ss) {
  let sheet = ss.getSheetByName("Keywords_Added_Active") || ss.insertSheet("Keywords_Added_Active");
  sheet.clear();
  sheet.appendRow(["Target Keyword", "Ad Group", "Status", "Date Applied"]);
  sheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#d9ead3");

  try {
    const response = UrlFetchApp.fetch(GITHUB_KEYWORDS_URL);
    const rawText = response.getContentText();
    const lines = rawText.split("\n");

    const adGroups = AdsApp.adGroups().withCondition("Name = 'General LiDAR'").get();
    if (!adGroups.hasNext()) {
      Logger.log("Ad group 'General LiDAR' not found.");
      return;
    }
    const generalLidarAdGroup = adGroups.next();

    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#")) continue;

      try {
        generalLidarAdGroup.newKeywordBuilder().withText(line).build();
        sheet.appendRow([line, "General LiDAR", "Successfully Added", new Date().toLocaleDateString()]);
        count++;
      } catch (err) {
        // Keyword likely already exists
        sheet.appendRow([line, "General LiDAR", "Already Present", new Date().toLocaleDateString()]);
      }
    }
    Logger.log(">>> Successfully processed " + count + " target keywords from GitHub into General LiDAR!");
  } catch (err) {
    Logger.log("Error syncing target keywords from GitHub: " + err);
  }
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
