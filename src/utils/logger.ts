import * as winston from 'winston';
// 循環参照を避けるため、parametersからの直接インポートを削除
// import { MONITORING_PARAMETERS } from '../config/parameters';

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
          ({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`
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

export default logger;
