/**
 * Densmore Drone Services - Google Ads Data Exporter (Step 1 of 2)
 * 
 * SCHEDULE IN GOOGLE ADS: Daily at ~5:00 PM
 * 
 * PURPOSE:
 * Exports current day and 30-day performance data, search terms, and active keywords
 * to the Google Sheets dashboard BEFORE the 6:00 PM Antigravity AI audit.
 * 
 * OUTPUT SHEETS:
 * 1. 'Campaign_Overview' - 30-day summary by campaign
 * 2. 'Daily_Performance' - Day-by-day impressions, clicks, CPC, cost
 * 3. 'Search_Terms_Report' - Exact search queries that triggered ads
 * 4. 'Active_Keywords' - Status and metrics of all bidding keywords
 */

const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1OvSHBe9QoQ1BSwURiNNgbdwzQ6ATlvG8X3gHCZXBoMk/edit";

function main() {
  Logger.log(">>> [5:00 PM] Starting Densmore Drone Services Data Export...");
  
  const spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);

  // 1. Export 30-Day Campaign Performance Overview
  exportCampaignPerformance(spreadsheet);

  // 2. Export Day-by-Day Performance (includes today's latest data)
  exportDailyPerformance(spreadsheet);

  // 3. Export Search Terms Report (identifies leaks & winning search queries)
  exportSearchTerms(spreadsheet);

  // 4. Export Active Keywords Report
  exportKeywords(spreadsheet);

  Logger.log(">>> [5:00 PM] Export complete! Dashboard updated: " + spreadsheet.getUrl());
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
