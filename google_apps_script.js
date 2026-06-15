const SHEET_ID = '1hKW9-wVYfZAjP4YIGJY6ngK8cFWuhDn1OxGvPnHLGDg';

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const result = handleAction(data);
  return HtmlService.createHtmlOutput(JSON.stringify(result));
}

function doGet(e) {
  const raw = e.parameter.data;
  if (!raw) return ContentService.createTextOutput('ok');
  try {
    const data = JSON.parse(decodeURIComponent(raw));
    const result = handleAction(data);
    return result;
  } catch(e) {
    return ContentService.createTextOutput('error: ' + e.message);
  }
}

function handleAction(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // ── 密碼驗證 ──
  if (data.action === 'checkPassword') {
    const sheet = ss.getSheetByName('password');
    const correct = String(sheet.getRange(1, 1).getValue());
    const ok = String(data.pw) === correct;
    return ContentService.createTextOutput(JSON.stringify({ ok: ok }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // ── 更新擁有權 ──
  if (data.action === 'updateOwnership') {
    const sheet = ss.getSheetByName('ownership');
    const gameId = data.gameId;
    const toAdd    = data.toAdd    || [];
    const toRemove = data.toRemove || [];
    const now = new Date();

    if (toRemove.length > 0) {
      const removeSet = new Set(toRemove.map(String));
      const allData = sheet.getDataRange().getValues();
      for (let i = allData.length - 1; i >= 1; i--) {
        if (allData[i][0] === gameId && removeSet.has(String(allData[i][1]))) {
          sheet.deleteRow(i + 1);
        }
      }
    }

    toAdd.forEach(fid => sheet.appendRow([gameId, fid, now]));
    return ContentService.createTextOutput('ok');
  }

  // ── 更新成員 ──
  if (data.action === 'updateMember') {
    const sheet = ss.getSheetByName('members');
    const allData = sheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][0]).trim() === String(data.gameId).trim()) {
        sheet.getRange(i+1, 1, 1, 4).setValues([[data.gameId, data.nickname, data.note, data.left ? 'true' : '']]);
        found = true;
        break;
      }
    }
    if (!found && !data.left) {
      sheet.appendRow([data.gameId, data.nickname, data.note, '']);
    }
    return ContentService.createTextOutput('ok');
  }

  // ── 刪除成員 ──
  if (data.action === 'deleteMember') {
    const sheet = ss.getSheetByName('members');
    const allData = sheet.getDataRange().getValues();
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][0] === data.gameId) {
        sheet.getRange(i+1, 4).setValue('true');
        break;
      }
    }
    return ContentService.createTextOutput('ok');
  }

  // ── 新增花卉 ──
  if (data.action === 'addFlower') {
    const sheet = ss.getSheetByName('flowers');
    sheet.appendRow([data.id, data.name, data.quality, data.score, data.obtain, data.order, data.img]);
    return ContentService.createTextOutput('ok');
  }

  // ── 更新花卉 ──
  if (data.action === 'updateFlower') {
    const sheet = ss.getSheetByName('flowers');
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0];
    const idCol = headers.indexOf('id');
    for (let i = 1; i < allData.length; i++) {
      if (Number(allData[i][idCol]) === Number(data.id)) {
        ['name', 'quality', 'score', 'obtain', 'order'].forEach(field => {
          const col = headers.indexOf(field);
          if (col >= 0 && data[field] !== undefined) sheet.getRange(i+1, col+1).setValue(data[field]);
        });
        break;
      }
    }
    return ContentService.createTextOutput('ok');
  }

  // ── 新增競賽成績 ──
  if (data.action === 'addContestRecord') {
    let sheet = ss.getSheetByName('contest');
    if (!sheet) {
      sheet = ss.insertSheet('contest');
      sheet.appendRow(['期數', '伺服器', '暱稱', '職位', '分數', '稱號', '建立時間']);
    }
    sheet.appendRow([data.period, data.server, data.nickname, data.role, data.score, data.title, new Date()]);
    return ContentService.createTextOutput('ok');
  }

  // ── 新增兌換碼 ──
  if (data.action === 'addCoupon') {
    const sheet = ss.getSheetByName('coupon');
    sheet.appendRow([data.code, data.type]);
    return ContentService.createTextOutput('ok');
  }

  // ── 更新兌換碼 ──
  if (data.action === 'updateCoupon') {
    const sheet = ss.getSheetByName('coupon');
    const allData = sheet.getDataRange().getValues();
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][0]).trim() === String(data.oldCode).trim()) {
        sheet.getRange(i + 1, 1).setValue(data.code);
        sheet.getRange(i + 1, 2).setValue(data.type);
        break;
      }
    }
    return ContentService.createTextOutput('ok');
  }

  // ── 刪除兌換碼 ──
  if (data.action === 'deleteCoupon') {
    const sheet = ss.getSheetByName('coupon');
    const allData = sheet.getDataRange().getValues();
    for (let i = allData.length - 1; i >= 1; i--) {
      if (String(allData[i][0]).trim() === String(data.code).trim()) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return ContentService.createTextOutput('ok');
  }

  return ContentService.createTextOutput('error: unknown action');
}
