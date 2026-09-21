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
 * 1. Reads 'negatives.txt' from GitHub -> Applies campaign-level negative keywords to all active campaigns.
 * 2. Reads 'keywords.txt' from GitHub -> Adds new positive phrase/exact keywords into 'General LiDAR'.
 * 3. Logs applied keywords to Google Sheets for full transparency.
 */

const SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1OvSHBe9QoQ1BSwURiNNgbdwzQ6ATlvG8X3gHCZXBoMk/edit";
const GITHUB_NEGATIVES_URL = "https://raw.githubusercontent.com/OperationBlindMammoth/OperationBlindMammoth.github.io/main/negatives.txt";
const GITHUB_KEYWORDS_URL = "https://raw.githubusercontent.com/OperationBlindMammoth/OperationBlindMammoth.github.io/main/keywords.txt";

function main() {
  Logger.log(">>> [7:00 PM] Starting Densmore Drone Services GitHub Ingestion...");

  let spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  } catch (e) {
    Logger.log("Notice: Spreadsheet open failed (" + e + "), proceeding with Google Ads updates directly.");
  }

  // 1. Sync Negative Keywords from GitHub
  syncNegativeKeywordsFromGitHub(spreadsheet);

  // 2. Sync Positive Target Keywords from GitHub into General LiDAR
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
        if (sheet) {
          sheet.appendRow([line, "General LiDAR", "Successfully Added", new Date().toLocaleDateString()]);
        }
        count++;
      } catch (err) {
        // Keyword likely already exists or is duplicate
        if (sheet) {
          sheet.appendRow([line, "General LiDAR", "Already Present", new Date().toLocaleDateString()]);
        }
      }
    }
    Logger.log(">>> Successfully processed " + count + " target keywords from GitHub into General LiDAR!");
  } catch (err) {
    Logger.log("Error syncing target keywords from GitHub: " + err);
  }
}
