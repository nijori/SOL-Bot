"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * DataRepository テスト用ワーカープロセス
 */
var path_1 = require("path");
var dataRepository_1 = require("../../data/dataRepository");
var types_1 = require("../../core/types");
// コマンドライン引数の取得
var workerId = parseInt(process.argv[2], 10);
var totalWorkers = parseInt(process.argv[3], 10);
var operationsPerWorker = parseInt(process.argv[4], 10);
var testSymbol = process.argv[5];
var testTimeframe = process.argv[6];
var testDataDir = process.argv[7];
// プロセス間の競合を作るために少しスリープする関数
function sleep(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
/**
 * テスト用のモックローソク足を作成
 */
function createMockCandles(count, startTimestamp) {
    if (startTimestamp === void 0) { startTimestamp = Date.now(); }
    var candles = [];
    for (var i = 0; i < count; i++) {
        var timestamp = startTimestamp + i * 60000; // 1分間隔
        var price = 1000 + Math.random() * 100; // 1000-1100のランダムな価格
        candles.push({
            timestamp: timestamp,
            open: price,
            high: price * 1.01,
            low: price * 0.99,
            close: price * (1 + (Math.random() * 0.02 - 0.01)), // ±1%変動
            volume: Math.random() * 100
        });
    }
    return candles;
}
/**
 * テスト用のモック注文を作成
 */
function createMockOrders(count) {
    var orders = [];
    for (var i = 0; i < count; i++) {
        var timestamp = Date.now() + i * 1000; // 1秒間隔
        var price = 1000 + Math.random() * 100;
        orders.push({
            id: "order-".concat(workerId, "-").concat(i, "-").concat(Date.now()),
            symbol: testSymbol,
            type: types_1.OrderType.LIMIT,
            side: Math.random() > 0.5 ? types_1.OrderSide.BUY : types_1.OrderSide.SELL,
            price: price,
            amount: Math.random() * 1,
            timestamp: timestamp,
            status: types_1.OrderStatus.OPEN
        });
    }
    return orders;
}
/**
 * テスト用のモックパフォーマンスメトリクスを作成
 */
function createMockPerformanceMetrics() {
    return {
        totalTrades: Math.floor(Math.random() * 100),
        winningTrades: Math.floor(Math.random() * 50),
        losingTrades: Math.floor(Math.random() * 30),
        totalReturn: Math.random() * 1000 - 500,
        maxDrawdown: Math.random() * 100,
        sharpeRatio: Math.random() * 3 - 1,
        startTimestamp: Date.now() - 86400000, // 1日前
        endTimestamp: Date.now(),
        runDuration: 86400000,
        symbol: testSymbol,
        initialBalance: 10000,
        finalBalance: 10000 + (Math.random() * 2000 - 1000),
        winRate: Math.random() * 0.6 + 0.3, // 30%〜90%
        averageWin: Math.random() * 100 + 50,
        averageLoss: Math.random() * 50 + 20,
        profitFactor: Math.random() * 2 + 0.5,
        annualizedReturn: Math.random() * 50,
        workerId: workerId // 検証用に書き込み元ワーカーIDを含める
    };
}
// テスト用のDataRepositoryインスタンスを作成
var TestDataRepository = /** @class */ (function (_super) {
    __extends(TestDataRepository, _super);
    function TestDataRepository() {
        return _super.call(this) || this;
    }
    // テスト用データディレクトリを使用するようオーバーライド
    TestDataRepository.prototype.getDataDirectories = function () {
        return {
            dataDir: testDataDir,
            candlesDir: path_1.default.join(testDataDir, 'candles'),
            ordersDir: path_1.default.join(testDataDir, 'orders'),
            metricsDir: path_1.default.join(testDataDir, 'metrics')
        };
    };
    return TestDataRepository;
}(dataRepository_1.DataRepository));
// メインの実行関数
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var repository, i, operationType, candles, orders, date, metrics, date, error_1, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 14, , 15]);
                    console.log("\u30EF\u30FC\u30AB\u30FC ".concat(workerId, " \u304C\u8D77\u52D5\u3057\u307E\u3057\u305F - \u64CD\u4F5C\u6570: ").concat(operationsPerWorker));
                    repository = new TestDataRepository();
                    // ランダムな待機時間で並列実行を再現
                    return [4 /*yield*/, sleep(Math.random() * 100)];
                case 1:
                    // ランダムな待機時間で並列実行を再現
                    _a.sent();
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < operationsPerWorker)) return [3 /*break*/, 13];
                    operationType = Math.floor(Math.random() * 3);
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 11, , 12]);
                    if (!(operationType === 0)) return [3 /*break*/, 5];
                    candles = createMockCandles(5);
                    return [4 /*yield*/, repository.saveCandles(testSymbol, testTimeframe, candles)];
                case 4:
                    _a.sent();
                    console.log("\u30EF\u30FC\u30AB\u30FC ".concat(workerId, " - \u64CD\u4F5C ").concat(i + 1, "\uFF1A\u30ED\u30FC\u30BD\u30AF\u8DB3\u30C7\u30FC\u30BF\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F"));
                    return [3 /*break*/, 9];
                case 5:
                    if (!(operationType === 1)) return [3 /*break*/, 7];
                    orders = createMockOrders(3);
                    date = new Date().toISOString().split('T')[0].replace(/-/g, '');
                    return [4 /*yield*/, repository.saveOrders(orders, date, testSymbol)];
                case 6:
                    _a.sent();
                    console.log("\u30EF\u30FC\u30AB\u30FC ".concat(workerId, " - \u64CD\u4F5C ").concat(i + 1, "\uFF1A\u6CE8\u6587\u30C7\u30FC\u30BF\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F"));
                    return [3 /*break*/, 9];
                case 7:
                    metrics = createMockPerformanceMetrics();
                    date = new Date().toISOString().split('T')[0].replace(/-/g, '');
                    return [4 /*yield*/, repository.savePerformanceMetrics(metrics, date, testSymbol)];
                case 8:
                    _a.sent();
                    console.log("\u30EF\u30FC\u30AB\u30FC ".concat(workerId, " - \u64CD\u4F5C ").concat(i + 1, "\uFF1A\u30E1\u30C8\u30EA\u30AF\u30B9\u30C7\u30FC\u30BF\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F"));
                    _a.label = 9;
                case 9: 
                // スレッド競合を発生させるために少し待機
                return [4 /*yield*/, sleep(Math.random() * 50)];
                case 10:
                    // スレッド競合を発生させるために少し待機
                    _a.sent();
                    return [3 /*break*/, 12];
                case 11:
                    error_1 = _a.sent();
                    console.error("\u30EF\u30FC\u30AB\u30FC ".concat(workerId, " - \u64CD\u4F5C ").concat(i + 1, " \u30A8\u30E9\u30FC: ").concat(error_1.message));
                    return [3 /*break*/, 12];
                case 12:
                    i++;
                    return [3 /*break*/, 2];
                case 13:
                    console.log("\u30EF\u30FC\u30AB\u30FC ".concat(workerId, " \u304C\u5168\u3066\u306E\u64CD\u4F5C\u3092\u5B8C\u4E86\u3057\u307E\u3057\u305F"));
                    return [3 /*break*/, 15];
                case 14:
                    error_2 = _a.sent();
                    console.error("\u30EF\u30FC\u30AB\u30FC ".concat(workerId, " \u306E\u5B9F\u884C\u4E2D\u306B\u30A8\u30E9\u30FC\u304C\u767A\u751F\u3057\u307E\u3057\u305F: ").concat(error_2.message));
                    process.exit(1);
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/];
            }
        });
    });
}
// 実行
run().then(function () { return process.exit(0); }).catch(function (err) {
    console.error("\u30EF\u30FC\u30AB\u30FC\u30D7\u30ED\u30BB\u30B9\u3067\u306E\u30A8\u30E9\u30FC: ".concat(err.message));
    process.exit(1);
});
