# Phase 1.10-1.14 实施记录

> 实施日期：2026-02-21  
> 状态：已完成

---

## 实施概览

本阶段完成了以下任务：

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 1.10 | 实现 `calculateTokenMetrics()` 函数 | `lib/data_loader.ts` | ✅ |
| 1.12 | 重构 `calculateTradingStats()` 函数 | `lib/data_loader.ts` | ✅ |
| 1.14 | API 自动返回新结构 | `lib/data_loader.ts` | ✅ |

---

## 设计思路

### 1. calculateTokenMetrics() 函数

**功能：** 计算单个代币的详细统计指标

**输入参数：**
- `symbol`: 代币符号
- `sessions`: 所有仓位会话
- `exchange`: 交易所类型

**核心计算逻辑：**

```typescript
function calculateTokenMetrics(symbol, sessions, exchange): TokenMetrics {
    // 1. 筛选该代币的所有已关闭仓位
    const symbolSessions = sessions.filter(s => s.symbol === symbol);
    const closedSessions = symbolSessions.filter(s => s.status === 'closed');
    
    // 2. 基础统计
    const winningSessions = closedSessions.filter(s => s.netPnl > 0);
    const losingSessions = closedSessions.filter(s => s.netPnl < 0);
    const winRate = (winningSessions.length / closedSessions.length) * 100;
    
    // 3. 盈亏计算
    const grossProfit = winningSessions.reduce((sum, s) => sum + s.netPnl, 0);
    const grossLoss = losingSessions.reduce((sum, s) => sum + s.netPnl, 0);
    const netPnl = grossProfit + grossLoss;
    
    // 4. 风险指标计算
    // - 夏普比率：基于每日收益
    // - 最大回撤：累计盈亏曲线峰值到谷值
    // - 波动率：日收益标准差年化
    
    // 5. 方向分析
    const longSessions = closedSessions.filter(s => s.side === 'long');
    const shortSessions = closedSessions.filter(s => s.side === 'short');
    
    // 6. 时间分布
    // - 最活跃小时
    // - 最活跃星期几
    // - 首次/最后交易日期
    
    // 7. 趋势判断
    // - 比较前半段和后半段盈亏
}
```

**关键设计决策：**

| 决策 | 选择 | 原因 |
|------|------|------|
| 统计单位 | PositionSession | 完整仓位周期，更准确 |
| 夏普比率 | 简化计算 | 假设固定初始资金，避免复杂汇率问题 |
| 最大回撤 | 基于累计盈亏 | 不依赖钱包余额，更通用 |

### 2. calculateAdvancedStats() 函数

**功能：** 计算整体账户的高级统计指标

**核心计算逻辑：**

```typescript
function calculateAdvancedStats(tokenMetrics, sessions): AdvancedStats {
    // 1. 代币分布
    const profitableTokens = tokenMetrics.filter(t => t.netPnl > 0).length;
    const topTokenConcentration = topTokenPnl / totalPnl;
    
    // 2. 集中度风险评估
    if (topTokenConcentration > 0.7) risk = 'high';
    else if (topTokenConcentration > 0.4) risk = 'medium';
    else risk = 'low';
    
    // 3. 组合夏普比率
    const portfolioSharpe = avg(tokenMetrics.sharpeRatio);
    
    // 4. Calmar 比率
    const calmarRatio = (年化收益 / 最大回撤百分比);
    
    // 5. 期望值
    const expectancy = (winRate × avgWin) + ((1 - winRate) × avgLoss);
    
    // 6. 连胜/连败记录
    // 遍历按时间排序的 session，计算连续记录
}
```

### 3. 重构 calculateTradingStats() 函数

**新增字段：**

```typescript
return {
    // 原有字段（保持不变）
    totalTrades, totalOrders, ...
    
    // 新增：按代币统计
    byToken: TokenMetrics[],
    
    // 新增：时间范围
    startDate: string,
    endDate: string,
    totalDays: number,
    profitableDays: number,
    unprofitableDays: number,
    
    // 新增：高级指标
    sharpeRatio: number,
    maxDrawdown: number,
    maxDrawdownPercent: number,
    avgTradeReturn: number,
    returnVolatility: number,
    avgHoldingTimeMs: number,
    avgTradesPerToken: number,
    bestPerformingToken: string,
    worstPerformingToken: string,
    
    // 新增：高级统计对象
    advanced: AdvancedStats,
};
```

