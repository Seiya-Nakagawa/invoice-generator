# Invoice Generator

Google Apps Scriptを使用した請求書自動生成システム。

## 概要
メール情報や設定に基づいて請求書を自動生成し、Googleドライブへの保存や送付を行うためのスクリプト群です。

## プロジェクト構造
- `mail_invoice/`: 請求書生成のメインロジック。
  - `main.gs`: メイン処理。
  - `config.gs`: 設定情報。
  - `appsscript.json`: プロジェクト設定。

## 主な機能
- **請求書自動生成**: スプレッドシートのテンプレートに基づいたPDF生成。
  - 請求書の日付（J13セル）を自動的に当月末日に設定。
- **メール連携**: 特定のメール受信をトリガーとした自動処理。
- **Googleドライブ保存**: 生成された請求書の自動保存。

## 技術スタック
- Google Apps Script (GAS)
- Google Spreadsheet / Google Drive
- clasp (管理ツール)

## 開発・デプロイ
`clasp`を使用して管理されています。
