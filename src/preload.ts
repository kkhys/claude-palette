/**
 * Claude Palette - Preloadスクリプト
 * 
 * @description メインプロセスとレンダラープロセス間の安全な通信を提供
 */

import { contextBridge, ipcRenderer } from 'electron';
import { CommandResult } from './types';

/**
 * レンダラープロセスに公開するAPI
 */
const electronAPI = {
  /**
   * Claude Codeコマンドを実行
   * 
   * @param command - 実行するslash command
   * @param input - 入力テキスト
   * @returns コマンド実行結果
   */
  executeClaudeCommand: async (command: string, input: string): Promise<CommandResult> => {
    return await ipcRenderer.invoke('execute-claude-command', command, input);
  },

  /**
   * ウィンドウを隠す
   */
  hideWindow: async (): Promise<void> => {
    await ipcRenderer.invoke('hide-window');
  }
};

// window.electronAPIとして公開
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript用の型定義を提供
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}