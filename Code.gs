const GEMINI_API_KEY = 'YOUR_AI_STUDIO_KEY_HERE';
const SPREADSHEET_ID = '10-2QSreupS-8sdtx3V5fDrZ4uqAHnwHMOuvGVRKL9u8';

function getSheet(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function doGet(e) {
  if (!e.parameter.action) {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('SoilTrack - Lawns Plants & Pests')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  try {
    const sheet = getSheet(e.parameter.sheet);
    if (!sheet) return respond({ error: 'Sheet not found: ' + e.parameter.sheet });
    return respond(sheet.getDataRange().getValues());
  } catch(err) {
    return respond({ error: err.toString() });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'extract') {
      const extracted = extractSoilData(data.imageBase64, data.mimeType);
      getOrCreateCustomer(extracted.CustomerName);
      saveSample(extracted);
      return respond({ success: true, data: extracted });
    }
    if (data.action === 'save') {
      const sheet = getSheet(data.sheet);
      if (!sheet) return respond({ error: 'Sheet not found: ' + data.sheet });
      sheet.appendRow(data.row);
      return respond({ success: true });
    }
    return respond({ error: 'Invalid action' });
  } catch(err) {
    Logger.log('doPost ERROR: ' + err.toString());
    return respond({ success: false, error: err.toString() });
  }
}

function getOrCreateCustomer(name) {
  const sheet = getSheet('Customers');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] && data[i][1].toString().toLowerCase() === (name || '').toLowerCase()) {
      return data[i][0];
    }
  }
  const newId = Utilities.getUuid();
  sheet.appendRow([newId, name || 'Unknown', '', '', '', '', '', '', '', '']);
  return newId;
}

function saveSample(data) {
  const sheet = getSheet('Samples');
  sheet.appendRow([
    Utilities.getUuid(),
    data.CustomerName || '',
    data.Field || '',
    data.Year || '',
    data.pH || '',
    data.Phosphorus || '',
    data.OrganicMatter || '',
    data.Acidity || '',
    data.Potassium || '',
    data.Magnesium || '',
    data.Calcium || '',
    data.CEC || '',
    data.SatK || '',
    data.SatMg || '',
    data.SatCa || '',
    data.LimestoneLbs || '',
    data.RecN || '',
    data.RecP || '',
    data.RecK || '',
    new Date()
  ]);
}

function extractSoilData(base64, mimeType) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY;
  const prompt = 'Extract soil test data from this Penn State Extension soil report image. Return ONLY valid JSON with no markdown, no code blocks. Use these exact keys: {"CustomerName":"","Field":"","Year":"","pH":"","Phosphorus":"","OrganicMatter":"","Acidity":"","Potassium":"","Magnesium":"","Calcium":"","CEC":"","SatK":"","SatMg":"","SatCa":"","LimestoneLbs":"","RecN":"","RecP":"","RecK":""}. CustomerName from SOIL TEST REPORT FOR. Field from FIELD ID. Year 4-digit from DATE. LimestoneLbs as number or None. RecN RecP RecK as written e.g. 1 to 4 or None.';
  const payload = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } }] }],
    generationConfig: { response_mime_type: 'application/json' }
  };
  const response = UrlFetchApp.fetch(url, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const raw = response.getContentText();
  Logger.log('Gemini raw: ' + raw);
  const json = JSON.parse(raw);
  if (json.error) throw new Error(json.error.message);
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  Logger.log('Gemini text: ' + text);
  const cleaned = text.replace(/```json/g,'').replace(/```/g,'').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
