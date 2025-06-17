declare module 'node-cron' {
  /**
   * node-cronモジュールの型定義
   */
  type Task = {
    start: () => void;
    stop: () => void;
  };

  type ScheduleOptions = {
    scheduled?: boolean;
    timezone?: string;
  };

  /**
   * cron形式の文字列でスケジュールを設定する関数
   * @param cronExpression cron形式の文字列（例: '* * * * *'）
   * @param task 実行するタスク関数
   * @param options スケジュールオプション
   * @returns タスクインスタンス
   */
  export function schedule(
    cronExpression: string,
    task: () => void,
    options?: ScheduleOptions
  ): Task;

  /**
   * cron式が正しいかどうかを検証する関数
   * @param cronExpression 検証するcron式
   * @returns 有効な場合はtrue、無効な場合はfalse
   */
  export function validate(cronExpression: string): boolean;
}
