// --- 設定項目 ---
//
// 取引先ごとに異なる値は、すべて GAS のスクリプトプロパティで管理する。
// （スクリプトエディタ → プロジェクトの設定 → スクリプト プロパティ）
// これにより src/ 配下のソースコードは全取引先で完全に共通となる。
//
// | キー                     | 必須 | 既定値 | 用途                                       |
// | ------------------------ | ---- | ------ | ------------------------------------------ |
// | EMAIL_SUBJECT_TEMPLATE   | 必須 | なし   | メール件名・PDFファイル名のテンプレート     |
// | EMAIL_TEMPLATE_LABEL     | 必須 | なし   | 雛形とする Gmail 下書きのラベル名           |
// | INVOICE_DATE_CELL        | 任意 | J13    | 請求日を書き込むセル                        |
// | DUE_DATE_CELL            | 任意 | J14    | お支払い期限を書き込むセル                  |

const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

// 請求日・お支払い期限の既定セル。請求書フォーマットの列構成が異なる取引先のみ
// スクリプトプロパティで上書きする。
const DEFAULT_INVOICE_DATE_CELL = "J13";
const DEFAULT_DUE_DATE_CELL = "J14";

// 1. スプレッドシート内のフォーマットシート名（全取引先で共通）
const FORMAT_SHEET_NAME = "フォーマット";

// 2. Gmail下書きの件名 ({YEAR}と{MONTH}が置換されます)
const EMAIL_SUBJECT_TEMPLATE = SCRIPT_PROPERTIES.getProperty("EMAIL_SUBJECT_TEMPLATE");

// 3. 本文の雛形として使用する「下書き」に付与するラベル名
// Gmail側でこのラベルを作成し、テンプレートにしたい下書きメールに付与してください。
// ※ 宛先もこの下書きに入力しておけば、自動的にコピーされます。
// ※ 下書きは検索の先頭1件のみを使用するため、取引先ごとに別のラベルを割り当ててください。
const EMAIL_TEMPLATE_LABEL = SCRIPT_PROPERTIES.getProperty("EMAIL_TEMPLATE_LABEL");

// 4. 当月シート作成時に日付を書き込むセル
const INVOICE_DATE_CELL = SCRIPT_PROPERTIES.getProperty("INVOICE_DATE_CELL") || DEFAULT_INVOICE_DATE_CELL;
const DUE_DATE_CELL = SCRIPT_PROPERTIES.getProperty("DUE_DATE_CELL") || DEFAULT_DUE_DATE_CELL;

// ------------------------------------

// PDFエクスポートオプション
const pdfOptions =
  '&size=A4' +
  '&portrait=true' +
  '&fitw=true' +
  '&top_margin=0.50' +
  '&bottom_margin=0.50' +
  '&left_margin=0.50' +
  '&right_margin=0.50' +
  '&gridlines=false' +
  '&printtitle=false' +
  '&sheetnames=false' +
  '&fzr=false' +
  '&fzc=false' +
  '&attachment=true';
