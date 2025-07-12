/**
 * Claude Palette - レンダラープロセス
 * 
 * @description UIの動作とメインプロセスとの通信を管理
 */

import { ipcRenderer } from 'electron';

/**
 * Claude Code Slash Command の定義
 */
interface SlashCommand {
  /** コマンドの値（例: "/ask"） */
  value: string;
  /** 表示用ラベル */
  label: string;
  /** コマンドの説明 */
  description: string;
}

/**
 * コマンド実行結果
 */
interface CommandResult {
  /** 実行成功フラグ */
  success: boolean;
  /** 成功時の出力 */
  output?: string;
  /** エラー時のメッセージ */
  error?: string;
}


/**
 * ステータス表示の種類
 */
type StatusType = 'success' | 'error' | 'loading';

/**
 * Claude Paletteレンダラークラス
 */
class ClaudePaletteRenderer {
    private commandSelect: HTMLSelectElement;
    private inputText: HTMLTextAreaElement;
    private executeBtn: HTMLButtonElement;
    private closeBtn: HTMLButtonElement;
    private status: HTMLElement;
    private resultArea: HTMLElement;
    private resultContent: HTMLElement;
    private clearResultBtn: HTMLButtonElement;
    private availableCommands: SlashCommand[] = [];

    constructor() {
        // DOM要素を取得（型チェック付き）
        this.commandSelect = this.getElementByIdStrict<HTMLSelectElement>('command-select');
        this.inputText = this.getElementByIdStrict<HTMLTextAreaElement>('input-text');
        this.executeBtn = this.getElementByIdStrict<HTMLButtonElement>('execute-btn');
        this.closeBtn = this.getElementByIdStrict<HTMLButtonElement>('close-btn');
        this.status = this.getElementByIdStrict<HTMLElement>('status');
        this.resultArea = this.getElementByIdStrict<HTMLElement>('result-area');
        this.resultContent = this.getElementByIdStrict<HTMLElement>('result-content');
        this.clearResultBtn = this.getElementByIdStrict<HTMLButtonElement>('clear-result');

        this.initialize();
    }

    /**
     * 型安全なgetElementById
     */
    private getElementByIdStrict<T extends HTMLElement>(id: string): T {
        const element = document.getElementById(id) as T | null;
        if (!element) {
            throw new Error(`Element with id '${id}' not found`);
        }
        return element;
    }

    /**
     * レンダラープロセスを初期化
     */
    private async initialize(): Promise<void> {
        await this.loadCommands();
        this.populateCommands();
        this.setupEventListeners();
        this.focusInput();
    }

    /**
     * メインプロセスからコマンド一覧を取得
     */
    private async loadCommands(): Promise<void> {
        try {
            this.showStatus('loading', 'コマンドを読み込み中...');
            this.availableCommands = await ipcRenderer.invoke('get-claude-commands');
            console.log(`Loaded ${this.availableCommands.length} commands`);
            this.status.style.display = 'none';
        } catch (error) {
            console.error('Failed to load commands:', error);
            this.showStatus('error', 'コマンドの読み込みに失敗しました');
            // フォールバック: 空の配列
            this.availableCommands = [];
        }
    }

    /**
     * コマンドセレクトボックスにオプションを追加
     */
    private populateCommands(): void {
        // 既存のオプションをクリア
        this.commandSelect.innerHTML = '';

        // デフォルトオプションを追加
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'コマンドを選択...';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        this.commandSelect.appendChild(defaultOption);

        // 利用可能なコマンドを追加
        this.availableCommands.forEach((command: SlashCommand) => {
            const option = document.createElement('option');
            option.value = command.value;
            option.textContent = command.label;
            option.title = command.description;
            this.commandSelect.appendChild(option);
        });
    }

    /**
     * イベントリスナーを設定
     */
    private setupEventListeners(): void {
        // コマンド選択時
        this.commandSelect.addEventListener('change', () => {
            this.updateExecuteButton();
        });

        // テキスト入力時
        this.inputText.addEventListener('input', () => {
            this.updateExecuteButton();
        });

        // Enterキー（Cmd+Enter）で実行
        this.inputText.addEventListener('keydown', (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                if (!this.executeBtn.disabled) {
                    this.executeCommand();
                }
            }
        });

        // 実行ボタン
        this.executeBtn.addEventListener('click', () => {
            this.executeCommand();
        });

        // 閉じるボタン
        this.closeBtn.addEventListener('click', () => {
            this.closeWindow();
        });

