# SOL-Bot Todo形式ガイドライン

## 1. フォルダ & ファイル構成

```
repo-root/
 └── .todo/
      ├──  backlog.mdc    # 未着手タスク (inbox)
      ├──  sprint.mdc     # 今スプリントの WIP/Done
      ├──  todo-format.md # 本ガイドライン
      └──  archive.mdc    # 完了 3 ヵ月後にここへ移動
```

## 2. タスク行フォーマット

```
- [ ] TASK‑ID: <短いタイトル>  ← 1 行目は見出し
      - 📅 Due        : YYYY‑MM‑DD
      - 👤 Owner      : <GitHub ユーザー or @slack>
      - 🔗 Depends-on : TASK‑ID1, TASK‑ID2 ... (省略可)
      - 🏷️  Label      : bug / feat / doc / infra / test
      - 🩺 Health     : ⏳ / ⚠️ / 🚑 / ✅
      - 📊 Progress   : 0% / 25% / 50% / 75% / 100%
      - ✎ Notes      : (自由メモ 120 字以内)
```

## 3. フィールド説明

| フィールド | 説明 |
|------------|------|
| TASK‑ID    | カテゴリ3文字 + ハイフン + 3桁連番 (例: `ALG-001`) |
| Owner      | 担当者のGitHubユーザー名・Slackアカウント |
| Depends-on | 依存するタスクID（カンマ区切りで複数可）|
| Label      | タスクの種類: `feat`/`bug`/`doc`/`infra`/`test` |
| Health     | ⏳=WIP, ⚠️=遅延気味, 🚑=要救援, ✅=完了 |
| Progress   | 作業の進捗状況をパーセント表示 |
| Notes      | タスクの詳細、実装メモなど |

## 4. カテゴリ接頭辞一覧

| 接頭辞 | 意味 |
|--------|------|
| DAT    | データ収集・ETL |
| ALG    | 売買ロジック／バックテスト |
| OMS    | 発注・OMS 実装 |
| INF    | インフラ・CI/CD |
| CONF   | 設定関連 |
| OPT    | 最適化関連 |
| DOC    | ドキュメント |
| TST    | テスト |
| CICD   | CI/CD関連 |
| DEP    | 依存関係・パッケージ |
| BT     | バックテスト関連 |
| RISK   | リスク管理関連 |

## 5. ライフサイクル・ルール

1. **新規作成**: backlog.mdc に追加。Health = ⏳
2. **スプリント移動**: 週次で優先タスクを sprint.mdc へコピー
3. **状態更新**: コミット時に [ ]→[x] & Health✅
4. **クロージャ**: 3 か月経過で sprint.mdc から archive.mdc へ移動

## 6. Git 運用 Tips

- PR テンプレートに Fixes TASK‑ID を必ず入れて紐付け
- GitHub Actions で Todoタスク形式チェック
- PR タイトルに「XXX-000: 変更内容」の形式でタスクIDを含める

## 7. CI/CD連携

- GitHub Actions CI/CDパイプラインとの連携
  - PR作成時のTodoタスクID参照必須チェック
  - Todoファイル更新時のフォーマットチェック
  - マージ時のタスク状態自動更新 