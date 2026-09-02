# GEMINI.md

このファイルは、本リポジトリ固有の事情を記録したものです。

基本方針・機密情報の取り扱い・Git 運用・コーディング規約・Markdown 記法などの共通規約は
グローバル規約（`~/.claude/CLAUDE.md`、`~/.gemini/GEMINI.md`、`~/.claude/rules/`）に従います。
**本ファイルに共通規約を重複定義しないこと。**

## 1. プロジェクト概要

Google スプレッドシートに紐づく Google Apps Script（コンテナバインドスクリプト）。
月次の請求書シートを作成し、PDF としてドライブへ保存したうえで Gmail の下書きを作成する。

- スクリプト ID: `1fr2xgJvUJ3HKcslQsPXeBc-eVElrIwvt39SPftbNeamAMglxUI9L1dFI`（`.clasp.json`）
- ソース配置: `mail_invoice/`（`.clasp.json` の `rootDir`）
- エントリポイント: `onOpen()` がスプレッドシートに追加するカスタムメニュー

設定値のみを変更した派生リポジトリとして `invoice-generator-tz` がある。
処理ロジックを変更する場合は、そちらへの反映要否も確認する。

## 2. デプロイ・動作確認

Web アプリ（`/exec`）として公開していないコンテナバインドスクリプトのため、
`~/.claude/rules/gas-deploy-flow.md` のうち `clasp deploy -i` による再デプロイは不要。
`clasp push -f` でスクリプトエディタへ反映した時点で最新コードが有効になる。

1. `clasp push -f` を実行する（AI が自動実行してよい）
   - 権限エラー（`The caller does not have permission`）が発生した場合は
     `clasp login --no-localhost` を実行し、ブラウザサブエージェントで認証を完了させる
2. **ユーザーにスプレッドシートのカスタムメニューからの動作確認を依頼し、結果を待つ。**
   AI は UI 操作ができないため、この手順を省略してはならない
3. 動作確認完了の連絡を受けてから Git 操作へ進む

## 3. 設定値

環境依存値はスクリプトプロパティで管理し、`mail_invoice/config.gs` から読み込む。

| キー | 用途 |
| ---- | ---- |
| `EMAIL_SUBJECT_TEMPLATE` | Gmail 下書きの件名テンプレート（`{YEAR}` / `{MONTH}` を置換）。PDF ファイル名にも流用する |

コード内に定数として保持する固有値は以下のとおり。

| 定数 | 値 | 用途 |
| ---- | -- | ---- |
| `FORMAT_SHEET_NAME` | `フォーマット` | 月次シートの複製元シート名 |
| `EMAIL_TEMPLATE_LABEL` | `SJ_請求書テンプレート` | 本文の雛形として使う Gmail 下書きのラベル名。宛先もこの下書きから引き継ぐ |

`mainProcessInvoice()` は `validateConfig()` で `FORMAT_SHEET_NAME` /
`EMAIL_SUBJECT_TEMPLATE` / `EMAIL_TEMPLATE_LABEL` の設定有無を起動時に検証する。

## 4. ドキュメント

`mail_invoice/` 配下のコードを変更した場合は、[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)・
[docs/DESIGN.md](docs/DESIGN.md) も必要に応じて更新する。