**执行流程：**

```
calculateTradingStats(exchange)
    │
    ├── loadTradesFromCSV()
    ├── loadOrdersFromCSV()
    ├── loadWalletHistoryFromCSV()
    ├── getPositionSessions()
    ├── getAllTradedSymbols()
    │
    ├── 计算基础统计（原有逻辑）
    │
    ├── 计算 byToken
    │   └── for each symbol:
    │       └── calculateTokenMetrics(symbol, sessions, exchange)
    │
    ├── 计算时间范围和高级指标
    │
    ├── 计算 advanced
    │   └── calculateAdvancedStats(byToken, sessions)
    │
    └── 返回完整 TradingStats
```

---

## 文件变更

### lib/data_loader.ts

**新增函数：**
- `calculateTokenMetrics()` - 计算单代币统计（约 150 行）
- `calculateAdvancedStats()` - 计算高级统计（约 120 行）

**修改函数：**
- `calculateTradingStats()` - 返回完整新结构（新增约 80 行）

**新增导入：**
- `TokenMetrics`, `AdvancedStats` 类型

---

## API 返回结构示例

```json
{
  "stats": {
    "totalTrades": 150,
    "winRate": 65.3,
    "netPnl": 13300,
    "monthlyPnl": [...],
    
    "byToken": [
      {
        "symbol": "BTCUSDT",
        "displaySymbol": "BTCUSDT",
        "totalSessions": 50,
        "winningSessions": 35,
        "losingSessions": 15,
        "winRate": 70,
        "netPnl": 12000,
        "sharpeRatio": 1.85,
        "maxDrawdown": 2000,
        "maxDrawdownPercent": 10.5,
        "avgHoldingTimeHours": 48,
        "longSessions": 30,
        "shortSessions": 20,
        "longWinRate": 75,
        "shortWinRate": 60,
        "pnlTrend": "up"
      }
    ],
    
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "totalDays": 365,
    "profitableDays": 180,
    
    "sharpeRatio": 1.65,
    "maxDrawdown": 3200,
    "maxDrawdownPercent": 12.5,
    "bestPerformingToken": "BTCUSDT",
    "worstPerformingToken": "DOGEUSDT",
    
    "advanced": {
      "totalTokens": 5,
      "profitableTokens": 3,
      "topTokenConcentration": 0.8,
      "tokenConcentrationRisk": "high",
      "portfolioSharpe": 1.65,
      "calmarRatio": 3.2,
      "expectancy": 150,
      "longestWinStreak": 8,
      "longestLossStreak": 4,
      "currentStreak": 3
    }
  }
}
```

---

## 遗留问题

### 1. 资金费率按代币统计

当前 `TokenMetrics.totalFunding` 设为 0，因为 wallet history 中没有按代币区分资金费率。

**后续优化方向：**
- 从 execution 的 text 字段解析
- 或从外部 API 获取历史资金费率

### 2. 简化的夏普比率

当前夏普比率使用简化计算（固定初始资金假设），实际应使用真实的 wallet balance。

**后续优化方向：**
- 使用 wallet history 中的实际余额
- 或让用户输入初始资金

### 3. 性能优化

当交易历史很大时，每次请求都重新计算可能较慢。

**后续优化方向：**
- 添加服务端缓存
- 考虑增量计算

---

## 验收检查

- [x] `calculateTokenMetrics()` 正确计算单代币统计
- [x] `calculateAdvancedStats()` 正确计算高级指标
- [x] `calculateTradingStats()` 返回完整新结构
- [x] TypeScript 编译通过
- [x] 向后兼容（原有字段不变）

---

## 使用示例

```typescript
import { calculateTradingStats, getTradedTokensInfo } from '@/lib/data_loader';

// 获取完整统计
const stats = calculateTradingStats('binance');
console.log(stats.byToken);        // 各代币统计
console.log(stats.advanced);       // 高级指标
console.log(stats.bestPerformingToken);  // 最佳代币

// 获取代币列表
const tokens = getTradedTokensInfo('binance');
console.log(tokens);  // [{ symbol, totalPnl, ... }, ...]
```
