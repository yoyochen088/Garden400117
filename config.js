// ════════════════════════════════════════════
//  ♡璀璨♡ - 設定檔
//  填入你的 API Key 後即可使用
// ════════════════════════════════════════════

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxFNC3q4JJFdxLnlQ2M2OgD8qVTIXrN1tZ6Y6rZQiUs2ku-Es9DkbWrlr-XT_3Rsgfu4Q/exec';
const SHEET_ID        = '1hKW9-wVYfZAjP4YIGJY6ngK8cFWuhDn1OxGvPnHLGDg';
const API_KEY         = 'AIzaSyALI8OL0bN4yg4PTV3q_hwIsdrkkpcJ0Tg'; // ← 填入你的 Google Sheets API Key


// 前台讀取設定（index.html 使用）
const SHEET_CONFIG = {
  apiKey:  API_KEY,
  sheetId: SHEET_ID,
  ranges:  ['flowers!A1:Z', 'members!A1:Z', 'ownership!A1:Z']
};
