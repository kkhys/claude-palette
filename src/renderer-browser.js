/**
 * Claude Palette - レンダラープロセス（ブラウザ互換版）
 * 
 * @description UIの動作とメインプロセスとの通信を管理
 */

// Electronのレンダラープロセスでrequireを使用
const { ipcRenderer } = require('electron');

/**
 * Claude Code Slash Commands（動的に取得される）
 */
let SLASH_COMMANDS = [];

/**
 * Claude Paletteレンダラークラス
 */
class ClaudePaletteRenderer {
    constructor() {
        // DOM要素を取得（型チェック付き）
        this.commandSelect = this.getElementByIdStrict('command-select');
        this.inputText = this.getElementByIdStrict('input-text');
        this.executeBtn = this.getElementByIdStrict('execute-btn');
        this.closeBtn = this.getElementByIdStrict('close-btn');
        this.status = this.getElementByIdStrict('status');
    }

    /**
     * 型安全なgetElementById
     */
    getElementByIdStrict(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Element with id '${id}' not found`);
        }
        return element;
    }

    /**
     * レンダラープロセスを初期化
     */
    async initialize() {
        console.log('Initializing Claude Palette Renderer...');
        await this.loadClaudeCommands();
        this.populateCommands();
        this.setupEventListeners();
        this.focusInput();
        console.log('Claude Palette Renderer initialized successfully');
    }

    /**
     * Claude Codeからslash commandを動的に取得
     */
    async loadClaudeCommands() {
        try {
            console.log('Loading Claude commands...');
            SLASH_COMMANDS = await ipcRenderer.invoke('get-claude-commands');
            console.log(`Loaded ${SLASH_COMMANDS.length} Claude commands:`, SLASH_COMMANDS);
        } catch (error) {
            console.error('Failed to load Claude commands:', error);
            // フォールバック用のデフォルトcommand
            SLASH_COMMANDS = [
                { value: '/ask', label: '/ask - Claude に質問する', description: 'Claude AI に質問を送信' },
                { value: '/chat', label: '/chat - チャットを開始', description: 'インタラクティブなチャットセッションを開始' }
            ];
        }
    }

    /**
     * コマンドセレクトボックスにオプションを追加
     */
    populateCommands() {
        console.log('Populating commands...');
        SLASH_COMMANDS.forEach((command) => {
            const option = document.createElement('option');
            option.value = command.value;
            option.textContent = command.label;
            option.title = command.description;
            this.commandSelect.appendChild(option);
        });
        console.log(`Added ${SLASH_COMMANDS.length} commands to select box`);
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // コマンド選択時
        this.commandSelect.addEventListener('change', () => {
            console.log('Command selected:', this.commandSelect.value);
            this.updateExecuteButton();
        });

        // テキスト入力時
        this.inputText.addEventListener('input', () => {
            this.updateExecuteButton();
        });

        // Enterキー（Cmd+Enter）で実行
        this.inputText.addEventListener('keydown', (e) => {
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
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeWindow();
            }
        });
        
        console.log('Event listeners set up successfully');
    }

    /**
     * 実行ボタンの有効/無効を更新
     */
    updateExecuteButton() {
        const hasCommand = this.commandSelect.value.trim() !== '';
        const hasInput = this.inputText.value.trim() !== '';
        
        this.executeBtn.disabled = !hasCommand || !hasInput;
        console.log('Execute button state:', {
            hasCommand,
            hasInput,
            disabled: this.executeBtn.disabled
        });
    }

    /**
     * 入力フィールドにフォーカス
     */
    focusInput() {
        setTimeout(() => {
            this.inputText.focus();
        }, 100);
    }

    /**
     * コマンドを実行
     */
    async executeCommand() {
        const command = this.commandSelect.value;
        const input = this.inputText.value.trim();

        if (!command || !input) {
            this.showStatus('error', 'コマンドと入力テキストを選択してください。');
            return;
        }

        try {
            this.executeBtn.disabled = true;
            this.showStatus('loading', 'コマンドを実行中...');

            console.log('Executing command:', { command, input });
            const result = await ipcRenderer.invoke('execute-claude-command', command, input);
            console.log('Command result:', result);

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
            console.error('Execute command error:', error);
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
    showStatus(type, message) {
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
    async closeWindow() {
        try {
            await ipcRenderer.invoke('hide-window');
        } catch (error) {
            console.error('Close window error:', error);
        }
    }

    /**
     * フォームをリセット
     */
    resetForm() {
        this.commandSelect.value = '';
        this.inputText.value = '';
        this.status.style.display = 'none';
        this.updateExecuteButton();
        this.focusInput();
    }

    /**
     * Claude commandsを再読み込み（オプション機能）
     */
    async reloadCommands() {
        try {
            console.log('Reloading Claude commands...');
            await this.loadClaudeCommands();
            
            // selectボックスをクリア
            this.commandSelect.innerHTML = '<option value="">コマンドを選択...</option>';
            
            // 新しいコマンドを追加
            this.populateCommands();
            
            console.log('Commands reloaded successfully');
        } catch (error) {
            console.error('Failed to reload commands:', error);
        }
    }
}

// グローバルスコープに追加（フォーカス時のリセット処理用）
window.claudePaletteRenderer = null;

// DOM読み込み完了後にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing renderer...');
    
    // DOM要素の存在確認
    const commandSelect = document.getElementById('command-select');
    const executeBtn = document.getElementById('execute-btn');
    const closeBtn = document.getElementById('close-btn');
    const inputText = document.getElementById('input-text');
    
    console.log('DOM elements found:', {
        commandSelect: !!commandSelect,
        executeBtn: !!executeBtn,
        closeBtn: !!closeBtn,
        inputText: !!inputText
    });
    
    if (!commandSelect || !executeBtn || !closeBtn || !inputText) {
        console.error('Missing required DOM elements!');
        return;
    }
    
    try {
        const renderer = new ClaudePaletteRenderer();
        await renderer.initialize();
        window.claudePaletteRenderer = renderer;
        console.log('Renderer initialized and attached to window');
    } catch (error) {
        console.error('Failed to initialize renderer:', error);
    }
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