"use strict";
/**
 * アプリケーション全体で使用する型定義
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskLevel = exports.SystemMode = exports.OrderStatus = exports.OrderSide = exports.OrderType = exports.StrategyType = exports.MarketEnvironment = void 0;
exports.isNumericTimestamp = isNumericTimestamp;
exports.normalizeTimestamp = normalizeTimestamp;
// タイムスタンプの型ガード関数
function isNumericTimestamp(timestamp) {
    return typeof timestamp === 'number';
}
// ISO文字列タイムスタンプをミリ秒数値に変換する関数
function normalizeTimestamp(timestamp) {
    if (isNumericTimestamp(timestamp)) {
        return timestamp;
    }
    // ISO文字列からDateオブジェクトを生成し、ミリ秒タイムスタンプに変換
    return new Date(timestamp).getTime();
}
// 市場環境の種類
var MarketEnvironment;
(function (MarketEnvironment) {
    MarketEnvironment["UPTREND"] = "uptrend";
    MarketEnvironment["DOWNTREND"] = "downtrend";
    MarketEnvironment["STRONG_UPTREND"] = "strong_uptrend";
    MarketEnvironment["STRONG_DOWNTREND"] = "strong_downtrend";
    MarketEnvironment["WEAK_UPTREND"] = "weak_uptrend";
    MarketEnvironment["WEAK_DOWNTREND"] = "weak_downtrend";
    MarketEnvironment["RANGE"] = "range";
    MarketEnvironment["UNKNOWN"] = "unknown";
})(MarketEnvironment || (exports.MarketEnvironment = MarketEnvironment = {}));
// 取引戦略の種類
var StrategyType;
(function (StrategyType) {
    StrategyType["TREND_FOLLOWING"] = "trend_following";
    StrategyType["RANGE_TRADING"] = "range_trading";
    StrategyType["MEAN_REVERT"] = "mean_revert";
    StrategyType["EMERGENCY"] = "emergency";
    StrategyType["DONCHIAN_BREAKOUT"] = "donchian_breakout";
})(StrategyType || (exports.StrategyType = StrategyType = {}));
// 注文のタイプ
var OrderType;
(function (OrderType) {
    OrderType["MARKET"] = "market";
    OrderType["LIMIT"] = "limit";
    OrderType["STOP"] = "stop";
    OrderType["STOP_LIMIT"] = "stop_limit";
    OrderType["STOP_MARKET"] = "stop_market";
})(OrderType || (exports.OrderType = OrderType = {}));
// 注文の方向
var OrderSide;
(function (OrderSide) {
    OrderSide["BUY"] = "buy";
    OrderSide["SELL"] = "sell";
})(OrderSide || (exports.OrderSide = OrderSide = {}));
// 注文のステータス
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["OPEN"] = "open";
    OrderStatus["PLACED"] = "placed";
    OrderStatus["FILLED"] = "filled";
    OrderStatus["CANCELED"] = "canceled";
    OrderStatus["REJECTED"] = "rejected"; // 拒否された注文
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
/**
 * システムモード
 */
var SystemMode;
(function (SystemMode) {
    SystemMode["NORMAL"] = "normal";
    SystemMode["RISK_REDUCTION"] = "risk_reduction";
    SystemMode["STANDBY"] = "standby";
    SystemMode["EMERGENCY"] = "emergency";
    SystemMode["KILL_SWITCH"] = "kill_switch";
})(SystemMode || (exports.SystemMode = SystemMode = {}));
/**
 * リスクレベル
 */
var RiskLevel;
(function (RiskLevel) {
    RiskLevel["LOW"] = "low";
    RiskLevel["MEDIUM"] = "medium";
    RiskLevel["HIGH"] = "high";
})(RiskLevel || (exports.RiskLevel = RiskLevel = {}));
