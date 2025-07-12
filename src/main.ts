/**
 * Claude Palette - メインプロセス
 * 
 * @description macOSメニューバーアプリケーションのメインプロセス
 * メニューバーアイコンとポップオーバーウィンドウを管理
 */

import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, MenuItemConstructorOptions } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { CommandResult, WindowBounds, TrayBounds } from './types';

/**
 * Claude Paletteアプリケーションクラス
 */
class ClaudePalette {
  private tray: Tray | null = null;
  private window: BrowserWindow | null = null;
  private isQuitting: boolean = false;

  /**
   * アプリケーションを初期化
   */
  public initialize(): void {
    // macOSでDockアイコンを非表示にする
    if (process.platform === 'darwin') {
      app.dock?.hide();
    }

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
   * トレイアイコン用の画像を作成（簡単なテンプレートアイコン）
   */
  private createTrayIcon(): Electron.NativeImage {
    try {
      // アセットディレクトリからアイコンを読み込む
      const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
      const icon = nativeImage.createFromPath(iconPath);

      // macOSのテンプレートアイコンとして設定
      icon.setTemplateImage(true);

      return icon;
    } catch (error) {
      console.error('Failed to load icon from file:', error);

      // フォールバック: シンプルな16x16のアイコンを作成
      const fallbackIcon = nativeImage.createEmpty();
      const size = { width: 16, height: 16 };

      // 空の画像を作成し、サイズを設定
      fallbackIcon.setSize(size);

      // テンプレートアイコンとして設定
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
      height: 300,
      show: false,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    this.window.loadFile(path.join(__dirname, 'renderer.html'));

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
        // テスト用の簡単な実装 - 実際のClaude Codeではなくechoコマンドで動作確認
        const fullCommand = `echo "実行されたコマンド: ${command} | 入力: ${input}"`;

        const childProcess: ChildProcess = spawn(fullCommand, {
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });

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
            resolve({ 
              success: true, 
              output: output || `${command}コマンドが正常に実行されました。\n入力: ${input}` 
            });
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
