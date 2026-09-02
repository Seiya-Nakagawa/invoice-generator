# Invoice Generator

Google Apps Script による請求書 PDF 生成・Gmail 下書き作成ツール。
**1つの共通ソースを、複数の取引先（スプレッドシート）へ配布して運用する。**

## 概要

Google スプレッドシートに紐付けたコンテナバインドスクリプトとして動作し、以下を自動化する。

1. **当月シート作成**: フォーマットシートをコピーして当月分（`YYYYMM`）の請求書シートを作成する
2. **PDF作成＆Gmail下書き**: 前月分のシートを PDF 化して Drive に保存し、共有リンク付きの Gmail 下書きを作成する

## リポジトリ構成

```text
.
├── src/                   # 全取引先で共通の実装（clasp の rootDir）
│   ├── main.gs            # エントリポイントとメイン処理
│   ├── config.gs          # 設定値の読み込み
│   └── appsscript.json    # GAS プロジェクト設定
├── clients/               # 取引先ごとの clasp 設定（scriptId のみが異なる）
│   ├── sj/.clasp.json
│   └── tz/.clasp.json
├── scripts/push.sh        # 取引先を指定して src/ を反映する
└── docs/
```

取引先ごとの差分は**すべて GAS のスクリプトプロパティ**で吸収するため、`src/` 配下は完全に共通である。

## 取引先ごとの設定（スクリプトプロパティ）

スクリプトエディタ → プロジェクトの設定 → スクリプト プロパティ で設定する。

| キー | 必須 | 既定値 | 用途 |
| ---- | ---- | ------ | ---- |
| `EMAIL_SUBJECT_TEMPLATE` | 必須 | なし | メール件名・PDF ファイル名のテンプレート（`{YEAR}` / `{MONTH}` を置換） |
| `EMAIL_TEMPLATE_LABEL` | 必須 | なし | 本文・宛先の雛形とする Gmail 下書きのラベル名 |
| `INVOICE_DATE_CELL` | 任意 | `J13` | 請求日（当月末）を書き込むセル |
| `DUE_DATE_CELL` | 任意 | `J14` | お支払い期限（翌月末）を書き込むセル |

`EMAIL_TEMPLATE_LABEL` は Gmail 検索の**先頭1件**の下書きを雛形として使うため、
取引先ごとに別のラベルを割り当てる（例: `SJ_請求書テンプレート` / `TZ_請求書テンプレート`）。

## 新しい取引先の追加手順

コードの変更は不要である。

1. 請求書スプレッドシートを用意し、バインドされた Apps Script の `scriptId` を控える
2. `clients/{名前}/.clasp.json` を追加する

   ```json
   {
     "scriptId": "{scriptId}",
     "rootDir": "../../src"
   }
   ```

3. 上表のスクリプトプロパティを設定し、Gmail に雛形の下書きとラベルを用意する
4. 反映する

   ```bash
   ./scripts/push.sh {名前}
   ```

## 開発

```bash
# 取引先の一覧を表示
./scripts/push.sh

# 特定の取引先へ反映
./scripts/push.sh tz

# すべての取引先へ反映
./scripts/push.sh all
```

`clasp` を直接使う場合は、対象の設定ファイルを `-P` で指定する。

```bash
clasp push -f -P clients/tz/.clasp.json
```

## 技術スタック

- Google Apps Script (GAS)
- Google Spreadsheet / Google Drive / Gmail
- clasp 3.x（`-P` による複数プロジェクト切り替えを利用）

## ドキュメント

- [要件定義書](docs/REQUIREMENTS.md)
- [基本設計書](docs/DESIGN.md)
