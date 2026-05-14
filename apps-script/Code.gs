// Zgapariyo CRM - Google Apps Script
// 1) Open your Google Sheet
// 2) Extensions -> Apps Script
// 3) Paste this code into Code.gs
// 4) Run setupSpreadsheet once
// 5) Deploy -> New deployment -> Web app
//    Execute as: Me
//    Who has access: Anyone

const CONFIG = {
  SHEET_NAME: 'Orders',
  TZ: 'Asia/Tbilisi',
  ID_PREFIX: 'ZG-',
  IMGBB_API_KEY: 'PASTE_IMGBB_API_KEY_HERE'
};

const HEADERS = [
  'ID',
  'შექმნის თარიღი',
  'მშობელი',
  'ტელეფონი',
  'მისამართი',
  'სრული ფასი',
  'გადახდილი',
  'დარჩენილი',
  'ვადა',
  'დარჩენილი დღეები',
  'სტატუსი',
  'ფოტო',
  'შენიშვნა',
  'ბოლო განახლება'
];

function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  sheet.clear();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#8B5CF6')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  const widths = [110, 150, 220, 150, 320, 120, 120, 120, 130, 150, 130, 240, 340, 170];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  sheet.setFrozenRows(1);
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.getRange(1, 1, 1, HEADERS.length).createFilter();

  sheet.getRange('F:H').setNumberFormat('#,##0.00');
  sheet.getRange('B:B').setNumberFormat('dd.MM.yyyy HH:mm');
  sheet.getRange('I:I').setNumberFormat('dd.MM.yyyy');
  sheet.getRange('N:N').setNumberFormat('dd.MM.yyyy HH:mm');

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['მიმდინარე', 'გაგზავნილი'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange('K2:K10000').setDataValidation(statusRule);

  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('მიმდინარე')
      .setBackground('#FEF3C7')
      .setFontColor('#92400E')
      .setRanges([sheet.getRange('K2:K10000')])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('გაგზავნილი')
      .setBackground('#DCFCE7')
      .setFontColor('#166534')
      .setRanges([sheet.getRange('K2:K10000')])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setBackground('#FFF7ED')
      .setFontColor('#C2410C')
      .setRanges([sheet.getRange('H2:H10000')])
      .build()
  ];
  sheet.setConditionalFormatRules(rules);

  sheet.setRowHeight(1, 36);
  sheet.getRange(1, 1, 1000, HEADERS.length).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  sheet.setTabColor('#8B5CF6');
  sheet.setActiveSelection('A2');

  SpreadsheetApp.getUi().alert('ზღაპარიყო CRM მზადაა! ✨');
}

function doGet() {
  return jsonOutput({ ok: true, message: 'Zgapariyo CRM API works' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action;

    if (action === 'listOrders') return jsonOutput({ ok: true, orders: listOrders() });
    if (action === 'createOrder') return jsonOutput({ ok: true, order: createOrder(body.order || {}) });
    if (action === 'updateOrder') return jsonOutput({ ok: true, order: updateOrder(body.id, body.order || {}) });
    if (action === 'addPayment') return jsonOutput({ ok: true, order: addPayment(body.id, Number(body.amount || 0)) });
    if (action === 'markSent') return jsonOutput({ ok: true, order: updateOrder(body.id, { status: 'გაგზავნილი' }) });
    if (action === 'uploadImage') return jsonOutput({ ok: true, url: uploadImageToImgBB(body.imageBase64) });

    return jsonOutput({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err.message || err) });
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    setupSpreadsheet();
    sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  }
  return sheet;
}

function listOrders() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return values
    .filter(row => row[0])
    .map(rowToOrder)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function createOrder(order) {
  const sheet = getSheet();
  const now = new Date();
  const id = nextOrderId();
  const total = Number(order.totalPrice || 0);
  const paid = Number(order.paidAmount || 0);
  const left = Math.max(total - paid, 0);
  const dueDate = order.dueDate || '';

  const row = [
    id,
    now,
    clean(order.parentName),
    clean(order.phone),
    clean(order.address),
    total,
    paid,
    left,
    dueDate ? new Date(dueDate) : '',
    dueDate ? daysLeftText(dueDate) : '',
    order.status || 'მიმდინარე',
    order.photoUrl || '',
    clean(order.note),
    now
  ];

  sheet.appendRow(row);
  return rowToOrder(row);
}

