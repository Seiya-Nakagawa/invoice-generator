// --- 設定項目 ---

// 1. スプレッドシート内のフォーマットシート名
const FORMAT_SHEET_NAME = "フォーマット";

// 2. Gmail下書きの件名 ({YEAR}と{MONTH}が置換されます)
const EMAIL_SUBJECT_TEMPLATE = PropertiesService.getScriptProperties().getProperty('EMAIL_SUBJECT_TEMPLATE');

// 3. 本文の雛形として使用する「下書き」に付与するラベル名
// Gmail側でこのラベルを作成し、テンプレートにしたい下書きメールに付与してください。
// ※ 宛先もこの下書きに入力しておけば、自動的にコピーされます。
const EMAIL_TEMPLATE_LABEL = "SJ_請求書テンプレート";

// ------------------------------------

// PDFファイル名 (EMAIL_SUBJECT_TEMPLATE と同一形式)
const PDF_FILENAME_TEMPLATE_CONFIG = (EMAIL_SUBJECT_TEMPLATE || "") + ".pdf";

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
