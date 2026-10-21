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

  // 5. Export Promo Credit Pacing Tracker (Spend $500 before Nov 27)
  exportPromoTracker(spreadsheet);

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

function exportPromoTracker(ss) {
  let sheet = ss.getSheetByName("Promo_Pacing_Tracker") || ss.insertSheet("Promo_Pacing_Tracker");
  sheet.clear();

  const PROMO_GOAL = 500.00;
  // Expiration deadline: Nov 27, 2026
  const PROMO_EXPIRY_DATE = new Date(2026, 10, 27, 23, 59, 59);
  const TODAY = new Date();

  // Query cumulative spend across all active and paused campaigns in the promo window
  const query = `
    SELECT campaign.name, metrics.cost_micros
    FROM campaign
    WHERE segments.date DURING LAST_60_DAYS AND campaign.status != 'REMOVED'
  `;

  let totalSpentMicros = 0;
  const rows = AdsApp.search(query);
  while (rows.hasNext()) {
    const row = rows.next();
    totalSpentMicros += row.metrics.costMicros;
  }

  const totalSpent = totalSpentMicros / 1000000;
  const remainingSpend = Math.max(0, PROMO_GOAL - totalSpent);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.max(1, Math.ceil((PROMO_EXPIRY_DATE.getTime() - TODAY.getTime()) / msPerDay));
  const requiredDailyRunRate = remainingSpend / daysLeft;

  sheet.appendRow(["Metric", "Value", "Notes"]);
  sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#cfe2ff");

  sheet.appendRow(["Promo Credit Goal", "$" + PROMO_GOAL.toFixed(2), "Target spend to claim $500 free match"]);
  sheet.appendRow(["Total Spend to Date", "$" + totalSpent.toFixed(2), "Cumulative account spend"]);
  sheet.appendRow(["Remaining Spend Needed", "$" + remainingSpend.toFixed(2), "Spend required before cutoff"]);
  sheet.appendRow(["Expiration Deadline", "November 27, 2026", "Promo credit expiration"]);
  sheet.appendRow(["Calendar Days Remaining", daysLeft.toString(), "Days left until deadline"]);
  sheet.appendRow(["Target Daily Run-Rate", "$" + requiredDailyRunRate.toFixed(2) + " / day", "Required average daily spend to hit $500"]);

  let status = "ON TRACK";
  if (totalSpent >= PROMO_GOAL) {
    status = "GOAL REACHED - $500 CREDIT CLAIMED";
  } else if (requiredDailyRunRate > 25) {
    status = "URGENT - ACCELERATE SPEND (RAISE BIDS / EXPAND KEYWORDS)";
  } else if (requiredDailyRunRate > 15) {
    status = "MODERATE ATTENTION - KEEP BIDS COMPETITIVE";
  } else {
    status = "PACING ON TRACK ($12-$15/DAY TARGET)";
  }

  sheet.appendRow(["Pacing Status", status, "Updated automatically every evening at 5:00 PM"]);
  sheet.getRange(8, 1, 1, 3).setFontWeight("bold").setBackground(totalSpent >= PROMO_GOAL ? "#d9ead3" : "#fff2cc");
}
