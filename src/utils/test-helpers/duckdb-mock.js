/**
 * DuckDBモック - テスト環境用
 * ネイティブスタックトレースエラーを回避するためのモック実装
 */

class MockConnection {
  exec(sql) {
    // SQLクエリを実行したふりをする
    return {
      all: () => [],
      run: () => {},
      prepare: () => ({
        run: () => {}
      })
    };
  }

  prepare(sql) {
    return {
      run: () => {}
    };
  }
}

class MockDatabase {
  constructor(path) {
    this.path = path;
  }

  connect() {
    return new MockConnection();
  }

  close() {
    // データベースを閉じたふりをする
  }
}

module.exports = {
  Database: MockDatabase
}; 