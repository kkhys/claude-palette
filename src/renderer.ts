/**
 * Claude Palette - レンダラープロセス
 * 
 * @description UIの動作とメインプロセスとの通信を管理
 */

import { ipcRenderer } from 'electron';
import { SlashCommand, CommandResult } from './types';

/**
 * Claude Code Slash Commands の定義
 */
const SLASH_COMMANDS: SlashCommand[] = [
    { value: '/ask', label: '/ask - Claude に質問する', description: 'Claude AI に質問を送信' },
    { value: '/chat', label: '/chat - チャットを開始', description: 'インタラクティブなチャットセッションを開始' },
    { value: '/edit', label: '/edit - ファイルを編集', description: 'ファイルの編集を行う' },
    { value: '/create', label: '/create - ファイルを作成', description: '新しいファイルを作成' },
    { value: '/explain', label: '/explain - コードを説明', description: 'コードの説明を取得' },
    { value: '/fix', label: '/fix - エラーを修正', description: 'コードのエラーや問題を修正' },
    { value: '/optimize', label: '/optimize - コードを最適化', description: 'コードのパフォーマンスを改善' },
    { value: '/test', label: '/test - テストを作成', description: 'テストコードを生成' },
    { value: '/debug', label: '/debug - デバッグ支援', description: 'デバッグの手助けを提供' },
    { value: '/refactor', label: '/refactor - リファクタリング', description: 'コードをリファクタリング' },
    { value: '/review', label: '/review - コードレビュー', description: 'コードレビューを実行' },
    { value: '/docs', label: '/docs - ドキュメント作成', description: 'ドキュメントを生成' }
];

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

    constructor() {
        // DOM要素を取得（型チェック付き）
        this.commandSelect = this.getElementByIdStrict<HTMLSelectElement>('command-select');
        this.inputText = this.getElementByIdStrict<HTMLTextAreaElement>('input-text');
        this.executeBtn = this.getElementByIdStrict<HTMLButtonElement>('execute-btn');
        this.closeBtn = this.getElementByIdStrict<HTMLButtonElement>('close-btn');
        this.status = this.getElementByIdStrict<HTMLElement>('status');
        
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
    private initialize(): void {
        this.populateCommands();
        this.setupEventListeners();
        this.focusInput();
    }

    /**
     * コマンドセレクトボックスにオプションを追加
     */
    private populateCommands(): void {
        SLASH_COMMANDS.forEach((command: SlashCommand) => {
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

            const result: CommandResult = await ipcRenderer.invoke('execute-claude-command', command, input);

            if (result.success) {
                this.showStatus('success', 'コマンドが正常に実行されました。');
                // 少し待ってからウィンドウを閉じる
                setTimeout(() => {
                    this.closeWindow();
                }, 1500);
            } else {
                this.showStatus('error', `エラー: ${result.error ?? 'Unknown error'}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            this.showStatus('error', `実行エラー: ${errorMessage}`);
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
     * フォームをリセット
     */
    public resetForm(): void {
        this.commandSelect.value = '';
        this.inputText.value = '';
        this.status.style.display = 'none';
        this.updateExecuteButton();
        this.focusInput();
    }
}

// グローバルスコープに追加（フォーカス時のリセット処理用）
declare global {
    interface Window {
        claudePaletteRenderer?: ClaudePaletteRenderer;
    }
}

// DOM読み込み完了後にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    const renderer = new ClaudePaletteRenderer();
    window.claudePaletteRenderer = renderer;
});

// ウィンドウが表示された時にフォームをリセット
window.addEventListener('focus', () => {
    // 少し遅延してからリセット（ウィンドウのフォーカス処理を待つ）
    setTimeout(() => {
        if (window.claudePaletteRenderer) {
            window.claudePaletteRenderer.resetForm();
        }
    }, 100);
});