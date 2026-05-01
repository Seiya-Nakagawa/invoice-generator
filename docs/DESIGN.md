# 基本設計書 — 請求書 PDF 化 & Gmail 下書き作成ツール

## 1. システム構成

- 実行環境: Google Apps Script（スプレッドシートにバインドされたコンテナ型スクリプト）。
- 利用サービス:
  - `SpreadsheetApp` — アクティブスプレッドシート/シート取得、UI（メニュー・アラート）。
  - `DriveApp` — PDF ファイル作成と保存先フォルダ取得。
  - `UrlFetchApp` — Google スプレッドシートの PDF エクスポート URL を直接呼び出し。
  - `ScriptApp` — `UrlFetchApp` のリクエストに付与する OAuth トークン取得。
  - `GmailApp` — 下書きメール作成。

## 2. ファイル構成

| パス | 役割 |
| ---- | ---- |
| `mail_invoice/main.gs` | エントリポイント関数とメイン処理ロジック |
| `mail_invoice/config.gs` | メール・PDF 関連の設定値（定数） |

### 3.1 `createNewMonthlySheet()` の流れ

1. 今日の日付から当月（1日〜末日）を判定し、シート名（例：「202404」）を決定する。
2. スプレッドシート内に同名のシートが既に存在する場合は、二重作成を避けるためアラートを表示して終了する。
3. `FORMAT_SHEET_NAME` で指定されたフォーマットシートをコピーし、新しいシート名を設定する。
4. 作成されたシートの J13, J14 に月初・月末日を設定する。

### 3.2 `mainProcessInvoice()` の流れ（手動実行）

1. アクティブスプレッドシートを取得する。
2. `getTargetYearMonth()` で対象年月を決定する。
3. YYYYMM 形式のシート名を取得し、そのシートを検索する。
4. スプレッドシートの親フォルダを取得する。
5. 指定されたシートを PDF としてエクスポート（`exportSheetAsPDF`）し、親フォルダに保存する。失敗時はログを残して処理中断。
6. PDF ファイルの共有 URL (`getUrl()`) を取得する。
7. 下書きテンプレートの `{YEAR}` `{MONTH}` `{リンク}` を置換する。
8. `GmailApp.createDraft()` で宛先・件名・本文（リンク含む）を指定して下書きを作成する。添付は行わない。
9. 例外発生時は最上位の `try/catch` でログ出力＋アラート表示。

## 4. 関数仕様

### 4.1 `onOpen()`

- 種別: シンプルトリガ。
- 処理: メニュー「請求書処理」に「当月シート作成」と「PDF作成＆Gmail下書き」項目を追加する。

### 4.2 `createNewMonthlySheet()`

- 種別: メニュー項目またはトリガ。
- 処理: フォーマットシートをコピーし、当月用の名前で新しいシートを作成する。

### 4.3 `mainProcessInvoice()`

- 種別: メニュー項目。
- 処理: PDF 作成と Drive 共有リンクを含む Gmail 下書き作成を統括する。

### 4.3 `getTargetYearMonth()`

- 入力: なし（実行時の `new Date()` を参照）。
- 出力: `{ year: number, month: number }`（`month` は 1〜12）。
- ロジック:

    1. 今日の日付を取得。
    2. `日付 <= 15` なら `setDate(0)` で前月末日にずらす。
    3. `日付 > 15` ならそのまま当月。
    4. `getFullYear()` と `getMonth() + 1` を返す。

### 4.5 `exportSheetAsPDF(spreadsheet, sheet, folder, pdfFileName)`

- 入力:
  - `spreadsheet` — 対象スプレッドシート。
  - `sheet` — PDF 化するシートオブジェクト。
  - `folder` — 保存先 Google ドライブフォルダ。
  - `pdfFileName` — 保存ファイル名。
- 出力: 作成された `File` オブジェクト（成功時）／ `null`（失敗時）。
- 処理:
    1. 指定された `sheet` の `sheetId`（GID）を取得し、PDF エクスポート URL を組み立てる。
    2. `ScriptApp.getOAuthToken()` で取得したアクセストークンを `Authorization` ヘッダに付けて `UrlFetchApp.fetch()` を実行（`muteHttpExceptions: true`）。
    3. HTTP 200 のとき、レスポンスの Blob にファイル名を設定し、`folder.createFile(blob)` で保存。
    4. 200 以外、または例外発生時はアラート表示し `null` を返す。

## 5. 設定項目（`config.gs`）

| `FORMAT_SHEET_NAME` | フォーマットシートの名前 | — |
| `EMAIL_TEMPLATE_LABEL` | 本文の雛形として使用する「下書き」のラベル名 | — |
| `EMAIL_SUBJECT_TEMPLATE` | Gmail 下書きの件名テンプレート | `{YEAR}` `{MONTH}` |
| `PDF_FILENAME_TEMPLATE_CONFIG` | 出力 PDF のファイル名テンプレート | — |
| `pdfOptions` | PDF エクスポート URL に付与するクエリ文字列 | — |

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

## 6. PDF エクスポート URL 仕様

ベース URL は以下のとおりで、末尾に `pdfOptions` を連結する。

```text
https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/export?format=pdf&gid={SHEET_ID}{pdfOptions}
```

- `{SPREADSHEET_ID}`: アクティブスプレッドシートの ID。
- `{SHEET_ID}`: アクティブシートの GID（`Sheet#getSheetId()`）。

リクエストには `Authorization: Bearer <OAuth トークン>` ヘッダを付ける。

## 7. 例外処理方針

| 発生箇所 | 処理 |
| -------- | ---- |
| スプレッドシートに親フォルダなし | `Logger.log` ＋ `alert` で通知し、`return` で中断 |
| PDF エクスポート HTTP エラー（200 以外） | レスポンスコードと本文を `Logger.log` ＋ `alert` で通知し、`null` を返却 |
| `UrlFetchApp.fetch()` 例外 | 例外メッセージを `Logger.log` ＋ `alert` で通知し、`null` を返却 |
| `mainProcessInvoice()` 全体の予期せぬ例外 | スタックトレースを `Logger.log` し、`alert` で通知 |

## 8. 既知の課題

ドキュメント化時点で確認されたコード上の小さな不整合。今回はドキュメント化のみ実施し、コード修正は別タスクとする。

- `mail_invoice/config.gs:18` — 署名テンプレート中の `"株式会社 〇〇n"` は、改行を意図した `\n` の打ち間違いの可能性がある。
- `mail_invoice/main.gs:27` — コメントには「月を 2 桁表示」とあるが、実際は `month.toString()` のみでありゼロ埋めはされない（5 月は `"5"` のまま、`{MONTH}` 置換結果も同様）。要件 3.4・PDF ファイル名の `{YEAR_MONTH}` 仕様（「YYYY年M月」）は現行コードの挙動に合わせている。
