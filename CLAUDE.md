# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Language
**All communication with Claude should be conducted in Japanese.** This is the preferred language for development discussions, code reviews, todo task management, and general project coordination.

## Common Development Commands

### Build and Test Commands
- `npm run build` - Build the project (TypeScript → CommonJS)
- `npm run test` - Run Jest tests (CommonJS mode for stability)
- `npm run test:unified` - Run integrated tests (both CJS and ESM)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Running the Bot
- `npm run dev` - Development mode with ts-node
- `npm run start` - Production mode (requires build first)
- `npm run backtest` - Run backtesting
- `npm run cli -- --help` - Show CLI options

### Testing Specific Groups
- `npm run test:parallel:fast` - Fast tests (utils, config, indicators)
- `npm run test:parallel:medium` - Medium tests (strategies, services)
- `npm run test:parallel:slow` - Slow tests (some services)
- `npm run test:parallel:heavy` - Heavy tests (RealTimeDataProcessor)

### Todo Management
- `npm run todo-lint` - Validate todo format in .todo/ files
- `npm run todo-fix` - Auto-fix some todo issues

### Data Management
- `npm run fetch-data` - Fetch multi-timeframe data
- `npm run data-lifecycle` - Manage data lifecycle (S3/Glacier archiving)

## Architecture Overview

### Module System
This project uses **CommonJS** for stability and compatibility. All TypeScript code compiles to CommonJS modules:
- Main entry: `dist/index.js` (CommonJS)
- Module exports use `module.exports = { ... }`
- Imports use `const { Module } = require('./path')`

### Core Components

#### Trading Engine (`src/core/`)
- **tradingEngine.ts**: Main trading logic with market regime detection
- **multiSymbolTradingEngine.js**: Multi-symbol portfolio management (optimized in REF-036)
- **AllocationManager.js**: Fund allocation strategies (separated from multiSymbol engine)
- **PortfolioRiskAnalyzer.js**: VaR calculation and correlation analysis
- **backtestRunner.ts**: Backtesting with performance metrics

#### Strategy System (`src/strategies/`)
- **trendFollowStrategy.ts**: Donchian breakout + ADX trend following
- **meanReversionStrategy.ts**: Grid trading with dynamic levels
- **DonchianBreakoutStrategy.ts**: ATR-based breakout strategy
- Market regime detection automatically selects appropriate strategy

#### Data Layer (`src/data/`)
- **dataRepository.ts**: Parquet-based data persistence with async mutex
- **RealTimeDataProcessor.ts**: LRU cache + backpressure handling
- **MultiTimeframeDataFetcher.ts**: Multi-timeframe data collection
- Uses DuckDB for fast analytical queries

#### Services (`src/services/`)
- **orderSizingService.ts**: Risk-based position sizing for multiple assets
- **exchangeService.ts**: Multi-exchange API integration (Binance, Bybit, KuCoin)
- **UnifiedOrderManager.ts**: Cross-exchange order management with allocation strategies

### Testing Strategy

#### Test Environment
- **Jest** in CommonJS mode for stability
- TypeScript tests compile to JS before execution
- Test files use `.test.js` or `.test.ts` extensions
- Mock factories in `src/utils/test-helpers/mock-factories/`

#### Test Groups
Tests are categorized by execution time:
- **fast**: < 3 seconds (utils, config, indicators)
- **medium**: 3-10 seconds (strategies, services)  
- **slow**: 10-30 seconds (some services)
- **heavy**: 30+ seconds (RealTimeDataProcessor)
- **core**: Core functionality tests

#### Running Tests
Always run the full test suite before committing:
```bash
npm run test:unified  # Runs all test groups
npm run lint          # Check code style
```

## Project Structure Guidelines

### File Organization
- `src/core/` - Trading engine and backtest logic
- `src/strategies/` - Trading strategy implementations
- `src/data/` - Data fetching, storage, and processing
- `src/services/` - External service integrations
- `src/utils/` - Utility functions and helpers
- `src/indicators/` - Technical indicator calculations
- `src/config/` - Configuration and parameters

### Configuration
- Main config in `src/config/parameters.ts`
- Environment variables in `.env` (copy from `.env.example`)
- Multi-symbol config example in `src/config/multiSymbolConfig.example.json`

### Todo Task Management
This project uses a structured todo system in `.todo/` directory:
- `backlog.mdc` - Unstarted tasks
- `sprint.mdc` - Current sprint WIP/Done tasks  
- `archive.mdc` - Completed tasks

Task format:
```
- [ ] TASK-ID: Description
      - 📅 Due        : YYYY-MM-DD
      - 👤 Owner      : @username
      - 🏷️ Label      : feat/bug/doc/infra
      - 🩺 Health     : ⏳/⚠️/🚑/✅
      - 📊 Progress   : 0%/25%/50%/75%/100%
```

Always validate todos before committing: `npm run todo-lint`

## Development Practices

### Code Style
- Use TypeScript for all new code
- Follow existing patterns for imports/exports
- Run `npm run lint` and `npm run format` before committing
- Maintain 90%+ test coverage

### Git Workflow
- Create feature branches for changes: `git switch -c feature/description`
- Reference todo task IDs in PR titles: "TASK-001: Add new feature"
- Use PR template to link to relevant tasks
- Run tests before pushing: `npm run test:unified`

### Security
- Never commit API keys or secrets
- Use environment variables for sensitive data
- Run `npm run todo-lint` to validate task format
- Gitleaks scans for secrets automatically

### Multi-Symbol Support
The bot supports trading multiple cryptocurrency pairs simultaneously:
- Configure symbols in CLI: `--symbols SOL/USDT,BTC/USDT,ETH/USDT`
- Multi-timeframe support: `--timeframes 1h,4h,1d`
- Portfolio risk management with correlation analysis
- Dynamic allocation strategies (equal, volatility-based, custom)

### Market Regimes
The system automatically detects market conditions:
- **STRONG_UPTREND/DOWNTREND**: Strong directional movement (ADX > 25)
- **UPTREND/DOWNTREND**: Normal trend conditions
- **RANGE**: Low volatility sideways movement
- **EMERGENCY**: Rapid price movements (black swan events)

Strategy selection adapts to detected regime automatically.

## Key Implementation Notes

### CommonJS Conversion (REF-036)
Recent optimization work converted the multiSymbol trading engine from TypeScript to CommonJS JavaScript for better Jest compatibility and reduced native stack trace errors. The engine is now split into modular components:
- `multiSymbolTradingEngine.js` - Main orchestration
- `AllocationManager.js` - Fund allocation logic  
- `PortfolioRiskAnalyzer.js` - Risk analysis and VaR calculation

### Test Stability
Jest configuration is optimized for stability:
- Source maps disabled to avoid native stack trace errors
- Limited to 2 workers to prevent test interference
- Memory limits set to 2GB per worker
- DuckDB mocked to avoid native module issues

### Performance Optimizations
- LRU cache in RealTimeDataProcessor for memory efficiency
- Incremental EMA/ATR calculations for 10x performance improvement
- Async mutex in DataRepository prevents write conflicts
- Backpressure handling in data processing pipeline

When making changes, always test thoroughly and maintain the existing architecture patterns.