# Claude Palette

Claude CodeのスラッシュコマンドをmacOSメニューバーから素早く実行するためのアプリケーションです。

## 概要

Claude Paletteは、macOSのメニューバーに常駐し、Claude Codeのスラッシュコマンドを簡単に実行できるようにするツールです。コマンドパレットのようなインターフェースを通じて、Claude Codeの機能に素早くアクセスできます。

## 特徴

- macOSメニューバーに常駐し、クリック一つで起動
- Claude Codeのスラッシュコマンド（`/ask`、`/edit`など）を簡単に実行
- カスタムコマンドのサポート（`~/.claude/commands`ディレクトリから読み込み）
- キーボードショートカット（Cmd+Enterで実行、Escで閉じる）
- ダークモード対応

## インストール方法

### 前提条件

- macOS
- [Node.js](https://nodejs.org/) (v14以上)
- [Claude Code CLI](https://github.com/anthropic-labs/claude-code)がインストールされていること

### インストール手順

1. リポジトリをクローン：
   ```bash
   git clone https://github.com/yourusername/claude-palette.git
   cd claude-palette
   ```

2. 依存関係をインストール：
   ```bash
   npm install
   ```

3. アプリケーションをビルド：
   ```bash
   npm run build
   ```

4. アプリケーションを実行：
   ```bash
   npm start
   ```

### アプリケーションのパッケージ化

macOSアプリケーションとしてパッケージ化するには：

```bash
npm run dist
```

これにより、`dist`ディレクトリに`.dmg`ファイルが作成されます。

## 使い方

1. メニューバーのClaude Paletteアイコンをクリックしてポップアップウィンドウを開きます
2. ドロップダウンメニューからスラッシュコマンドを選択します
3. テキスト入力欄に処理したいテキストを入力します
4. 「実行」ボタンをクリックするか、Cmd+Enterを押してコマンドを実行します
5. 実行結果がポップアップウィンドウに表示されます

## カスタムコマンド

`~/.claude/commands`ディレクトリにファイルを配置することで、カスタムコマンドを追加できます：

1. `~/.claude/commands`ディレクトリを作成します（存在しない場合）
2. コマンド名をファイル名としたファイルを作成します（例：`mycommand`）
3. ファイルの先頭にコメントとして説明を追加します（例：`# カスタムコマンドの説明`）
4. ファイルを実行可能にします：`chmod +x ~/.claude/commands/mycommand`

これにより、`/mycommand`がClaude Paletteで利用可能になります。

## 開発

### 開発モードでの実行

```bash
npm run dev
```

開発モードでは開発者ツールが自動的に開きます。

### テストモード

テストモードでは、実際のClaude Codeコマンドは実行されず、代わりにシミュレーションが行われます：

```bash
npm run dev:test
```

## ライセンス

[MIT](license.md)
