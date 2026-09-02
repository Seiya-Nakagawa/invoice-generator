# 基本設計書 — 請求書 PDF 化 & Gmail 下書き作成ツール

## 1. システム構成

- 実行環境: Google Apps Script（スプレッドシートにバインドされたコンテナ型スクリプト）。
- 配布形態: 1つの共通ソース（`src/`）を、取引先ごとの GAS プロジェクトへ `clasp` で反映する。
- 利用サービス:
  - `SpreadsheetApp` — アクティブスプレッドシート/シート取得、UI（メニュー・アラート）。
  - `DriveApp` — PDF ファイル作成と保存先フォルダ取得。
  - `UrlFetchApp` — Google スプレッドシートの PDF エクスポート URL を直接呼び出し。
  - `ScriptApp` — `UrlFetchApp` のリクエストに付与する OAuth トークン取得。
  - `GmailApp` — 下書きメール作成。
  - `PropertiesService` — 取引先ごとの設定値（スクリプトプロパティ）の読み込み。

## 2. ファイル構成

| パス | 役割 |
| ---- | ---- |
| `src/main.gs` | エントリポイント関数とメイン処理ロジック（全取引先で共通） |
| `src/config.gs` | 設定値の読み込みと既定値の定義（全取引先で共通） |
| `src/appsscript.json` | GAS プロジェクト設定（全取引先で共通） |
| `clients/{取引先}/.clasp.json` | 取引先ごとの `scriptId` と `rootDir`（`../../src`） |
| `scripts/push.sh` | 取引先を指定して `src/` を反映するスクリプト |

## 3. 複数取引先への配布方式

### 3.1 方式

取引先ごとに異なるのは、バインド先スプレッドシートの `scriptId` と、
スクリプトプロパティで与える設定値のみである。ソースコードは分岐を持たない。

`clasp` の `-P` オプションでプロジェクト設定ファイルを切り替えることで、
同一の `src/` を複数の GAS プロジェクトへ反映する。

```bash
clasp push -f -P clients/{取引先}/.clasp.json
```

`scripts/push.sh` は `clients/` 配下を走査して上記を実行するラッパーであり、
`all` を指定した場合はすべての取引先へ順に反映する。

### 3.2 取引先の追加

1. `clients/{取引先}/.clasp.json` を追加する（`scriptId` と `rootDir: ../../src`）。
2. 対象スクリプトのスクリプトプロパティを設定する（第6章）。
3. Gmail に雛形の下書きを作成し、取引先固有のラベルを付与する。
4. `./scripts/push.sh {取引先}` を実行する。

ソースコードの変更は不要である。

## 4. 処理フロー

### 4.1 `createNewMonthlySheet()` の流れ

1. `validateConfig()` で `FORMAT_SHEET_NAME` / `INVOICE_DATE_CELL` / `DUE_DATE_CELL` の
   設定有無を検証する。
2. 実行日から当月のシート名（例: `202404`）を決定する。
3. 同名のシートが既に存在する場合は、二重作成を避けるためアラートを表示して終了する。
4. `FORMAT_SHEET_NAME` で指定されたフォーマットシートをコピーし、新しいシート名を設定する。
5. `INVOICE_DATE_CELL` に当月末日、`DUE_DATE_CELL` に翌月末日を `yyyy/MM/dd` 形式で書き込む。

### 4.2 `mainProcessInvoice()` の流れ

1. `validateConfig()` で `FORMAT_SHEET_NAME` / `EMAIL_SUBJECT_TEMPLATE` /
   `EMAIL_TEMPLATE_LABEL` の設定有無を検証する。
2. `getTargetYearMonth()` で対象年月（実行日の前月）を決定する。
3. `EMAIL_SUBJECT_TEMPLATE` の `{YEAR}` `{MONTH}` を置換し、メール件名と PDF ファイル名を決定する。
4. `YYYYMM` 形式のシートを検索する。存在しない場合は例外とする。
5. スプレッドシートの親フォルダを取得する。ゴミ箱内の場合は例外とする。
6. 保存先フォルダに同名の PDF が存在する場合は、上書きせずアラートを表示して終了する。
7. 対象シートを PDF としてエクスポート（`exportSheetAsPDF()`）し、親フォルダに保存する。
8. PDF ファイルの共有 URL (`getUrl()`) を取得する。
9. `EMAIL_TEMPLATE_LABEL` のラベルが付いた Gmail 下書きを検索し、先頭1件から宛先と本文を取得する。
10. 本文の `{YEAR}` `{MONTH}` `{リンク}` を置換する。`{リンク}` がない場合は本文末尾にリンクを追記する。
11. `GmailApp.createDraft()` で下書きを作成する。PDF の添付は行わない。
12. 例外発生時は最上位の `try/catch` でログ出力＋アラート表示のうえ、再スローする。

## 5. 関数仕様

### 5.1 `onOpen()`

- 種別: シンプルトリガ。
- 処理: メニュー「請求書処理」に「当月シート作成」と「PDF作成＆Gmail下書き」項目を追加する。

### 5.2 `validateConfig(keys)`

- 入力: 検証する設定キー名の配列。
- 処理: `config.gs` の設定値を参照し、未設定（`null` / `undefined` / 空文字）のキーがあれば例外を送出する。

### 5.3 `createNewMonthlySheet()`

- 種別: メニュー項目またはトリガ。
- 処理: フォーマットシートをコピーし、当月用の名前で新しいシートを作成して日付を書き込む。

