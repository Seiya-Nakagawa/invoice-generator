# GEMINI.md

このファイルは、本リポジトリ固有の事情を記録したものです。

基本方針・機密情報の取り扱い・Git 運用・コーディング規約・Markdown 記法などの共通規約は
グローバル規約（`~/.claude/CLAUDE.md`、`~/.gemini/GEMINI.md`、`~/.claude/rules/`）に従います。
**本ファイルに共通規約を重複定義しないこと。**

## 1. プロジェクト概要

Google スプレッドシートに紐づく Google Apps Script（コンテナバインドスクリプト）。
月次の請求書シートを作成し、PDF としてドライブへ保存したうえで Gmail の下書きを作成する。

**1つの共通ソース（`src/`）を複数の取引先へ配布する構成**であり、取引先ごとの差分は
スクリプトプロパティで吸収する。`src/` 配下に取引先ごとの分岐を書いてはならない。

- ソース配置: `src/`（各 `.clasp.json` の `rootDir` が `../../src` を指す）
- エントリポイント: `onOpen()` がスプレッドシートに追加するカスタムメニュー

### 1.1. 取引先とスクリプト ID

| 取引先 | clasp 設定 | スクリプト ID |
| ------ | ---------- | ------------- |
| sj | `clients/sj/.clasp.json` | `1fr2xgJvUJ3HKcslQsPXeBc-eVElrIwvt39SPftbNeamAMglxUI9L1dFI` |
| tz | `clients/tz/.clasp.json` | `17GiHp-TztwkwJ6V62UaFoleNhrwOSiNX707_yVYR2OtFDG_CdPuEHeQP` |

`invoice-generator-tz` リポジトリは本リポジトリへ統合済みであり、Archive されている。

## 2. デプロイ・動作確認

Web アプリ（`/exec`）として公開していないコンテナバインドスクリプトのため、
`~/.claude/rules/gas-deploy-flow.md` のうち `clasp deploy -i` による再デプロイは不要。
`clasp push -f` でスクリプトエディタへ反映した時点で最新コードが有効になる。

1. `./scripts/push.sh {取引先}`（または `all`）を実行する（AI が自動実行してよい）
   - 内部で `clasp push -f -P clients/{取引先}/.clasp.json` を実行する
   - 権限エラー（`The caller does not have permission`）が発生した場合は
     `clasp login --no-localhost` を実行し、ブラウザサブエージェントで認証を完了させる
2. **`src/` を変更した場合は全取引先へ反映する。** 1つの取引先だけに反映すると実装が乖離する
3. **ユーザーにスプレッドシートのカスタムメニューからの動作確認を依頼し、結果を待つ。**
   AI は UI 操作ができないため、この手順を省略してはならない
4. 動作確認完了の連絡を受けてから Git 操作へ進む

## 3. 設定値

取引先ごとに異なる値はスクリプトプロパティで管理し、`src/config.gs` から読み込む。

| キー | 必須 | 既定値 | 用途 |
| ---- | ---- | ------ | ---- |
| `EMAIL_SUBJECT_TEMPLATE` | 必須 | なし | Gmail 下書きの件名テンプレート（`{YEAR}` / `{MONTH}` を置換）。PDF ファイル名にも流用する |
| `EMAIL_TEMPLATE_LABEL` | 必須 | なし | 本文の雛形として使う Gmail 下書きのラベル名。宛先もこの下書きから引き継ぐ |
| `INVOICE_DATE_CELL` | 任意 | `J13` | 請求日（当月末）を書き込むセル |
| `DUE_DATE_CELL` | 任意 | `J14` | お支払い期限（翌月末）を書き込むセル |

`EMAIL_TEMPLATE_LABEL` は Gmail 検索の先頭1件を雛形とするため、**取引先ごとに別のラベル**を割り当てる
（例: `SJ_請求書テンプレート` / `TZ_請求書テンプレート`）。共通ラベルにすると宛先を取り違える。

コード内に定数として保持する固有値は以下のとおり。

| 定数 | 値 | 用途 |
| ---- | -- | ---- |
| `FORMAT_SHEET_NAME` | `フォーマット` | 月次シートの複製元シート名 |

`validateConfig()` が各エントリポイントの冒頭で設定値の有無を検証する。

## 4. 新しい取引先の追加

1. `clients/{名前}/.clasp.json` を追加する（`scriptId` と `rootDir: ../../src`）
2. 対象スクリプトのスクリプトプロパティを設定する（第3章）
3. Gmail に雛形の下書きを作成し、固有のラベルを付与する
4. `./scripts/push.sh {名前}` を実行する

`src/` の変更は不要である。分岐を書く必要が生じた場合は、まずスクリプトプロパティで
吸収できないかを検討する。

## 5. ドキュメント

`src/` 配下のコードを変更した場合は、[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)・
[docs/DESIGN.md](docs/DESIGN.md) も必要に応じて更新する。
