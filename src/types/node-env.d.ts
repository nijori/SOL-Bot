// Node.js環境変数の型定義
declare namespace NodeJS {
  interface ProcessEnv {
    // アプリケーション設定
    MODE?: string;
    LOG_LEVEL?: string;

    // 相場環境パラメータ
    SHORT_TERM_EMA?: string;
    LONG_TERM_EMA?: string;
    ATR_PERIOD?: string;
    ATR_PERCENTAGE_THRESHOLD?: string; // ATR%閾値（LOW_VOL判定用）

    // トレンド戦略パラメータ
    DONCHIAN_PERIOD?: string;
    ADX_PERIOD?: string;
    ADX_THRESHOLD?: string;

    // リスク管理パラメータ
    RISK_PER_TRADE?: string;
    MAX_DAILY_LOSS?: string;
  }
}
