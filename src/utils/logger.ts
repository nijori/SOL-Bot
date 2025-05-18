/**
 * ロギングユーティリティ
 * INF-032: CommonJS形式への変換
 */

const winston = require('winston');
const moduleHelper = require('./moduleHelper');

// すでに作成済みのロガーがあれば再利用（循環参照対策）
if (moduleHelper.hasModule('logger')) {
  // モジュールがすでに存在する場合は、そのモジュールをエクスポートして
  // 以降のコードを実行しない
  module.exports = moduleHelper.getModule('logger');
  module.exports.default = moduleHelper.getModule('logger');
} else {
  // 環境変数からログレベルを取得するか、デフォルト値を使用
  const logLevel = process.env.LOG_LEVEL || 'info';

  // スモークテストモードを検出
  const isSmokeTest = process.argv.some((arg) => arg.includes('smoke-test'));

  /**
   * ロギング用のウィンストン・ロガーを設定
   */
  const logger = winston.createLogger({
    level: isSmokeTest ? 'warn' : logLevel, // スモークテスト中は警告以上のみ表示
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: 'sol-bot' },
    transports: [
      // コンソールへの出力
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            ({ 
              level, 
              message, 
              timestamp 
            }: { 
              level: string; 
              message: string; 
              timestamp: string 
            }) => `${timestamp} ${level}: ${message}`
          )
        )
      }),
      // ファイルへの出力
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error'
      }),
      new winston.transports.File({
        filename: 'logs/combined.log'
      })
    ]
  });

  // 開発環境での簡易ロギング設定
  if (process.env.NODE_ENV !== 'production') {
    logger.add(
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple())
      })
    );
  }

  // モジュールレジストリに登録
  moduleHelper.registerModule('logger', logger);

  // CommonJS形式でエクスポート
  module.exports = logger;
  // 後方互換性のために.defaultもサポート
  module.exports.default = logger;
}
