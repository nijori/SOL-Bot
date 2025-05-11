"use strict";
/**
 * データの永続化と取得を管理するリポジトリ
 *
 * このファイルはローソク足データや取引履歴などの情報を保存・取得するための
 * インターフェースを提供します。実際のストレージはファイルベースまたはデータベースベースで実装できます。
 *
 * DAT-014: データストアマルチシンボル拡張
 * TST-013: DataRepository並列E2Eテスト対応
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataRepository = exports.DataRepository = void 0;
var fs_1 = require("fs");
var path_1 = require("path");
var logger_js_1 = require("../utils/logger.js");
var async_mutex_1 = require("async-mutex");
// データフォルダのパス設定
var DATA_DIR = path_1.default.join(process.cwd(), 'data');
var CANDLES_DIR = path_1.default.join(DATA_DIR, 'candles');
var ORDERS_DIR = path_1.default.join(DATA_DIR, 'orders');
var METRICS_DIR = path_1.default.join(DATA_DIR, 'metrics');
/**
 * マルチシンボル対応のデータリポジトリ
 */
var DataRepository = /** @class */ (function () {
    function DataRepository() {
        this.fileLocks = new Map(); // ファイルごとのロック
        this.ensureDirectoriesExist();
    }
    /**
     * シングルトンインスタンスを取得
     */
    DataRepository.getInstance = function () {
        if (!DataRepository.instance) {
            DataRepository.instance = new DataRepository();
        }
        return DataRepository.instance;
    };
    /**
     * 必要なディレクトリが存在することを確認する
     */
    DataRepository.prototype.ensureDirectoriesExist = function () {
        [DATA_DIR, CANDLES_DIR, ORDERS_DIR, METRICS_DIR].forEach(function (dir) {
            if (!fs_1.default.existsSync(dir)) {
                try {
                    fs_1.default.mkdirSync(dir, { recursive: true });
                }
                catch (error) {
                    logger_js_1.default.error("\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u4F5C\u6210\u30A8\u30E9\u30FC: ".concat(error instanceof Error ? error.message : String(error)));
                }
            }
        });
    };
    /**
     * シンボルに対応するディレクトリを確保する
     * @param symbol 銘柄（例: 'SOL/USDT'）
     * @param baseDir ベースディレクトリ
     * @returns シンボル固有のディレクトリパス
     */
    DataRepository.prototype.ensureSymbolDirectory = function (symbol, baseDir) {
        var normalizedSymbol = symbol.replace('/', '_');
        var symbolDir = path_1.default.join(baseDir, normalizedSymbol);
        if (!fs_1.default.existsSync(symbolDir)) {
            try {
                fs_1.default.mkdirSync(symbolDir, { recursive: true });
                logger_js_1.default.debug("\u30B7\u30F3\u30DC\u30EB\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u3092\u4F5C\u6210\u3057\u307E\u3057\u305F: ".concat(symbolDir));
            }
            catch (error) {
                logger_js_1.default.error("\u30B7\u30F3\u30DC\u30EB\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u4F5C\u6210\u30A8\u30E9\u30FC: ".concat(error instanceof Error ? error.message : String(error)));
            }
        }
        return symbolDir;
    };
    /**
     * ファイルパスに対するミューテックスを取得する（ない場合は作成）
     * @param filePath ファイルパス
     * @returns そのファイルに対するミューテックス
     */
    DataRepository.prototype.getFileLock = function (filePath) {
        if (!this.fileLocks.has(filePath)) {
            this.fileLocks.set(filePath, new async_mutex_1.Mutex());
        }
        return this.fileLocks.get(filePath);
    };
    /**
     * データディレクトリ情報を取得する
     * テスト用にオーバーライド可能
     * @returns データディレクトリのパス情報
     */
    DataRepository.prototype.getDataDirectories = function () {
        return {
            dataDir: DATA_DIR,
            candlesDir: CANDLES_DIR,
            ordersDir: ORDERS_DIR,
            metricsDir: METRICS_DIR
        };
    };
    /**
     * ローソク足データを保存する
     * @param symbol 銘柄（例: 'SOL/USDT'）
     * @param timeframe 時間枠（例: '1h'）
     * @param candles ローソク足データの配列
     * @returns 成功したかどうか
     */
    DataRepository.prototype.saveCandles = function (symbol, timeframe, candles) {
        return __awaiter(this, void 0, void 0, function () {
            var dirs, symbolDir, date, filename, filePath, fileLock;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dirs = this.getDataDirectories();
                        symbolDir = this.ensureSymbolDirectory(symbol, dirs.candlesDir);
                        date = new Date().toISOString().split('T')[0].replace(/-/g, '');
                        filename = "".concat(timeframe, "_").concat(date, ".json");
                        filePath = path_1.default.join(symbolDir, filename);
                        fileLock = this.getFileLock(filePath);
                        return [4 /*yield*/, fileLock.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var allCandles, existingData, existingCandles, uniqueCandles_1, timestampSet_1, error_1, error_2;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 6, , 7]);
                                            allCandles = __spreadArray([], candles, true);
                                            if (!fs_1.default.existsSync(filePath)) return [3 /*break*/, 4];
                                            _a.label = 1;
                                        case 1:
                                            _a.trys.push([1, 3, , 4]);
                                            return [4 /*yield*/, fs_1.default.promises.readFile(filePath, 'utf8')];
                                        case 2:
                                            existingData = _a.sent();
                                            existingCandles = JSON.parse(existingData);
                                            // 既存のデータとマージ (タイムスタンプでソート)
                                            allCandles = __spreadArray(__spreadArray([], existingCandles, true), candles, true).sort(function (a, b) {
                                                return a.timestamp - b.timestamp;
                                            });
                                            uniqueCandles_1 = [];
                                            timestampSet_1 = new Set();
                                            // 重複を取り除く
                                            allCandles.forEach(function (candle) {
                                                if (!timestampSet_1.has(candle.timestamp)) {
                                                    timestampSet_1.add(candle.timestamp);
                                                    uniqueCandles_1.push(candle);
                                                }
                                            });
                                            allCandles = uniqueCandles_1;
                                            return [3 /*break*/, 4];
                                        case 3:
                                            error_1 = _a.sent();
                                            // 既存ファイルが無効な場合は新しいデータだけを使用
                                            logger_js_1.default.warn("\u65E2\u5B58\u306E\u30ED\u30FC\u30BD\u30AF\u8DB3\u30C7\u30FC\u30BF\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ".concat(filePath, ". \u65B0\u3057\u3044\u30C7\u30FC\u30BF\u306E\u307F\u3092\u4F7F\u7528\u3057\u307E\u3059\u3002"));
                                            return [3 /*break*/, 4];
                                        case 4: 
                                        // JSONとして保存
                                        return [4 /*yield*/, fs_1.default.promises.writeFile(filePath, JSON.stringify(allCandles, null, 2))];
                                        case 5:
                                            // JSONとして保存
                                            _a.sent();
                                            logger_js_1.default.debug("\u30ED\u30FC\u30BD\u30AF\u8DB3\u30C7\u30FC\u30BF\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F: ".concat(filePath));
                                            return [2 /*return*/, true];
                                        case 6:
                                            error_2 = _a.sent();
                                            logger_js_1.default.error("\u30ED\u30FC\u30BD\u30AF\u8DB3\u30C7\u30FC\u30BF\u4FDD\u5B58\u30A8\u30E9\u30FC: ".concat(error_2 instanceof Error ? error_2.message : String(error_2)));
                                            return [2 /*return*/, false];
                                        case 7: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1: 
                    // ロックを取得してファイル操作を行う
                    return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * ローソク足データを読み込む
     * @param symbol 銘柄（例: 'SOL/USDT'）
     * @param timeframe 時間枠（例: '1h'）
     * @param date 読み込む日付（形式: 'YYYYMMDD'）
     * @returns ローソク足データの配列
     */
    DataRepository.prototype.loadCandles = function (symbol, timeframe, date) {
        return __awaiter(this, void 0, void 0, function () {
            var dirs, normalizedSymbol, symbolDir, filename, filePath, data, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        dirs = this.getDataDirectories();
                        normalizedSymbol = symbol.replace('/', '_');
                        symbolDir = path_1.default.join(dirs.candlesDir, normalizedSymbol);
                        if (!fs_1.default.existsSync(symbolDir)) {
                            logger_js_1.default.warn("\u30B7\u30F3\u30DC\u30EB\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(symbolDir));
                            return [2 /*return*/, []];
                        }
                        filename = "".concat(timeframe, "_").concat(date, ".json");
                        filePath = path_1.default.join(symbolDir, filename);
                        if (!fs_1.default.existsSync(filePath)) {
                            logger_js_1.default.warn("\u30ED\u30FC\u30BD\u30AF\u8DB3\u30C7\u30FC\u30BF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(filePath));
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, fs_1.default.promises.readFile(filePath, 'utf8')];
                    case 1:
                        data = _a.sent();
                        return [2 /*return*/, JSON.parse(data)];
                    case 2:
                        error_3 = _a.sent();
                        logger_js_1.default.error("\u30ED\u30FC\u30BD\u30AF\u8DB3\u30C7\u30FC\u30BF\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ".concat(error_3 instanceof Error ? error_3.message : String(error_3)));
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 複数シンボルのローソク足データを一括で読み込む
     * @param symbols 銘柄の配列（例: ['SOL/USDT', 'BTC/USDT']）
     * @param timeframe 時間枠（例: '1h'）
     * @param date 読み込む日付（形式: 'YYYYMMDD'）
     * @returns シンボルごとのローソク足データのマップ
     */
    DataRepository.prototype.loadMultipleSymbolCandles = function (symbols, timeframe, date) {
        return __awaiter(this, void 0, void 0, function () {
            var result, _i, symbols_1, symbol, candles, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = new Map();
                        _i = 0, symbols_1 = symbols;
                        _a.label = 1;
                    case 1:
                        if (!(_i < symbols_1.length)) return [3 /*break*/, 6];
                        symbol = symbols_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, this.loadCandles(symbol, timeframe, date)];
                    case 3:
                        candles = _a.sent();
                        if (candles.length > 0) {
                            result.set(symbol, candles);
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_4 = _a.sent();
                        logger_js_1.default.error("\u30B7\u30F3\u30DC\u30EB ".concat(symbol, " \u306E\u30ED\u30FC\u30BD\u30AF\u8DB3\u30C7\u30FC\u30BF\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ").concat(error_4 instanceof Error ? error_4.message : String(error_4)));
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * 利用可能なシンボルの一覧を取得する
     * @returns 利用可能なシンボルの配列
     */
    DataRepository.prototype.getAvailableSymbols = function () {
        try {
            var dirs_1 = this.getDataDirectories();
            if (!fs_1.default.existsSync(dirs_1.candlesDir)) {
                return [];
            }
            // ディレクトリ名からシンボルを抽出
            return fs_1.default
                .readdirSync(dirs_1.candlesDir)
                .filter(function (name) { return fs_1.default.statSync(path_1.default.join(dirs_1.candlesDir, name)).isDirectory(); })
                .map(function (dir) { return dir.replace('_', '/'); });
        }
        catch (error) {
            logger_js_1.default.error("\u30B7\u30F3\u30DC\u30EB\u4E00\u89A7\u53D6\u5F97\u30A8\u30E9\u30FC: ".concat(error instanceof Error ? error.message : String(error)));
            return [];
        }
    };
    /**
     * 特定のシンボルで利用可能なタイムフレームの一覧を取得する
     * @param symbol 銘柄（例: 'SOL/USDT'）
     * @returns 利用可能なタイムフレームの配列
     */
    DataRepository.prototype.getAvailableTimeframes = function (symbol) {
        try {
            var dirs = this.getDataDirectories();
            var normalizedSymbol = symbol.replace('/', '_');
            var symbolDir = path_1.default.join(dirs.candlesDir, normalizedSymbol);
            if (!fs_1.default.existsSync(symbolDir)) {
                logger_js_1.default.warn("\u30B7\u30F3\u30DC\u30EB\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(symbolDir));
                return [];
            }
            // ファイル名からタイムフレームを抽出
            var uniqueTimeframes_1 = new Set();
            fs_1.default.readdirSync(symbolDir)
                .filter(function (file) { return file.endsWith('.json'); })
                .forEach(function (file) {
                var matches = file.match(/^([^_]+)_/);
                if (matches && matches[1]) {
                    uniqueTimeframes_1.add(matches[1]);
                }
            });
            return Array.from(uniqueTimeframes_1);
        }
        catch (error) {
            logger_js_1.default.error("\u30BF\u30A4\u30E0\u30D5\u30EC\u30FC\u30E0\u4E00\u89A7\u53D6\u5F97\u30A8\u30E9\u30FC: ".concat(error instanceof Error ? error.message : String(error)));
            return [];
        }
    };
    /**
     * 注文履歴を保存する
     * @param orders 注文の配列
     * @param date 保存する日付（形式: 'YYYYMMDD'）
     * @param symbol シンボル名（省略可。省略時は全シンボル共通の履歴として保存）
     * @returns 成功したかどうか
     */
    DataRepository.prototype.saveOrders = function (orders, date, symbol) {
        return __awaiter(this, void 0, void 0, function () {
            var dirs, targetDir, dateStr, filename, filePath, fileLock;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dirs = this.getDataDirectories();
                        targetDir = dirs.ordersDir;
                        // シンボルが指定されている場合はシンボル固有のディレクトリを使用
                        if (symbol) {
                            targetDir = this.ensureSymbolDirectory(symbol, dirs.ordersDir);
                        }
                        dateStr = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
                        filename = "orders_".concat(dateStr, ".json");
                        filePath = path_1.default.join(targetDir, filename);
                        fileLock = this.getFileLock(filePath);
                        return [4 /*yield*/, fileLock.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var existingOrders, data, allOrders, error_5;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 4, , 5]);
                                            existingOrders = [];
                                            if (!fs_1.default.existsSync(filePath)) return [3 /*break*/, 2];
                                            return [4 /*yield*/, fs_1.default.promises.readFile(filePath, 'utf8')];
                                        case 1:
                                            data = _a.sent();
                                            existingOrders = JSON.parse(data);
                                            _a.label = 2;
                                        case 2:
                                            allOrders = __spreadArray(__spreadArray([], existingOrders, true), orders, true);
                                            return [4 /*yield*/, fs_1.default.promises.writeFile(filePath, JSON.stringify(allOrders, null, 2))];
                                        case 3:
                                            _a.sent();
                                            logger_js_1.default.debug("\u6CE8\u6587\u5C65\u6B74\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F: ".concat(filePath));
                                            return [2 /*return*/, true];
                                        case 4:
                                            error_5 = _a.sent();
                                            logger_js_1.default.error("\u6CE8\u6587\u5C65\u6B74\u4FDD\u5B58\u30A8\u30E9\u30FC: ".concat(error_5 instanceof Error ? error_5.message : String(error_5)));
                                            return [2 /*return*/, false];
                                        case 5: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1: 
                    // ロックを取得してファイル操作を行う
                    return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * 注文履歴を読み込む
     * @param date 日付（形式: 'YYYYMMDD'）
     * @param symbol シンボル名（省略可。省略時は全シンボル共通の履歴を読み込み）
     * @returns 注文の配列
     */
    DataRepository.prototype.loadOrders = function (date, symbol) {
        return __awaiter(this, void 0, void 0, function () {
            var dirs, targetDir, normalizedSymbol, filename, filePath, data, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        dirs = this.getDataDirectories();
                        targetDir = dirs.ordersDir;
                        // シンボルが指定されている場合はシンボル固有のディレクトリを使用
                        if (symbol) {
                            normalizedSymbol = symbol.replace('/', '_');
                            targetDir = path_1.default.join(dirs.ordersDir, normalizedSymbol);
                            if (!fs_1.default.existsSync(targetDir)) {
                                logger_js_1.default.warn("\u30B7\u30F3\u30DC\u30EB\u6CE8\u6587\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(targetDir));
                                return [2 /*return*/, []];
                            }
                        }
                        filename = "orders_".concat(date, ".json");
                        filePath = path_1.default.join(targetDir, filename);
                        if (!fs_1.default.existsSync(filePath)) {
                            logger_js_1.default.warn("\u6CE8\u6587\u5C65\u6B74\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(filePath));
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, fs_1.default.promises.readFile(filePath, 'utf8')];
                    case 1:
                        data = _a.sent();
                        return [2 /*return*/, JSON.parse(data)];
                    case 2:
                        error_6 = _a.sent();
                        logger_js_1.default.error("\u6CE8\u6587\u5C65\u6B74\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ".concat(error_6 instanceof Error ? error_6.message : String(error_6)));
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 複数シンボルの注文履歴を一括で読み込む
     * @param date 日付（形式: 'YYYYMMDD'）
     * @param symbols 銘柄の配列（例: ['SOL/USDT', 'BTC/USDT']）
     * @returns シンボルごとの注文履歴のマップ
     */
    DataRepository.prototype.loadMultipleSymbolOrders = function (date, symbols) {
        return __awaiter(this, void 0, void 0, function () {
            var result, commonOrders, error_7, _i, symbols_2, symbol, orders, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = new Map();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.loadOrders(date)];
                    case 2:
                        commonOrders = _a.sent();
                        if (commonOrders.length > 0) {
                            result.set('common', commonOrders);
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_7 = _a.sent();
                        logger_js_1.default.error("\u5171\u901A\u6CE8\u6587\u5C65\u6B74\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ".concat(error_7 instanceof Error ? error_7.message : String(error_7)));
                        return [3 /*break*/, 4];
                    case 4:
                        _i = 0, symbols_2 = symbols;
                        _a.label = 5;
                    case 5:
                        if (!(_i < symbols_2.length)) return [3 /*break*/, 10];
                        symbol = symbols_2[_i];
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, this.loadOrders(date, symbol)];
                    case 7:
                        orders = _a.sent();
                        if (orders.length > 0) {
                            result.set(symbol, orders);
                        }
                        return [3 /*break*/, 9];
                    case 8:
                        error_8 = _a.sent();
                        logger_js_1.default.error("\u30B7\u30F3\u30DC\u30EB ".concat(symbol, " \u306E\u6CE8\u6587\u5C65\u6B74\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ").concat(error_8 instanceof Error ? error_8.message : String(error_8)));
                        return [3 /*break*/, 9];
                    case 9:
                        _i++;
                        return [3 /*break*/, 5];
                    case 10: return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * パフォーマンスメトリクスを保存する
     * @param metrics パフォーマンスメトリクス
     * @param date 保存する日付（形式: 'YYYYMMDD'）
     * @param symbol シンボル名（省略可。省略時は全シンボル共通のメトリクスとして保存）
     * @returns 成功したかどうか
     */
    DataRepository.prototype.savePerformanceMetrics = function (metrics, date, symbol) {
        return __awaiter(this, void 0, void 0, function () {
            var dirs, targetDir, dateStr, filename, filePath, fileLock;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        dirs = this.getDataDirectories();
                        targetDir = dirs.metricsDir;
                        // シンボルが指定されている場合はシンボル固有のディレクトリを使用
                        if (symbol) {
                            targetDir = this.ensureSymbolDirectory(symbol, dirs.metricsDir);
                        }
                        dateStr = date || new Date().toISOString().split('T')[0].replace(/-/g, '');
                        filename = "metrics_".concat(dateStr, ".json");
                        filePath = path_1.default.join(targetDir, filename);
                        fileLock = this.getFileLock(filePath);
                        return [4 /*yield*/, fileLock.runExclusive(function () { return __awaiter(_this, void 0, void 0, function () {
                                var existingData, existingMetrics, mergedMetrics, error_9, error_10;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, 7, , 8]);
                                            if (!fs_1.default.existsSync(filePath)) return [3 /*break*/, 5];
                                            _a.label = 1;
                                        case 1:
                                            _a.trys.push([1, 4, , 5]);
                                            return [4 /*yield*/, fs_1.default.promises.readFile(filePath, 'utf8')];
                                        case 2:
                                            existingData = _a.sent();
                                            existingMetrics = JSON.parse(existingData);
                                            mergedMetrics = __assign(__assign({}, existingMetrics), metrics);
                                            return [4 /*yield*/, fs_1.default.promises.writeFile(filePath, JSON.stringify(mergedMetrics, null, 2))];
                                        case 3:
                                            _a.sent();
                                            logger_js_1.default.debug("\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9\u30E1\u30C8\u30EA\u30AF\u30B9\u3092\u66F4\u65B0\u3057\u307E\u3057\u305F: ".concat(filePath));
                                            return [2 /*return*/, true];
                                        case 4:
                                            error_9 = _a.sent();
                                            logger_js_1.default.warn("\u65E2\u5B58\u306E\u30E1\u30C8\u30EA\u30AF\u30B9\u30C7\u30FC\u30BF\u306E\u8AAD\u307F\u8FBC\u307F\u306B\u5931\u6557\u3057\u307E\u3057\u305F: ".concat(filePath, ". \u65B0\u3057\u3044\u30C7\u30FC\u30BF\u3067\u4E0A\u66F8\u304D\u3057\u307E\u3059\u3002"));
                                            return [3 /*break*/, 5];
                                        case 5: return [4 /*yield*/, fs_1.default.promises.writeFile(filePath, JSON.stringify(metrics, null, 2))];
                                        case 6:
                                            _a.sent();
                                            logger_js_1.default.debug("\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9\u30E1\u30C8\u30EA\u30AF\u30B9\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F: ".concat(filePath));
                                            return [2 /*return*/, true];
                                        case 7:
                                            error_10 = _a.sent();
                                            logger_js_1.default.error("\u30E1\u30C8\u30EA\u30AF\u30B9\u4FDD\u5B58\u30A8\u30E9\u30FC: ".concat(error_10 instanceof Error ? error_10.message : String(error_10)));
                                            return [2 /*return*/, false];
                                        case 8: return [2 /*return*/];
                                    }
                                });
                            }); })];
                    case 1: 
                    // ロックを取得してファイル操作を行う
                    return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * パフォーマンスメトリクスを読み込む
     * @param date 日付（形式: 'YYYYMMDD'）
     * @param symbol シンボル名（省略可。省略時は全シンボル共通のメトリクスを読み込み）
     * @returns パフォーマンスメトリクス
     */
    DataRepository.prototype.loadPerformanceMetrics = function (date, symbol) {
        return __awaiter(this, void 0, void 0, function () {
            var dirs, targetDir, normalizedSymbol, filename, filePath, data, error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        dirs = this.getDataDirectories();
                        targetDir = dirs.metricsDir;
                        // シンボルが指定されている場合はシンボル固有のディレクトリを使用
                        if (symbol) {
                            normalizedSymbol = symbol.replace('/', '_');
                            targetDir = path_1.default.join(dirs.metricsDir, normalizedSymbol);
                            if (!fs_1.default.existsSync(targetDir)) {
                                logger_js_1.default.warn("\u30B7\u30F3\u30DC\u30EB\u30E1\u30C8\u30EA\u30AF\u30B9\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(targetDir));
                                return [2 /*return*/, null];
                            }
                        }
                        filename = "metrics_".concat(date, ".json");
                        filePath = path_1.default.join(targetDir, filename);
                        if (!fs_1.default.existsSync(filePath)) {
                            logger_js_1.default.warn("\u30E1\u30C8\u30EA\u30AF\u30B9\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(filePath));
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, fs_1.default.promises.readFile(filePath, 'utf8')];
                    case 1:
                        data = _a.sent();
                        return [2 /*return*/, JSON.parse(data)];
                    case 2:
                        error_11 = _a.sent();
                        logger_js_1.default.error("\u30E1\u30C8\u30EA\u30AF\u30B9\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ".concat(error_11 instanceof Error ? error_11.message : String(error_11)));
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 複数シンボルのパフォーマンスメトリクスを一括で読み込む
     * @param date 日付（形式: 'YYYYMMDD'）
     * @param symbols 銘柄の配列（例: ['SOL/USDT', 'BTC/USDT']）
     * @returns シンボルごとのパフォーマンスメトリクスのマップ
     */
    DataRepository.prototype.loadMultipleSymbolMetrics = function (date, symbols) {
        return __awaiter(this, void 0, void 0, function () {
            var result, commonMetrics, error_12, _i, symbols_3, symbol, metrics, error_13;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        result = new Map();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.loadPerformanceMetrics(date)];
                    case 2:
                        commonMetrics = _a.sent();
                        if (commonMetrics) {
                            result.set('common', commonMetrics);
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        error_12 = _a.sent();
                        logger_js_1.default.error("\u5171\u901A\u30E1\u30C8\u30EA\u30AF\u30B9\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ".concat(error_12 instanceof Error ? error_12.message : String(error_12)));
                        return [3 /*break*/, 4];
                    case 4:
                        _i = 0, symbols_3 = symbols;
                        _a.label = 5;
                    case 5:
                        if (!(_i < symbols_3.length)) return [3 /*break*/, 10];
                        symbol = symbols_3[_i];
                        _a.label = 6;
                    case 6:
                        _a.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, this.loadPerformanceMetrics(date, symbol)];
                    case 7:
                        metrics = _a.sent();
                        if (metrics) {
                            result.set(symbol, metrics);
                        }
                        return [3 /*break*/, 9];
                    case 8:
                        error_13 = _a.sent();
                        logger_js_1.default.error("\u30B7\u30F3\u30DC\u30EB ".concat(symbol, " \u306E\u30E1\u30C8\u30EA\u30AF\u30B9\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ").concat(error_13 instanceof Error ? error_13.message : String(error_13)));
                        return [3 /*break*/, 9];
                    case 9:
                        _i++;
                        return [3 /*break*/, 5];
                    case 10: return [2 /*return*/, result];
                }
            });
        });
    };
    /**
     * 特定のシンボルとタイムフレームの最新ローソク足データを取得
     * @param symbol 銘柄（例: 'SOL/USDT'）
     * @param timeframe 時間枠（例: '1h'）
     * @returns ローソク足データの配列
     */
    DataRepository.prototype.getCandles = function (symbol, timeframe) {
        return __awaiter(this, void 0, void 0, function () {
            var dirs, normalizedSymbol, symbolDir, files, latestFile, filePath, data, error_14;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        dirs = this.getDataDirectories();
                        normalizedSymbol = symbol.replace('/', '_');
                        symbolDir = path_1.default.join(dirs.candlesDir, normalizedSymbol);
                        if (!fs_1.default.existsSync(symbolDir)) {
                            logger_js_1.default.warn("\u30B7\u30F3\u30DC\u30EB\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093: ".concat(symbolDir));
                            return [2 /*return*/, []];
                        }
                        files = fs_1.default
                            .readdirSync(symbolDir)
                            .filter(function (file) { return file.startsWith("".concat(timeframe, "_")) && file.endsWith('.json'); })
                            .sort();
                        if (files.length === 0) {
                            logger_js_1.default.warn("".concat(symbol, "\u306E").concat(timeframe, "\u30C7\u30FC\u30BF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093"));
                            return [2 /*return*/, []];
                        }
                        latestFile = files[files.length - 1];
                        filePath = path_1.default.join(symbolDir, latestFile);
                        return [4 /*yield*/, fs_1.default.promises.readFile(filePath, 'utf8')];
                    case 1:
                        data = _a.sent();
                        return [2 /*return*/, JSON.parse(data)];
                    case 2:
                        error_14 = _a.sent();
                        logger_js_1.default.error("\u30ED\u30FC\u30BD\u30AF\u8DB3\u30C7\u30FC\u30BF\u53D6\u5F97\u30A8\u30E9\u30FC: ".concat(error_14 instanceof Error ? error_14.message : String(error_14)));
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return DataRepository;
}());
exports.DataRepository = DataRepository;
// グローバルアクセス用のシングルトンインスタンス
exports.dataRepository = DataRepository.getInstance();
