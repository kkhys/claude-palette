/**
 * Claude Palette - 型定義
 * 
 * @description アプリケーション全体で使用する型定義
 */

/**
 * Claude Code Slash Command の定義
 */
export interface SlashCommand {
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
export interface CommandResult {
  /** 実行成功フラグ */
  success: boolean;
  /** 成功時の出力 */
  output?: string;
  /** エラー時のメッセージ */
  error?: string;
}

/**
 * ウィンドウの座標とサイズ
 */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * トレイアイコンの座標とサイズ
 */
export interface TrayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * アプリケーション設定
 */
export interface AppSettings {
  /** ウィンドウサイズ */
  windowSize: {
    width: number;
    height: number;
  };
  /** 自動起動設定 */
  autoLaunch: boolean;
  /** テーマ設定 */
  theme: 'light' | 'dark' | 'system';
}

/**
 * IPCメッセージの種類
 */
export type IpcMessageType = 
  | 'execute-claude-command'
  | 'hide-window'
  | 'show-window'
  | 'get-settings'
  | 'save-settings';

/**
 * IPC通信のペイロード
 */
export interface IpcPayload {
  type: IpcMessageType;
  data?: any;
}

/**
 * レンダラープロセスからメインプロセスへのメッセージ
 */
export interface RendererToMainMessage {
  command?: string;
  input?: string;
  settings?: Partial<AppSettings>;
}

/**
 * メインプロセスからレンダラープロセスへのメッセージ
 */
export interface MainToRendererMessage {
  result?: CommandResult;
  settings?: AppSettings;
}