        // 結果クリアボタン
        this.clearResultBtn.addEventListener('click', () => {
            this.hideResultArea();
        });

        // ESCキーで閉じる
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.closeWindow();
            }
        });
    }

    /**
     * 実行ボタンの有効/無効を更新
     */
    private updateExecuteButton(): void {
        const hasCommand = this.commandSelect.value.trim() !== '';
        const hasInput = this.inputText.value.trim() !== '';

        this.executeBtn.disabled = !hasCommand || !hasInput;
    }

    /**
     * 入力フィールドにフォーカス
     */
    private focusInput(): void {
        setTimeout(() => {
            this.inputText.focus();
        }, 100);
    }

    /**
     * コマンドを実行
     */
    private async executeCommand(): Promise<void> {
        const command = this.commandSelect.value;
        const input = this.inputText.value.trim();

        if (!command || !input) {
            this.showStatus('error', 'コマンドと入力テキストを選択してください。');
            return;
        }

        try {
            this.executeBtn.disabled = true;
            this.showStatus('loading', 'コマンドを実行中...');
            this.hideResultArea();

            const result: CommandResult = await ipcRenderer.invoke('execute-claude-command', command, input);

            if (result.success) {
                // テストモードかどうかを確認
                const isTestMode = result.output && result.output.includes('【テストモード】');

                if (isTestMode) {
                    this.showStatus('success', 'テストモード: コマンドはシミュレートされました');
                } else {
                    this.showStatus('success', 'コマンドが正常に実行されました。');
                }

                // 実行結果を表示
                if (result.output) {
                    this.showResultArea(result.output, false);
                }

                // ウィンドウを閉じない（結果を確認できるようにする）
            } else {
                this.showStatus('error', `エラー: ${result.error ?? 'Unknown error'}`);

                // エラーメッセージを表示
                if (result.error) {
                    this.showResultArea(result.error, true);
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.showStatus('error', `実行エラー: ${errorMessage}`);
            this.showResultArea(errorMessage, true);
        } finally {
            this.executeBtn.disabled = false;
            this.updateExecuteButton();
        }
    }

    /**
     * ステータスメッセージを表示
     * 
     * @param type - ステータスの種類
     * @param message - 表示するメッセージ
     */
    private showStatus(type: StatusType, message: string): void {
        this.status.className = `status ${type}`;

        if (type === 'loading') {
            this.status.innerHTML = `<span class="loader"></span>${message}`;
        } else {
            this.status.textContent = message;
        }

        this.status.style.display = 'block';

        // エラーや成功メッセージは自動で消える
        if (type !== 'loading') {
            setTimeout(() => {
                this.status.style.display = 'none';
            }, 3000);
        }
    }

    /**
     * ウィンドウを閉じる
     */
    private async closeWindow(): Promise<void> {
        await ipcRenderer.invoke('hide-window');
    }

    /**
     * 結果エリアを表示
     * 
     * @param content - 表示する内容
     * @param isError - エラーかどうか
     */
    private showResultArea(content: string, isError: boolean = false): void {
        this.resultContent.textContent = content;
        this.resultContent.className = `result-content ${isError ? 'error' : 'success'}`;
        this.resultArea.classList.add('visible');
    }

    /**
     * 結果エリアを非表示
     */
    private hideResultArea(): void {
        this.resultArea.classList.remove('visible');
        this.resultContent.textContent = '';
    }

    /**
     * フォームをリセット
     */
    public async resetForm(): Promise<void> {
        // コマンドを再読み込み（キャッシュが期限切れの場合に更新される）
        await this.loadCommands();
        this.populateCommands();

        this.commandSelect.value = '';
        this.inputText.value = '';
        this.status.style.display = 'none';
        this.hideResultArea();
        this.updateExecuteButton();
        this.focusInput();
    }
}

// グローバルスコープに追加（フォーカス時のリセット処理用）
(window as any).claudePaletteRenderer = null;

// DOM読み込み完了後にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    const renderer = new ClaudePaletteRenderer();
    (window as any).claudePaletteRenderer = renderer;
});

// ウィンドウが表示された時にフォームをリセット
window.addEventListener('focus', () => {
    // 少し遅延してからリセット（ウィンドウのフォーカス処理を待つ）
    setTimeout(async () => {
        if ((window as any).claudePaletteRenderer) {
            await (window as any).claudePaletteRenderer.resetForm();
        }
    }, 100);
});
