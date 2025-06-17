/**
 * 簡単なテストファイル - ビルドプロセス検証用
 */

export function helloWorld(): string {
  return 'Hello, World!';
}

export class SimpleTest {
  private message: string;

  constructor(message: string = 'Default Message') {
    this.message = message;
  }

  public getMessage(): string {
    return this.message;
  }

  public setMessage(newMessage: string): void {
    this.message = newMessage;
  }
}

// CommonJSとESM両方で動作する関数
export function isESMEnvironment(): boolean {
  try {
    // @ts-ignore - ランタイムチェックのためのコード
    return typeof globalThis.import !== 'undefined';
  } catch (e) {
    return false;
  }
}

// デフォルトエクスポート
export default {
  name: 'SimpleTestModule',
  version: '1.0.0',
  helloWorld,
  SimpleTest
}; 