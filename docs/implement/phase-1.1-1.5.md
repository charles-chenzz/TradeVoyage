# Phase 1.1-1.5 实施记录

> 实施日期：2026-02-21  
> 状态：已完成

---

## 实施概览

本阶段完成了以下任务：

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 1.1 | 新增 `TokenMetrics` 接口 | `lib/types.ts` | ✅ |
| 1.2 | 新增 `AdvancedStats` 接口 | `lib/types.ts` | ✅ |
| 1.3 | 新增 `TokenFilter` 接口 | `lib/types.ts` | ✅ |
| 1.4 | 扩展 `TradingStats` 接口 | `lib/types.ts` | ✅ |
| 1.5 | 实现 `getAllTradedSymbols()` 函数 | `lib/data_loader.ts` | ✅ |

---

## 设计思路

### 1. 类型定义设计

#### TokenMetrics 接口

**设计决策：**
- 使用 `TokenMetrics` 作为主名称，`TokenStats` 作为别名保持向后兼容
- 字段命名遵循交易行业惯例（如 `sharpeRatio`, `maxDrawdown`）
- 使用 `sessions` 而非 `trades` 作为统计单位，更准确反映完整交易周期

**核心字段：**
```typescript
interface TokenMetrics {
    symbol: string;                    // 内部符号
    displaySymbol: string;             // 显示符号（XBT → BTC）
    totalSessions: number;             // 总仓位次数
    winningSessions: number;           // 盈利次数
    losingSessions: number;            // 亏损次数
    winRate: number;                   // 胜率
    grossProfit: number;               // 总盈利
    grossLoss: number;                 // 总亏损（负数）
    netPnl: number;                    // 净盈亏
    sharpeRatio: number;               // 夏普比率
    maxDrawdown: number;               // 最大回撤
    // ... 其他字段
}
```

#### AdvancedStats 接口

**设计决策：**
- 将高级统计独立为接口，便于后续扩展
- 包含风险集中度分析（`tokenConcentrationRisk`）
- 包含连续记录（连胜/连败）

**核心字段：**
```typescript
interface AdvancedStats {
    totalTokens: number;               // 代币总数
    profitableTokens: number;          // 盈利代币数
    portfolioSharpe: number;           // 组合夏普比率
    calmarRatio: number;               // Calmar 比率
    expectancy: number;                // 期望值
    longestWinStreak: number;          // 最长连胜
    longestLossStreak: number;         // 最长连败
    tokenMetrics: TokenMetrics[];      // 各代币详细统计
}
```

#### TokenFilter 接口

**设计决策：**
- 简化版本，去掉日期筛选（Import API 时已选择时间范围）
- 只保留代币列表和方向筛选

```typescript
interface TokenFilter {
    symbols?: string[];                // 指定代币列表
    side?: 'long' | 'short' | 'both';  // 方向筛选
}
```

### 2. 函数实现设计

#### getAllTradedSymbols()

**功能：** 从执行记录中自动发现所有交易过的代币

**实现逻辑：**
```typescript
export function getAllTradedSymbols(exchange: ExchangeType): string[] {
    const executions = loadExecutionsFromCSV(exchange);
    const symbolSet = new Set<string>();
    
    executions.forEach(exec => {
        // 只统计实际交易，过滤掉 Funding、Settlement 等类型
        if (exec.execType === 'Trade' && exec.lastQty > 0) {
            symbolSet.add(exec.symbol);
        }
    });
    
    return Array.from(symbolSet).sort();
}
```

**关键点：**
- 使用 `Set` 去重
- 只统计 `execType === 'Trade'` 的记录
- 过滤 `lastQty > 0` 确保是有效交易
- 返回排序后的数组

#### getTradedTokensInfo()

**功能：** 获取所有交易代币的汇总信息

**返回结构：**
```typescript
interface TradedTokenInfo {
    symbol: string;
    displaySymbol: string;
    totalSessions: number;
    totalPnl: number;
    firstTrade: string;
    lastTrade: string;
}
```

**实现逻辑：**
1. 从 PositionSession 中聚合数据
2. 计算每个代币的总交易次数和盈亏
3. 记录首次和最后交易时间
4. 按盈亏排序返回

---

## 文件变更

### lib/types.ts

**新增接口：**
- `TokenMetrics` - 单个代币详细统计
- `TokenStats` - TokenMetrics 别名（兼容）
- `TokenFilter` - 代币筛选参数
- `AdvancedStats` - 整体高级统计

**修改接口：**
- `TradingStats` - 添加 `byToken`、`advanced` 等字段

### lib/data_loader.ts

**新增函数：**
- `getAllTradedSymbols()` - 获取所有交易过的代币列表
- `getTradedTokensInfo()` - 获取代币汇总信息

**新增接口：**
- `TradedTokenInfo` - 代币信息结构

---

## 遗留问题

### LSP 类型错误

`calculateTradingStats()` 函数当前返回类型不完整，缺少新增字段：
- `byToken`
- `advanced`
- `startDate` / `endDate`
- 等高级指标字段

**解决方案：** 后续 Phase 1.10-1.12 将实现完整的统计函数

---

## 后续步骤

| Phase | 任务 | 依赖 |
|-------|------|------|
| 1.6-1.9 | 实现高级指标计算函数（Sharpe、MaxDrawdown 等） | 无 |
| 1.10 | 实现 `calculateTokenMetrics()` | 1.6-1.9 |
| 1.11 | 实现 `calculateAdvancedStats()` | 1.10 |
| 1.12 | 重构 `calculateTradingStats()` | 1.10-1.11 |

---

## 验收检查

- [x] TokenMetrics 接口定义完整
- [x] AdvancedStats 接口定义完整
- [x] TokenFilter 接口定义完整
- [x] TradingStats 扩展字段正确
- [x] getAllTradedSymbols() 返回正确的代币列表
- [x] getTradedTokensInfo() 返回正确的汇总信息
- [x] 类型导出正确

---

## 使用示例

```typescript
import { 
    getAllTradedSymbols, 
    getTradedTokensInfo,
    TokenMetrics,
    AdvancedStats 
} from '@/lib/data_loader';

// 获取所有交易过的代币
const symbols = getAllTradedSymbols('binance');
// 返回: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', ...]

// 获取代币汇总信息
const tokensInfo = getTradedTokensInfo('binance');
// 返回: [{ symbol: 'BTCUSDT', totalPnl: 12000, ... }, ...]
```