### 5.4 `mainProcessInvoice()`

- 種別: メニュー項目。
- 処理: PDF 作成と Drive 共有リンクを含む Gmail 下書き作成を統括する。

### 5.5 `getTargetYearMonth()`

- 入力: なし（実行時の `new Date()` を参照）。
- 出力: `{ year: number, month: number }`（`month` は 1〜12）。
- ロジック: 実行日の前月を返す。`month` はゼロ埋めしない（5 月は `5`）。

### 5.6 `showAlert(message)`

- 処理: 先に `Logger.log` へ出力したうえで、UI が利用可能な場合のみ `alert` を表示する。
  トリガー実行時は `SpreadsheetApp.getUi()` が例外を送出するため、捕捉して無視する。

### 5.7 `exportSheetAsPDF(spreadsheet, sheet, folder, pdfFileName)`

- 入力:
  - `spreadsheet` — 対象スプレッドシート。
  - `sheet` — PDF 化するシートオブジェクト。
  - `folder` — 保存先 Google ドライブフォルダ。
  - `pdfFileName` — 保存ファイル名。
- 出力: 作成された `File` オブジェクト。
- 処理:
    1. 指定された `sheet` の `sheetId`（GID）を取得し、PDF エクスポート URL を組み立てる。
    2. `ScriptApp.getOAuthToken()` で取得したアクセストークンを `Authorization` ヘッダに付けて
       `UrlFetchApp.fetch()` を実行（`muteHttpExceptions: true`）。
    3. HTTP 200 のとき、レスポンスの Blob にファイル名を設定し、`folder.createFile(blob)` で保存。
    4. 200 以外、または例外発生時はログ出力のうえ例外を呼び出し元へ伝播させる。

## 6. 設定項目

### 6.1 スクリプトプロパティ（取引先ごと）

| キー | 必須 | 既定値 | 用途 |
| ---- | ---- | ------ | ---- |
| `EMAIL_SUBJECT_TEMPLATE` | 必須 | なし | メール件名・PDF ファイル名のテンプレート（`{YEAR}` `{MONTH}` を置換） |
| `EMAIL_TEMPLATE_LABEL` | 必須 | なし | 本文・宛先の雛形とする Gmail 下書きのラベル名 |
| `INVOICE_DATE_CELL` | 任意 | `J13` | 請求日（当月末）を書き込むセル |
| `DUE_DATE_CELL` | 任意 | `J14` | お支払い期限（翌月末）を書き込むセル |

請求書フォーマットの列構成が標準と異なる取引先のみ、`INVOICE_DATE_CELL` / `DUE_DATE_CELL` を設定する。

### 6.2 コード内の定数（`src/config.gs`）

| 定数 | 値 | 用途 |
| ---- | -- | ---- |
| `FORMAT_SHEET_NAME` | `フォーマット` | 月次シートの複製元シート名 |
| `DEFAULT_INVOICE_DATE_CELL` | `J13` | `INVOICE_DATE_CELL` 未設定時の既定値 |
| `DEFAULT_DUE_DATE_CELL` | `J14` | `DUE_DATE_CELL` 未設定時の既定値 |
| `pdfOptions` | 後述 | PDF エクスポート URL に付与するクエリ文字列 |

`pdfOptions` の現行値は次のとおり。

- `size=A4` — A4 サイズ
- `portrait=true` — 縦向き
- `fitw=true` — 幅にフィット
- `top_margin=0.50` / `bottom_margin=0.50` / `left_margin=0.50` / `right_margin=0.50` — 上下左右余白 0.5 インチ
- `gridlines=false` — グリッドライン非表示
- `printtitle=false` — スプレッドシートタイトル非表示
- `sheetnames=false` — シート名非表示
- `fzr=false` / `fzc=false` — 固定行・固定列の繰り返しなし
- `attachment=true` — 直接ダウンロード（ダイアログ抑止）

## 7. PDF エクスポート URL 仕様

ベース URL は以下のとおりで、末尾に `pdfOptions` を連結する。

```text
https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=pdf&gid={SHEET_ID}{pdfOptions}
```

- `{SPREADSHEET_ID}`: アクティブスプレッドシートの ID。
- `{SHEET_ID}`: 対象シートの GID（`Sheet#getSheetId()`）。

リクエストには `Authorization: Bearer <OAuth トークン>` ヘッダを付ける。
非表示の行・列はエクスポート結果に含まれない。

## 8. 例外処理方針

| 発生箇所 | 処理 |
| -------- | ---- |
| 設定値（スクリプトプロパティ）の未設定 | 不足キーを列挙した例外を送出し、最上位の `catch` で通知・再スロー |
| 対象シートが存在しない | 例外を送出し、最上位の `catch` で通知・再スロー |
| スプレッドシートの親フォルダがゴミ箱内 | 例外を送出し、最上位の `catch` で通知・再スロー |
| 同名の PDF が既に存在 | 異常ではないため、アラート表示のうえ処理をスキップして正常終了 |
| PDF エクスポート HTTP エラー（200 以外）・`fetch()` 例外 | `Logger.log` に記録し、呼び出し元へ例外を伝播 |
| 各エントリポイント全体の予期せぬ例外 | `Logger.log` ＋ `showAlert` で通知したうえで再スローし、トリガー実行時に GAS の失敗通知メールを発生させる |
