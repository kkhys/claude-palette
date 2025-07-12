/**
 * Claude Palette - メインプロセス
 * 
 * @description macOSメニューバーアプリケーションのメインプロセス
 * メニューバーアイコンとポップオーバーウィンドウを管理
 */

import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, MenuItemConstructorOptions } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { CommandResult, WindowBounds, TrayBounds, SlashCommand } from './types';

/**
 * Claude Paletteアプリケーションクラス
 */
class ClaudePalette {
  private tray: Tray | null = null;
  private window: BrowserWindow | null = null;
  private isQuitting: boolean = false;
  private commandsCache: SlashCommand[] | null = null;
  private commandsCacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分

  /**
   * アプリケーションを初期化
   */
  public initialize(): void {
    // macOSでDockアイコンを非表示にする
    if (process.platform === 'darwin') {
      app.dock?.hide();
    }

    // ハードウェアアクセラレーションを無効化（IMKエラー対策）
    app.disableHardwareAcceleration();

    app.whenReady().then(() => {
      console.log('App is ready, creating tray...');
      this.createTray();
      this.createWindow();
      this.setupEventHandlers();
      console.log('Tray created successfully');
    });

    app.on('before-quit', () => {
      this.isQuitting = true;
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  }

  /**
   * システムトレイアイコンを作成
   */
  private createTray(): void {
    try {
      console.log('Creating tray icon...');
      const icon = this.createTrayIcon();
      console.log('Tray icon created, initializing Tray...');
      this.tray = new Tray(icon);
      console.log('Tray initialized successfully');

      this.tray.setToolTip('Claude Palette');

    // トレイアイコンクリック時の動作
    this.tray.on('click', () => {
      this.toggleWindow();
    });

    // 右クリックメニュー
    const contextMenu: MenuItemConstructorOptions[] = [
      {
        label: 'Claude Palette を開く',
        click: () => this.showWindow()
      },
      { type: 'separator' },
      {
        label: '終了',
        click: () => {
          this.isQuitting = true;
          app.quit();
        }
      }
    ];

    this.tray.setContextMenu(Menu.buildFromTemplate(contextMenu));
    } catch (error) {
      console.error('Failed to create tray:', error);
    }
  }

  /**
   * トレイアイコン用の画像をコードで生成
   */
  private createTrayIcon(): Electron.NativeImage {
    // SVGベースのアイコンを作成（16x16px、macOSメニューバー用）
    const svgIcon = `
      <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
        <g fill="currentColor">
          <!-- パレットの形状 -->
          <path d="M8 2C5.79 2 4 3.79 4 6c0 1.5.8 2.8 2 3.5v2c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-2c1.2-.7 2-2 2-3.5 0-2.21-1.79-4-4-4z"/>
          <!-- パレットの穴 -->
          <circle cx="6.5" cy="5.5" r="0.8" fill="white"/>
          <circle cx="9.5" cy="5.5" r="0.8" fill="white"/>
          <circle cx="8" cy="7.5" r="0.8" fill="white"/>
          <!-- ブラシのハンドル -->
          <rect x="7.5" y="11.5" width="1" height="2.5" rx="0.5"/>
        </g>
      </svg>
    `;

    try {
      // SVGからNativeImageを作成
      const icon = nativeImage.createFromBuffer(Buffer.from(svgIcon));

      // macOSのテンプレートアイコンとして設定（ダークモード対応）
      icon.setTemplateImage(true);

      return icon;
    } catch (error) {
      console.error('Failed to create SVG icon:', error);

      // フォールバック: シンプルなドットアイコン
      const fallbackSvg = `
        <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="3" fill="currentColor"/>
          <circle cx="8" cy="8" r="1.5" fill="white"/>
        </svg>
      `;

      const fallbackIcon = nativeImage.createFromBuffer(Buffer.from(fallbackSvg));
      fallbackIcon.setTemplateImage(true);

      return fallbackIcon;
    }
  }

  /**
   * ポップオーバーウィンドウを作成
   */
  private createWindow(): void {
    this.window = new BrowserWindow({
      width: 400,
      height: 400,
      show: false,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableWebSQL: false // IMKエラー対策
      }
    });

    this.window.loadFile(path.join(__dirname, 'renderer.html'));

    // 開発モードでは開発者ツールを開く
    if (process.argv.includes('--dev')) {
      this.window.webContents.openDevTools({ mode: 'detach' });
    }

    // ウィンドウがフォーカスを失った時に隠す
    this.window.on('blur', () => {
      if (!this.isQuitting) {
        this.window?.hide();
      }
    });

    // ウィンドウが閉じられようとした時の処理
    this.window.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.window?.hide();
      }
    });
  }

  /**
   * ウィンドウの表示/非表示を切り替え
   */
  private toggleWindow(): void {
    if (!this.window) return;

    if (this.window.isVisible()) {
      this.window.hide();
    } else {
      this.showWindow();
    }
  }

  /**
   * ウィンドウを表示し、トレイアイコンの下に配置
   */
  private showWindow(): void {
    if (!this.tray || !this.window) return;

    const trayBounds: TrayBounds = this.tray.getBounds();
    const windowBounds: WindowBounds = this.window.getBounds();

    // ウィンドウをトレイアイコンの下中央に配置
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
    const y = Math.round(trayBounds.y + trayBounds.height + 4);

    this.window.setPosition(x, y, false);
    this.window.show();
    this.window.focus();
  }

  /**
   * IPCイベントハンドラーを設定
   */
  private setupEventHandlers(): void {
    // Claude Codeコマンド実行
    ipcMain.handle('execute-claude-command', async (_event, command: string, input: string): Promise<CommandResult> => {
      return await this.executeClaudeCommand(command, input);
    });

    // ウィンドウを隠す
    ipcMain.handle('hide-window', (): void => {
      this.window?.hide();
    });

    // Claude Codeのslash command一覧を取得
    ipcMain.handle('get-claude-commands', async (): Promise<SlashCommand[]> => {
      return await this.getClaudeCommands();
    });
  }

  /**
   * Claude Codeから利用可能なslash command一覧を取得
   * ~/.claude/commands ディレクトリからコマンドファイルを読み取る
   * 
   * @returns 利用可能なslash commandの配列
   */
  private async getClaudeCommands(): Promise<SlashCommand[]> {
    // キャッシュが有効かチェック
    const now = Date.now();
    if (this.commandsCache && (now - this.commandsCacheTimestamp) < this.CACHE_DURATION) {
      console.log('Using cached Claude commands');
      return this.commandsCache;
    }

    console.log('Fetching fresh Claude commands...');
    try {
      // ~/.claude/commands ディレクトリからコマンドを取得
      const commandsFromFiles = await this.getCommandsFromDirectory();

      // ファイルベースのコマンドとフォールバックコマンドを結合
      const allCommands = [...commandsFromFiles, ...this.getFallbackCommands()];

      // 重複を除去（ファイルベースのコマンドを優先）
      const uniqueCommands = this.removeDuplicateCommands(allCommands);

      this.cacheCommands(uniqueCommands);
      return uniqueCommands;
    } catch (err) {
      console.warn('Error getting Claude commands from files, using fallback only:', err);
      const fallbackCommands = this.getFallbackCommands();
      this.cacheCommands(fallbackCommands);
      return fallbackCommands;
    }
  }

  /**
   * ~/.claude/commands ディレクトリからコマンドファイルを読み取る
   * 
   * @returns ファイルから読み取ったslash commandの配列
   */
  private async getCommandsFromDirectory(): Promise<SlashCommand[]> {
    const commandsDir = path.join(os.homedir(), '.claude', 'commands');
    const commands: SlashCommand[] = [];

    try {
      // ディレクトリが存在するかチェック
      if (!fs.existsSync(commandsDir)) {
        console.log('~/.claude/commands directory does not exist');
        return commands;
      }

      // ディレクトリ内のファイルを取得
      const files = fs.readdirSync(commandsDir);
      console.log(`Found ${files.length} files in ~/.claude/commands`);

      for (const file of files) {
        // ファイル名がコマンド名となる（拡張子は除く）
        const commandName = path.parse(file).name;
        const filePath = path.join(commandsDir, file);

        try {
          // ファイルの統計情報を取得
          const stats = fs.statSync(filePath);

          // ディレクトリや非表示ファイルはスキップ
          if (stats.isDirectory() || file.startsWith('.')) {
            continue;
          }

          // ファイルの最初の数行を読み取って説明を取得
          const description = await this.getCommandDescription(filePath);

          const value = `/${commandName}`;
          commands.push({
            value,
            label: `${value} - ${description}`,
            description
          });

          console.log(`Added command: ${value}`);
        } catch (fileErr) {
          console.warn(`Error processing command file ${file}:`, fileErr);
        }
      }

      return commands;
    } catch (err) {
      console.error('Error reading commands directory:', err);
      return commands;
    }
  }

  /**
   * コマンドファイルから説明を取得
   * 
   * @param filePath - コマンドファイルのパス
   * @returns コマンドの説明
   */
  private async getCommandDescription(filePath: string): Promise<string> {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // コメント行から説明を抽出
      for (const line of lines.slice(0, 10)) { // 最初の10行のみチェック
        const trimmed = line.trim();

        // bashスクリプトのコメント
        if (trimmed.startsWith('# ') && !trimmed.startsWith('#!/')) {
          return trimmed.substring(2).trim();
        }

        // その他のコメント形式
        if (trimmed.startsWith('// ') || trimmed.startsWith('/* ')) {
          return trimmed.replace(/^(\/\/|\/\*)\s*/, '').replace(/\*\/$/, '').trim();
        }
      }

      // コメントが見つからない場合はファイル名ベースの説明
      const commandName = path.parse(filePath).name;
      return `${commandName} コマンドを実行`;
    } catch (err) {
      console.warn(`Error reading file ${filePath}:`, err);
      return 'カスタムコマンド';
    }
  }

  /**
   * 重複するコマンドを除去（最初に見つかったものを優先）
   * 
   * @param commands - コマンドの配列
   * @returns 重複を除去したコマンドの配列
   */
  private removeDuplicateCommands(commands: SlashCommand[]): SlashCommand[] {
    const seen = new Set<string>();
    return commands.filter(cmd => {
      if (seen.has(cmd.value)) {
        return false;
      }
      seen.add(cmd.value);
      return true;
    });
  }

  /**
   * コマンドをキャッシュに保存
   * 
   * @param commands - キャッシュするcommandの配列
   */
  private cacheCommands(commands: SlashCommand[]): void {
    this.commandsCache = commands;
    this.commandsCacheTimestamp = Date.now();
    console.log(`Cached ${commands.length} commands`);
  }


  /**
   * Claude Codeが利用できない場合のフォールバックcommand一覧
   * 
   * @returns デフォルトのslash commandの配列
   */
  private getFallbackCommands(): SlashCommand[] {
    return [
      // { value: '/ask', label: '/ask - Claude に質問する', description: 'Claude AI に質問を送信' },
      // { value: '/chat', label: '/chat - チャットを開始', description: 'インタラクティブなチャットセッションを開始' },
      // { value: '/edit', label: '/edit - ファイルを編集', description: 'ファイルの編集を行う' },
      // { value: '/create', label: '/create - ファイルを作成', description: '新しいファイルを作成' },
      // { value: '/explain', label: '/explain - コードを説明', description: 'コードの説明を取得' },
      // { value: '/fix', label: '/fix - エラーを修正', description: 'コードのエラーや問題を修正' },
      // { value: '/optimize', label: '/optimize - コードを最適化', description: 'コードのパフォーマンスを改善' },
      // { value: '/test', label: '/test - テストを作成', description: 'テストコードを生成' },
      // { value: '/debug', label: '/debug - デバッグ支援', description: 'デバッグの手助けを提供' },
      // { value: '/refactor', label: '/refactor - リファクタリング', description: 'コードをリファクタリング' },
      // { value: '/review', label: '/review - コードレビュー', description: 'コードレビューを実行' },
      // { value: '/docs', label: '/docs - ドキュメント作成', description: 'ドキュメントを生成' }
    ];
  }

  /**
   * Claude Codeコマンドを実行
   * 
   * @param command - 実行するslash command
   * @param input - 入力テキスト
   * @returns コマンド実行結果
   */
  private async executeClaudeCommand(command: string, input: string): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve) => {
      try {
        // 実際のClaude Codeコマンドを実行
        // 環境変数でテストモードを制御（デフォルトはテストモード）
        const isTestMode = process.env['CLAUDE_PALETTE_TEST_MODE'] !== 'false';

        let childProcess: ChildProcess;

        if (isTestMode) {
          // テストモード: echoコマンドで動作確認
          const fullCommand = `echo "実行されたコマンド: ${command} | 入力: ${input}"`;
          childProcess = spawn(fullCommand, {
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe']
          });
        } else {
          // 本番モード: 実際のClaude Codeを実行
          // claude -p "/command input text" の形式で実行
          const fullCommand = `${command} ${input}`;
          const claudeArgs = ['-p', fullCommand];

          childProcess = spawn('claude', claudeArgs, {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd()
          });
        }

        let output = '';
        let error = '';

        childProcess.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
          error += data.toString();
        });

        childProcess.on('close', (code: number | null) => {
          if (code === 0) {
            if (isTestMode) {
              resolve({ 
                success: true, 
                output: output || `【テストモード】実際のコマンドは実行されていません。\n実行されたコマンド: ${command}\n入力: ${input}` 
              });
            } else {
              resolve({ 
                success: true, 
                output: output || `${command}コマンドが正常に実行されました。\n入力: ${input}` 
              });
            }
          } else {
            resolve({ 
              success: false, 
              error: error || 'コマンドの実行に失敗しました' 
            });
          }
        });

        // タイムアウト設定（30秒）
        setTimeout(() => {
          childProcess.kill();
          resolve({ 
            success: false, 
            error: 'コマンドがタイムアウトしました' 
          });
        }, 30000);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        resolve({ 
          success: false, 
          error: errorMessage 
        });
      }
    });
  }
}

// アプリケーション起動
const claudePalette = new ClaudePalette();
claudePalette.initialize();
