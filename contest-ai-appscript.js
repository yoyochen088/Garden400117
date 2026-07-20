// ════════════════════════════════════════════════════════════════
//  AI 競賽分析 — Apps Script 端程式碼
//  請將以下函式加到你現有的 Apps Script 專案中
// ════════════════════════════════════════════════════════════════

// ── 設定 ──
const GEMINI_API_KEY = '你的_GEMINI_API_KEY';  // ← 在此填入 Gemini API Key
const AI_DAILY_LIMIT = 30;  // 每日最多使用次數
const AI_USAGE_SHEET = 'ai_usage';  // 記錄用量的分頁名稱

// ════════════════════════════════════════════════════════════════
//  在你現有的 doGet(e) 函式中加入以下 action 判斷：
//
//  if (e.parameter.action === 'askAI') return handleAskAI(e);
//  if (e.parameter.action === 'getAIUsage') return handleGetAIUsage();
//
// ════════════════════════════════════════════════════════════════

function handleAskAI(e) {
  const question = e.parameter.question || '';
  if (!question.trim()) {
    return jsonResp({ error: 'empty', message: '請輸入問題' });
  }

  // 1. 檢查用量
  const usage = getTodayAIUsage();
  if (usage >= AI_DAILY_LIMIT) {
    return jsonResp({ error: 'limit_reached', message: '今日 AI 額度已用完，明天再來問吧！' });
  }

  // 2. 撈取競賽資料作為上下文
  const contestContext = buildContestContext();

  // 3. 呼叫 Gemini
  const systemPrompt = `你是「璀璨」公會的專屬競賽分析師。公會編號 400117。
請根據以下競賽數據回答問題，用繁體中文回答，語氣友善專業。
若數據不足以回答，請誠實說明。
回答盡量有結構，適當使用列表和重點標示。

【公會競賽數據】
${contestContext}`;

  try {
    const answer = callGemini(systemPrompt, question);
    // 4. 記錄用量
    recordAIUsage();
    const newUsage = usage + 1;
    return jsonResp({ success: true, answer: answer, used: newUsage, limit: AI_DAILY_LIMIT });
  } catch (err) {
    // Gemini 429 或其他錯誤
    if (err.message && err.message.includes('429')) {
      return jsonResp({ error: 'rate_limited', message: '目前使用次數超量，請稍後再試' });
    }
    return jsonResp({ error: 'api_error', message: '分析失敗：' + err.message });
  }
}

function handleGetAIUsage() {
  const used = getTodayAIUsage();
  return jsonResp({ success: true, used: used, limit: AI_DAILY_LIMIT });
}

// ── 呼叫 Gemini API ──
function callGemini(systemPrompt, userMessage) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_API_KEY;
  const payload = {
    contents: [
      { role: 'user', parts: [{ text: systemPrompt + '\n\n使用者問題：' + userMessage }] }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();

  if (code === 429) {
    throw new Error('429 Too Many Requests');
  }
  if (code !== 200) {
    throw new Error('HTTP ' + code + ': ' + response.getContentText().substring(0, 200));
  }

  const json = JSON.parse(response.getContentText());
  if (json.candidates && json.candidates[0] && json.candidates[0].content) {
    return json.candidates[0].content.parts[0].text;
  }
  throw new Error('Gemini 無回應');
}

// ── 組建競賽上下文 ──
function buildContestContext() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const parts = [];

  // 競賽個人成績（最近 3 期）
  try {
    const contestSheet = ss.getSheetByName('contest');
    if (contestSheet) {
      const data = contestSheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1);
      // 取所有 period，排序取最近 3 期
      const periods = [...new Set(rows.map(r => r[0]))].sort((a, b) => new Date(b) - new Date(a)).slice(0, 3);
      const recentRows = rows.filter(r => periods.includes(r[0]));
      // 組成摘要
      parts.push('【個人成績（最近3期）】');
      periods.forEach(p => {
        const periodRows = recentRows.filter(r => r[0] === p).sort((a, b) => (Number(b[4]) || 0) - (Number(a[4]) || 0));
        parts.push(`\n期數: ${p}（${periodRows.length}人）`);
        periodRows.forEach(r => {
          parts.push(`  ${r[2]} | 職位:${r[3]} | 分數:${r[4]} | 稱號:${r[5] || '無'}`);
        });
      });
    }
  } catch (e) { parts.push('（個人成績讀取失敗）'); }

  // 公會總覽
  try {
    const summarySheet = ss.getSheetByName('contest_summary');
    if (summarySheet) {
      const data = summarySheet.getDataRange().getValues();
      const headers = data[0];
      const rows = data.slice(1).sort((a, b) => new Date(b[0]) - new Date(a[0])).slice(0, 5);
      parts.push('\n\n【公會競賽總覽（最近5期）】');
      parts.push('期數 | 參賽人數 | 總分 | 排名 | 評級');
      rows.forEach(r => {
        parts.push(`${r[0]} | ${r[1]}人 | ${r[2]} | ${r[3]} | ${r[4] || '-'}`);
      });
    }
  } catch (e) { parts.push('（總覽讀取失敗）'); }

  // 對手資料（最近 1 期）
  try {
    const oppSheet = ss.getSheetByName('contest_opponents');
    if (oppSheet) {
      const data = oppSheet.getDataRange().getValues();
      const rows = data.slice(1);
      const periods = [...new Set(rows.map(r => r[0]))].sort((a, b) => new Date(b) - new Date(a));
      if (periods.length) {
        const latestOpp = rows.filter(r => r[0] === periods[0]).sort((a, b) => (Number(a[1]) || 0) - (Number(b[1]) || 0));
        parts.push('\n\n【本期對手（' + periods[0] + '）】');
        latestOpp.slice(0, 10).forEach(r => {
          parts.push(`  排名${r[1]} | ${r[2]} | 分數:${r[3]}`);
        });
      }
    }
  } catch (e) { parts.push('（對手讀取失敗）'); }

  return parts.join('\n');
}

// ── 用量管理 ──
function getTodayAIUsage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(AI_USAGE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(AI_USAGE_SHEET);
    sheet.appendRow(['date', 'count']);
    return 0;
  }
  const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const d = Utilities.formatDate(new Date(data[i][0]), 'Asia/Taipei', 'yyyy-MM-dd');
    if (d === today) return Number(data[i][1]) || 0;
  }
  return 0;
}

function recordAIUsage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(AI_USAGE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(AI_USAGE_SHEET);
    sheet.appendRow(['date', 'count']);
  }
  const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const d = Utilities.formatDate(new Date(data[i][0]), 'Asia/Taipei', 'yyyy-MM-dd');
    if (d === today) {
      sheet.getRange(i + 1, 2).setValue((Number(data[i][1]) || 0) + 1);
      return;
    }
  }
  // 今天第一次
  sheet.appendRow([today, 1]);
}

// ── 工具函式 ──
function jsonResp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
