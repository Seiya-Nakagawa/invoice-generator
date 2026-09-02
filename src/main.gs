// @ts-nocheck
/**
 * @OnlyCurrentDoc // このスクリプトが現在のドキュメントにのみアクセスすることを保証します
 */

/**
 * スプレッドシートを開いたときにカスタムメニューを追加します。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('請求書処理')
    .addItem('当月シート作成', 'createNewMonthlySheet')
    .addItem('PDF作成＆Gmail下書き', 'mainProcessInvoice')
    .addToUi();
}

/**
 * 設定値のバリデーションを行います。
 * @param {string[]} keys チェックする設定キーのリスト
 */
function validateConfig(keys) {
  // config.gs で定義した設定値をキー名で引けるようにする
  const configValues = {
    FORMAT_SHEET_NAME: FORMAT_SHEET_NAME,
    EMAIL_SUBJECT_TEMPLATE: EMAIL_SUBJECT_TEMPLATE,
    EMAIL_TEMPLATE_LABEL: EMAIL_TEMPLATE_LABEL,
    INVOICE_DATE_CELL: INVOICE_DATE_CELL,
    DUE_DATE_CELL: DUE_DATE_CELL
  };

  const missing = keys.filter(key => {
    const value = configValues[key];
    return value === null || value === undefined || value === "";
  });

  if (missing.length > 0) {
    throw new Error(`以下の設定が不足しています。スクリプトプロパティを確認してください: ${missing.join(", ")}`);
  }
}

/**
 * テンプレートをコピーして当月分のシートを作成します。
 */
function createNewMonthlySheet() {
  try {
    validateConfig(['FORMAT_SHEET_NAME', 'INVOICE_DATE_CELL', 'DUE_DATE_CELL']);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const today = new Date();
    // 実行日の年月をターゲットにする
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const sheetName = year.toString() + month.toString().padStart(2, '0');

    if (ss.getSheetByName(sheetName)) {
      Logger.log(`既にシートが存在するためスキップします: ${sheetName}`);
      showAlert(`既にシート「${sheetName}」が存在します。`);
      return;
    }

    const formatSheet = ss.getSheetByName(FORMAT_SHEET_NAME);
    if (!formatSheet) throw new Error(`フォーマットシート「${FORMAT_SHEET_NAME}」が見つかりません。`);

    const newSheet = formatSheet.copyTo(ss).setName(sheetName);

    // 日付の設定
    const thisMonthLast = new Date(year, month, 0);      // 当月末
    const nextMonthLast = new Date(year, month + 1, 0);  // 翌月末

    newSheet.getRange(INVOICE_DATE_CELL).setValue(Utilities.formatDate(thisMonthLast, Session.getScriptTimeZone(), "yyyy/MM/dd"));
    newSheet.getRange(DUE_DATE_CELL).setValue(Utilities.formatDate(nextMonthLast, Session.getScriptTimeZone(), "yyyy/MM/dd"));

    Logger.log(`新しいシートを作成しました: ${sheetName}`);
    showAlert(`新しいシート「${sheetName}」を作成しました。`);

  } catch (e) {
    Logger.log(`createNewMonthlySheet でエラーが発生しました: ${e.toString()}`);
    showAlert(`エラー: ${e.toString()}`);
    throw e; // エラーメールを飛ばすために再スロー
  }
}

/**
 * メイン処理関数：当月分の別ファイルを検索し、PDF作成とGmail下書き作成を実行します。
 */
