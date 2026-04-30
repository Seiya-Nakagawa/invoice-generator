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
    .addItem('PDF作成＆Gmail下書き', 'mainProcessInvoice')
    .addToUi();
}

/**
 * テンプレートをコピーして当月分のスプレッドシートを作成します。
 * (時間主導型トリガー等で実行されることを想定)
 */
function createNewMonthlySpreadsheet() {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const yearMonthString = `${year}年${month}月`;

    // 新しいファイル名を生成
    const newFileName = PDF_FILENAME_TEMPLATE_CONFIG.replace("{YEAR_MONTH}", yearMonthString).replace(".pdf", "");

    // テンプレートファイルの取得
    const templateFile = DriveApp.getFileById(TEMPLATE_SPREADSHEET_ID);
    const parentFolder = templateFile.getParents().next();

    // 重複チェック
    const existingFiles = parentFolder.getFilesByName(newFileName);
    if (existingFiles.hasNext()) {
      Logger.log(`既にファイルが存在するためスキップします: ${newFileName}`);
      return;
    }

    // コピー作成
    const newFile = templateFile.makeCopy(newFileName, parentFolder);
    Logger.log(`新しいスプレッドシートを作成しました: ${newFile.getName()} (ID: ${newFile.getId()})`);

  } catch (e) {
    Logger.log(`createNewMonthlySpreadsheet でエラーが発生しました: ${e.toString()}`);
  }
}

/**
 * メイン処理関数：PDF作成とGmail下書き作成を実行します。
 */
function mainProcessInvoice() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const spreadsheetId = ss.getId();

    // 1. ファイル名およびメール本文に使用する年と月を決定
    const { year, month } = getTargetYearMonth();
    const formattedMonth = month.toString();
    const yearString = year.toString();
    const yearMonthString = `${yearString}年${formattedMonth}月`;

    // 2. PDFファイル名を生成
    const pdfFileName = PDF_FILENAME_TEMPLATE_CONFIG.replace("{YEAR_MONTH}", yearMonthString);

    // 3. 処理対象のシートを取得
    const targetSheet = ss.getSheetByName(TEMPLATE_SHEET_NAME) || ss.getActiveSheet();
    if (!targetSheet) {
      SpreadsheetApp.getUi().alert(`エラー: シート「${TEMPLATE_SHEET_NAME}」が見つかりません。`);
      return;
    }

    // 4. スプレッドシートの親フォルダを取得
    const spreadsheetFile = DriveApp.getFileById(spreadsheetId);
    const parentFolders = spreadsheetFile.getParents();
    if (!parentFolders.hasNext()) {
      Logger.log("エラー: スプレッドシートに親フォルダがありません。PDFを保存できません。");
      SpreadsheetApp.getUi().alert("エラー: スプレッドシートに親フォルダがありません。PDFを保存できません。");
      return;
    }
    const folder = parentFolders.next();

    // 5. 指定シートをPDFとしてエクスポート
    Logger.log(`PDFファイルを作成中: ${pdfFileName} (フォルダ: ${folder.getName()})`);
    const pdfFile = exportSheetAsPDF(ss, targetSheet, folder, pdfFileName);

    if (!pdfFile) {
      Logger.log("PDFの作成に失敗しました。Gmail下書きの作成を中止します。");
      return;
    }
    Logger.log(`PDF作成成功: ${pdfFile.getName()}, ID: ${pdfFile.getId()}`);

    // 6. Gmailの下書きを作成
    const emailSubject = EMAIL_SUBJECT_TEMPLATE.replace("{YEAR}", yearString).replace("{MONTH}", formattedMonth);
    const emailBody = EMAIL_BODY_TEMPLATE
      .replace("{YEAR}", yearString)
      .replace("{MONTH}", formattedMonth) + EMAIL_SIGNATURE_TEMPLATE;

    Logger.log(`Gmail下書きを作成中。件名: ${emailSubject}`);
    GmailApp.createDraft(EMAIL_RECIPIENT, emailSubject, emailBody, {
      attachments: [pdfFile.getBlob()]
    });

    Logger.log("PDFを添付したGmail下書きを作成しました。");
    SpreadsheetApp.getUi().alert("PDF作成とGmail下書きの作成が完了しました。");

  } catch (e) {
    Logger.log(`エラーが発生しました: ${e.toString()}\nスタックトレース: ${e.stack}`);
    SpreadsheetApp.getUi().alert(`エラーが発生しました: ${e.toString()}`);
  }
}

/**
 * ファイル名に使用する年と月を取得します。
 * 実行日が月の15日以前なら前月、16日以降なら当月を返します。
 * @return {{year: number, month: number}} 年と月を含むオブジェクト
 */
function getTargetYearMonth() {
  const today = new Date();
  const currentDay = today.getDate();
  let targetDate = new Date(today.getTime());

  if (currentDay <= 15) {
    targetDate.setDate(0);
  }

  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;

  return { year: year, month: month };
}

/**
 * 指定されたシートをPDFとして指定されたフォルダにエクスポートします。
 * @param {Spreadsheet} spreadsheet 操作対象のスプレッドシートオブジェクト
 * @param {Sheet} sheet PDF化するシートオブジェクト
 * @param {Folder} folder PDFの保存先フォルダオブジェクト
 * @param {string} pdfFileName PDFのファイル名
 * @return {File|null} 作成されたPDFファイルオブジェクト、またはエラーの場合はnull
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
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const blob = response.getBlob().setName(pdfFileName);
      const pdfFile = folder.createFile(blob);
      Logger.log(`PDF "${pdfFileName}" をフォルダ "${folder.getName()}" に作成しました。ファイルID: ${pdfFile.getId()}`);
      return pdfFile;
    } else {
      const errorResponse = response.getContentText();
      Logger.log(`PDF作成エラー。レスポンスコード: ${responseCode}. レスポンス内容: ${errorResponse}`);
      SpreadsheetApp.getUi().alert(`PDF作成エラー (コード: ${responseCode}):\n${errorResponse}\n\nURL: ${url}`);
      return null;
    }
  } catch (e) {
    Logger.log(`PDFエクスポート中に例外発生: ${e.toString()}`);
    SpreadsheetApp.getUi().alert(`PDFエクスポート中にエラーが発生しました: ${e.toString()}`);
    return null;
  }
}
