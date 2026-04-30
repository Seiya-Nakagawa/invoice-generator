// --- 設定項目 ---
// 当月分シートを複製する元のテンプレートシート名
const TEMPLATE_SHEET_NAME = "請求書";
// Gmail下書きの宛先
const EMAIL_RECIPIENT = "XXXXXX@XXXX.XX.XX";
// Gmail下書きの件名 ({YEAR}と{MONTH}が置換されます)
const EMAIL_SUBJECT_TEMPLATE = "【請求書】〇〇社 {YEAR}年{MONTH}月分";
// Gmail下書きの本文テンプレート ({YEAR}と{MONTH}が置換されます)
const EMAIL_BODY_TEMPLATE =
  "株式会社 〇〇\n" +
  "〇〇様\n\n" +
  "お世話になっております。\n" +
  "〇〇の〇〇です。\n\n" +
  "{YEAR}年{MONTH}月分の請求書を送付させていただきます。\n" +
  "ご査収の程、お願い致します。\n\n"; //

// --- 署名用の定数 ---
const EMAIL_SIGNATURE_TEMPLATE =
  "=========================\n" +
  "株式会社 〇〇n" +
  "〇〇 〇〇（〇〇 〇〇）\n" + 
  "Email: XXXXXX@XXXX.XX.XX\n" +
  "========================="
// ------------------------------------

// PDFファイル名
const PDF_FILENAME_TEMPLATE_CONFIG = "【請求書】〇〇_{YEAR_MONTH}分.pdf";

// PDFエクスポートオプション (必要に応じて調整してください)
const pdfOptions =
  '&size=A4' +            // ページサイズ (A4, letterなど)
  '&portrait=true' +      // 向き (true:縦向き, false:横向き)
  '&fitw=true' +          // 幅に合わせる (true:有効)
  '&top_margin=0.50' +    // 上余白 (インチ単位)
  '&bottom_margin=0.50' +    // 下余白
  '&left_margin=0.50' +      // 左余白
  '&right_margin=0.50' +     // 右余白
  '&gridlines=false' +      // グリッドライン (false:非表示)
  '&printtitle=false' +      // スプレッドシートタイトル (false:非表示)
  '&sheetnames=false' +      // シート名 (false:非表示)
  '&fzr=false' +            // 固定行の繰り返し (false:なし)
  '&fzc=false' +            // 固定列の繰り返し (false:なし)
  '&attachment=true';      // ダウンロードダイアログではなく直接取得する