function mainProcessInvoice() {
  try {
    validateConfig(['FORMAT_SHEET_NAME', 'EMAIL_SUBJECT_TEMPLATE', 'EMAIL_TEMPLATE_LABEL']);

    // 常に「実行日の前月」をターゲットにする
    const { year, month } = getTargetYearMonth();
    const formattedMonth = month.toString();
    const yearString = year.toString();
    const sheetName = yearString + month.toString().padStart(2, '0');

    // 1. メール件名とPDFファイル名を決定
    const targetFileName = EMAIL_SUBJECT_TEMPLATE
      .replace("{YEAR}", yearString)
      .replace("{MONTH}", formattedMonth);

    const emailSubject = targetFileName;
    const pdfFileName = targetFileName + ".pdf";

    // 2. 当月分のシートを検索
    Logger.log(`シートを探しています: ${sheetName}`);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = ss.getSheetByName(sheetName);

    if (!targetSheet) throw new Error(`シート「${sheetName}」が見つかりませんでした。先に「当月シート作成」を行ってください。`);

    // 3. PDFの保存先フォルダ（ファイルと同じ場所）
    const spreadsheetFile = DriveApp.getFileById(ss.getId());
    const folder = spreadsheetFile.getParents().next();

    if (folder.isTrashed()) {
      throw new Error(`保存先フォルダ「${folder.getName()}」がゴミ箱に入っています。`);
    }

    // 4. PDF作成
    Logger.log(`${year}年${month}月分のPDFを作成中...`);

    // 同名の既存ファイルがある場合は、既存の請求書リンクが変わることを避けるため
    // 上書きせずスキップする
    const existingFiles = folder.getFilesByName(pdfFileName);
    if (existingFiles.hasNext()) {
      Logger.log(`既に同名のファイルが存在するためスキップします: ${pdfFileName}`);
      showAlert(`既に「${pdfFileName}」が存在するため、処理をスキップしました。`);
      return;
    }

    const pdfFile = exportSheetAsPDF(ss, targetSheet, folder, pdfFileName);

    // 共有リンクの取得
    const driveLink = pdfFile.getUrl();

    // 5. Gmail下書き作成
    const searchQuery = `label:${EMAIL_TEMPLATE_LABEL} is:draft`;
    const threads = GmailApp.search(searchQuery, 0, 1);

    if (threads.length === 0) throw new Error(`ラベル「${EMAIL_TEMPLATE_LABEL}」の下書きが見つかりません。`);

    const msg = threads[0].getMessages()[0];
    const recipient = msg.getTo();

    // 置換処理（リンク を追加）
    const replacePlaceholders = (text, isHtml) => {
      let res = text
        .replace(/{YEAR}/g, yearString)
        .replace(/{MONTH}/g, formattedMonth);

      if (res.indexOf("{リンク}") !== -1) {
        res = res.replace(/{リンク}/g, driveLink);
      } else {
        if (isHtml) {
          res += `<br><br>請求書リンク: <a href="${driveLink}">${driveLink}</a>`;
        } else {
          res += "\n\n請求書リンク: " + driveLink;
        }
      }
      return res;
    };

    const emailBody = replacePlaceholders(msg.getPlainBody(), false);
    const htmlBody = replacePlaceholders(msg.getBody(), true);

    GmailApp.createDraft(recipient, emailSubject, emailBody, {
      htmlBody: htmlBody
    });

    Logger.log(`${targetFileName} の処理が完了しました。`);
    showAlert(`${targetFileName} のPDF作成とGmail下書きの作成が完了しました。\n\nDriveリンク:\n${driveLink}`);

  } catch (e) {
    const errorMsg = `エラーが発生しました: ${e.toString()}`;
    Logger.log(errorMsg);
    showAlert(errorMsg);
    throw e; // エラーメールを飛ばすために再スロー
  }
}

/**
 * 実行対象の年月を決定します（実行日の前月）。
 */
function getTargetYearMonth() {
  const today = new Date();
  const targetDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return {
    year: targetDate.getFullYear(),
    month: targetDate.getMonth() + 1
  };
}

/**
 * ユーザーへの通知（アラート）を表示します。
 */
function showAlert(message) {
  // まずログに出力（トリガー実行時でも確認可能にするため）
  Logger.log(`[Alert Message] ${message}`);

  try {
    // UIコンテキスト（スプレッドシートを開いている状態）でのみアラートを表示
    const ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.alert(message);
    }
  } catch (e) {
    // トリガー実行時など、UIが利用できないコンテキストでは getUi() が例外を投げるため、
    // ここでキャッチして何もしない（ログ出力は済んでいるため）
  }
}

/**
 * 指定されたシートをPDFとしてエクスポートします。
 */
function exportSheetAsPDF(spreadsheet, sheet, folder, pdfFileName) {
  const spreadsheetId = spreadsheet.getId();
  const sheetId = sheet.getSheetId();
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=pdf&gid=${sheetId}${pdfOptions}`;

  const params = {
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, params);
    if (response.getResponseCode() === 200) {
      const blob = response.getBlob().setName(pdfFileName);
      return folder.createFile(blob);
    } else {
      throw new Error(`エクスポート失敗: ${response.getContentText()}`);
    }
  } catch (e) {
    Logger.log(`PDF作成エラー: ${e.toString()}`);
    throw e; // 上位の catch ブロックへ伝播させる
  }
}
