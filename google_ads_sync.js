/**
 * Densmore Drone Services - Google Ads Analyzer & GitHub Negative Bridge
 * 
 * Functions:
 * 1. Export Campaign Performance (30-day cumulative summary) -> 'Campaign_Overview'
 * 2. Export Daily Performance (Day-by-day breakdown) -> 'Daily_Performance'
 * 3. Export Search Terms Report -> 'Search_Terms_Report'
 * 4. Export Active Keywords -> 'Active_Keywords'
 * 5. Pull Negative Keywords from GitHub negatives.txt & apply to campaigns -> 'Negative_Keywords_Active'
 */

const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1OvSHBe9QoQ1BSwURiNNgbdwzQ6ATlvG8X3gHCZXBoMk/edit";
const GITHUB_NEGATIVES_URL = "https://raw.githubusercontent.com/OperationBlindMammoth/OperationBlindMammoth.github.io/main/negatives.txt";

function main() {
  Logger.log("Starting Densmore Drone Services Google Ads Sync...");
  
  const spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);

  // 1. Export 30-Day Campaign Performance Overview
  exportCampaignPerformance(spreadsheet);

  // 2. Export Day-by-Day Performance (New!)
  exportDailyPerformance(spreadsheet);

  // 3. Export Search Terms (With Ad Group Name)
  exportSearchTerms(spreadsheet);

  // 4. Export Active Keywords (With Ad Group Name)
  exportKeywords(spreadsheet);

  // 5. Pull Negative Keywords directly from GitHub and apply them!
  syncNegativeKeywordsFromGitHub(spreadsheet);

  Logger.log(">>> Finished successfully! Dashboard URL: " + spreadsheet.getUrl());
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
  let count = 0;
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
    count++;
  }
  Logger.log("Exported " + count + " daily performance rows.");
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
      // Skip empty lines or comment lines starting with #
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
    Logger.log("Error syncing from GitHub: " + err);
  }
}