function updateOrder(id, patch) {
  const sheet = getSheet();
  const rowIndex = findRowById(id);
  if (!rowIndex) throw new Error('Order not found');

  const row = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
  const current = rowToOrder(row);

  const total = patch.totalPrice !== undefined ? Number(patch.totalPrice || 0) : Number(current.totalPrice || 0);
  const paid = patch.paidAmount !== undefined ? Number(patch.paidAmount || 0) : Number(current.paidAmount || 0);
  const dueDate = patch.dueDate !== undefined ? patch.dueDate : current.dueDateRaw;

  const updated = [
    current.id,
    row[1],
    patch.parentName !== undefined ? clean(patch.parentName) : current.parentName,
    patch.phone !== undefined ? clean(patch.phone) : current.phone,
    patch.address !== undefined ? clean(patch.address) : current.address,
    total,
    paid,
    Math.max(total - paid, 0),
    dueDate ? new Date(dueDate) : '',
    dueDate ? daysLeftText(dueDate) : '',
    patch.status || current.status || 'მიმდინარე',
    patch.photoUrl !== undefined ? patch.photoUrl : current.photoUrl,
    patch.note !== undefined ? clean(patch.note) : current.note,
    new Date()
  ];

  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([updated]);
  return rowToOrder(updated);
}

function addPayment(id, amount) {
  if (!amount || amount <= 0) throw new Error('Amount must be positive');
  const sheet = getSheet();
  const rowIndex = findRowById(id);
  if (!rowIndex) throw new Error('Order not found');

  const row = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
  const order = rowToOrder(row);
  const newPaid = Number(order.paidAmount || 0) + amount;

  return updateOrder(id, { paidAmount: newPaid });
}

function findRowById(id) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = ids.findIndex(v => String(v) === String(id));
  return index === -1 ? null : index + 2;
}

function nextOrderId() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return CONFIG.ID_PREFIX + '0001';

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  let max = 0;
  ids.forEach(id => {
    const num = Number(String(id).replace(CONFIG.ID_PREFIX, ''));
    if (!isNaN(num) && num > max) max = num;
  });
  return CONFIG.ID_PREFIX + String(max + 1).padStart(4, '0');
}

function uploadImageToImgBB(imageBase64) {
  if (!imageBase64) throw new Error('Image is empty');
  if (!CONFIG.IMGBB_API_KEY || CONFIG.IMGBB_API_KEY === 'PASTE_IMGBB_API_KEY_HERE') {
    throw new Error('ImgBB API key is not set');
  }

  const cleanBase64 = String(imageBase64).replace(/^data:image\/[a-zA-Z]+;base64,/, '');
  const response = UrlFetchApp.fetch('https://api.imgbb.com/1/upload?key=' + CONFIG.IMGBB_API_KEY, {
    method: 'post',
    payload: { image: cleanBase64 },
    muteHttpExceptions: true
  });

  const data = JSON.parse(response.getContentText());
  if (!data.success) throw new Error('ImgBB upload failed');
  return data.data.url;
}

function rowToOrder(row) {
  const due = row[8];
  return {
    id: row[0],
    createdAt: formatDateTime(row[1]),
    parentName: row[2],
    phone: row[3],
    address: row[4],
    totalPrice: Number(row[5] || 0),
    paidAmount: Number(row[6] || 0),
    leftAmount: Number(row[7] || 0),
    dueDate: due ? formatDateOnly(due) : '',
    dueDateRaw: due ? Utilities.formatDate(new Date(due), CONFIG.TZ, 'yyyy-MM-dd') : '',
    daysLeft: row[9],
    status: row[10],
    photoUrl: row[11],
    note: row[12],
    updatedAt: formatDateTime(row[13])
  };
}

function daysLeftText(dateValue) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dateValue);
  due.setHours(0, 0, 0, 0);

  const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff > 0) return 'დარჩა ' + diff + ' დღე';
  if (diff === 0) return 'დღეს არის ვადა';
  return 'ვადა გადაცდა ' + Math.abs(diff) + ' დღით';
}

function formatDateTime(value) {
  if (!value) return '';
  return Utilities.formatDate(new Date(value), CONFIG.TZ, 'dd.MM.yyyy HH:mm');
}

function formatDateOnly(value) {
  if (!value) return '';
  return Utilities.formatDate(new Date(value), CONFIG.TZ, 'dd.MM.yyyy');
}

function clean(value) {
  return String(value || '').trim();
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
