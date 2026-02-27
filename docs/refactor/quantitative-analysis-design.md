# TradeVoyage 全币种量化分析系统 - 重构设计方案

> 创建日期：2026-02-19  
> 更新日期：2026-02-21  
> 状态：设计评审中，待确认后实施

---

## 1. 项目背景与目标

### 1.1 当前限制

**现状分析：**
- `Dashboard.tsx:149-153` 硬编码交易对：BitMEX 只有 BTCUSD/ETHUSD，其他只有 BTCUSDT/ETHUSDT
- `data_loader.ts:617` `getOHLCData()` 只能处理预设的 symbol
- 只统计 BTC/ETH，其他代币交易被忽略
- 统计指标基础：盈亏、胜率、盈亏比、资金费率

### 1.2 目标效果

构建一个**量化交易后台**：
1. 用户连接只读 API 导入数据后，**自动识别所有交易过的代币**
2. 提供**丰富的量化指标**（夏普比率、最大回撤、胜率趋势等）
3. **代币间对比分析**，辅助投资决策
4. **按需加载 K 线**，避免性能问题

### 1.3 设计决策（已确认）

| 决策项 | 决策内容 | 原因 |
|--------|---------|------|
| 日期选择 | **去掉** | Import API 时已选择时间范围，dashboard 直接用导入的数据 |
| K 线渲染 | **选中后加载** | 避免多代币同时渲染 K 线导致性能问题 |

---

## 2. 数据模型设计

### 2.1 新增类型定义

```typescript
// lib/types.ts 新增内容

/**
 * 单个代币的详细统计指标
 */
interface TokenMetrics {
  // 基础信息
  symbol: string;                    // 交易对符号（内部格式）
  displaySymbol: string;             // 显示名称
  
  // 交易统计
  totalSessions: number;             // 总仓位次数
  winningSessions: number;           // 盈利次数
  losingSessions: number;            // 亏损次数
  winRate: number;                   // 胜率（百分比）
  
  // 盈亏分析
  grossProfit: number;               // 总盈利（只算赚的）
  grossLoss: number;                 // 总亏损（负数）
  netPnl: number;                    // 净盈亏
  totalFunding: number;              // 资金费收入/支出
  totalFees: number;                 // 手续费
  
  // 风险指标（核心量化指标）
  sharpeRatio: number;               // 夏普比率（基于每日收益）
  sortinoRatio: number;              // 索提诺比率（只考虑下行风险）
  maxDrawdown: number;               // 最大回撤金额
  maxDrawdownPercent: number;        // 最大回撤百分比
  volatility: number;                // 波动率（日收益标准差，年化）
  
  // 交易特征
  avgHoldingTimeHours: number;       // 平均持仓时间（小时）
  bestSession: {                     // 最佳交易
    pnl: number;
    duration: number;
    date: string;
  };
  worstSession: {                    // 最差交易
    pnl: number;
    duration: number;
    date: string;
  };
  
  // 方向偏好分析
  longSessions: number;              // 做多次数
  shortSessions: number;             // 做空次数
  longPnl: number;                   // 做多盈亏
  shortPnl: number;                  // 做空盈亏
  longWinRate: number;               // 做多胜率
  shortWinRate: number;              // 做空胜率
  
  // 时间分布
  avgDailyTrades: number;            // 日均交易次数
  mostActiveHour: number;            // 交易最活跃的小时（0-23）
  mostActiveDay: string;             // 交易最活跃的星期几
  firstTradeDate: string;            // 首次交易日期
  lastTradeDate: string;             // 最后交易日期
  
  // 趋势判断
  pnlTrend: 'up' | 'down' | 'neutral';      // 盈亏趋势
  volumeTrend: 'up' | 'down' | 'neutral';   // 交易量趋势
}

/**
 * 代币筛选参数（简化版，去掉日期筛选）
 */
interface TokenFilter {
  symbols?: string[];                // 指定代币列表，不传则统计所有
  side?: 'long' | 'short' | 'both';  // 方向筛选
}

/**
 * 高级统计指标（整体账户层面）
 */
interface AdvancedStats {
  // 代币分布
  totalTokens: number;               // 交易过的代币总数
  profitableTokens: number;          // 盈利代币数
  unprofitableTokens: number;        // 亏损代币数
  topTokenConcentration: number;     // 最大盈利代币占比（集中度风险）
  tokenConcentrationRisk: 'low' | 'medium' | 'high';
  
  // 时间效率
  totalTradingDays: number;          // 总交易天数
  profitableDays: number;            // 盈利天数
  avgDailyPnl: number;               // 日均盈亏
  avgDailyVolume: number;            // 日均交易量
  
  // 风险调整收益（核心指标）
  portfolioSharpe: number;           // 组合夏普比率
  portfolioSortino: number;          // 组合索提诺比率
  calmarRatio: number;               // Calmar 比率 = 年化收益 / 最大回撤
  
  // 交易质量
  expectancy: number;                // 期望值 = (胜率 × 平均盈利) + ((1-胜率) × 平均亏损)
  profitFactor: number;              // 盈亏比 = 总盈利 / |总亏损|
  recoveryFactor: number;            // 恢复因子 = 净利润 / 最大回撤
  
  // 连续性分析
  longestWinStreak: number;          // 最长连续盈利次数
  longestLossStreak: number;         // 最长连续亏损次数
  currentStreak: number;             // 当前连胜/连败次数
  
  // 按代币的详细统计数组
  tokenMetrics: TokenMetrics[];
}
```

### 2.2 扩展现有类型

```typescript
// 扩展现有 TradingStats 接口
export interface TradingStats {
  // ===== 原有字段（保持不变，向后兼容）=====
  totalTrades: number;
  totalOrders: number;
  filledOrders: number;
  canceledOrders: number;
  rejectedOrders: number;
  fillRate: number;
  cancelRate: number;
  limitOrders: number;
  marketOrders: number;
  stopOrders: number;
  limitOrderPercent: number;
  totalRealizedPnl: number;
  totalFunding: number;
  totalFees: number;
  netPnl: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  fundingPaid: number;
  fundingReceived: number;
  tradingDays: number;
  avgTradesPerDay: number;
  monthlyPnl: { month: string; pnl: number; funding: number; trades: number }[];
  
  // ===== 新增字段 =====
  
  // 按代币统计（核心新增）
  byToken: TokenMetrics[];
  
  // 时间范围信息
  startDate: string;                 // 统计开始日期
  endDate: string;                   // 统计结束日期
  totalDays: number;                 // 统计天数
  profitableDays: number;            // 盈利天数
  unprofitableDays: number;          // 亏损天数
  
  // 账户整体高级指标
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  avgTradeReturn: number;
  returnVolatility: number;
  avgHoldingTimeMs: number;
  avgTradesPerToken: number;
  
  // 表现最佳/最差代币
  bestPerformingToken: string;
  worstPerformingToken: string;
  
  // 高级统计对象
  advanced: AdvancedStats;
}
```

---

## 3. 核心算法设计

### 3.1 自动发现所有代币

```typescript
// data_loader.ts

/**
 * 从所有交易记录中动态提取所有交易过的代币
 * 支持日期筛选，只返回指定日期范围内的代币
 */
function getAllTradedSymbols(
  executions: Execution[], 
  filter?: DateRangeFilter
): string[] {
  const symbolSet = new Set<string>();
  
  executions.forEach(exec => {
    // 应用日期筛选
    if (filter?.startDate && filter?.endDate) {
      const execDate = new Date(exec.timestamp);
      const start = new Date(filter.startDate);
      const end = new Date(filter.endDate);
      
      if (execDate < start || execDate > end) {
        return;
      }
    }
    
    symbolSet.add(exec.symbol);
  });
  
  return Array.from(symbolSet).sort();
}

/**
 * 根据交易所自动格式化代币显示名称
 * - BitMEX: XBTUSD → BTCUSD, ETHUSD → ETHUSD
 * - Binance: BTCUSDT, ETHUSDT, SOLUSDT, etc.
 * - OKX: BTC-USDT-SWAP → BTC-USDT-SWAP
 * - Bybit: BTCUSDT, ETHUSDT, etc.
 */
function formatSymbolForDisplay(symbol: string, exchange: ExchangeType): string {
  const formatters: Record<ExchangeType, (s: string) => string> = {
    bitmex: (s) => s.replace('XBT', 'BTC'),
    binance: (s) => s,
    okx: (s) => s,
    bybit: (s) => s,
  };
  
  return formatters[exchange]?.(symbol) || symbol;
}
```

### 3.2 K 线隔离策略

**问题：** K 线渲染复杂，占用空间大，影响页面简洁性

**解决方案：K 线完全隔离 + 按钮控制**

```
┌─────────────────────────────────────────────────────────────┐
│ 设计思路：K 线作为独立功能，默认关闭，按需开启               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 默认状态：K 线功能关闭                                   │
│     - 页面简洁，只显示统计卡片和表格                         │
│     - Header 区域显示 [📈 查看K线] 按钮                      │
│                                                             │
│  2. 点击按钮后：                                             │
│     - 方案 A：在新页面/Tab 打开 K 线                        │
│     - 方案 B：在当前页面展开 K 线区域                       │
│     - 提供"在新窗口打开"选项                                │
│                                                             │
│  3. K 线页面：                                               │
│     - 完全独立的页面布局                                     │
│     - 代币选择器 + K 线图表 + 交易标记                      │
│     - 可分享链接                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**UI 流程：**

```
┌─ 默认 Overview 页面（简洁）──────────────────────────────────┐
│                                                             │
│  [交易所] [Overview|Positions|Trades|AI]  [📈 查看K线]      │
│                                                             │
│  📊 统计卡片                                                 │
│  📈 代币表现表格                                             │
│  📊 高级指标面板                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ 点击 [📈 查看K线]
┌─ K 线独立页面 ──────────────────────────────────────────────┐
│                                                             │
│  [← 返回] BTCUSDT  [代币选择器 ▼]  [在新窗口打开 🔗]         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │              TradingView K 线图表                    │   │
│  │              （带交易标记）                           │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  📋 该代币交易记录                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**实现方式：**

```typescript
// 方案 A：独立路由 /chart/[symbol]
// app/chart/[symbol]/page.tsx

// 方案 B：模态框/抽屉
// components/ChartModal.tsx

// 推荐：方案 A（独立路由）
// 优点：可分享链接、浏览器前进后退、不影响主页面状态
```

**配置项：**

```typescript
// K 线功能配置
const CHART_CONFIG = {
  enabled: true,                    // 是否启用 K 线功能
  defaultOpen: false,               // 默认是否打开
  openInNewTab: true,               // 是否在新标签页打开
  route: '/chart/[symbol]',         // 独立路由
};
```
```

### 3.3 夏普比率计算

```typescript
/**
 * 计算夏普比率
 * 
 * 公式：Sharpe = (Mean(Return) - RiskFreeRate) / StdDev(Return)
 * 
 * @param dailyReturns 每日收益率数组
 * @param riskFreeRate 无风险利率（年化，默认 2% = 0.02）
 * @returns 夏普比率
 */
function calculateSharpeRatio(
  dailyReturns: number[],
  riskFreeRate: number = 0.02
): number {
  if (dailyReturns.length < 2) {
    return 0;
  }
  
  // 将年化无风险利率转为日化
  const dailyRiskFree = riskFreeRate / 365;
  
  const mean = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) 
                   / (dailyReturns.length - 1);
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) {
    return 0;
  }
  
  // 年化夏普比率
  const sharpe = ((mean - dailyRiskFree) / stdDev) * Math.sqrt(365);
  
  return Math.round(sharpe * 100) / 100;
}

/**
 * 计算每日收益率
 * 
 * 基于仓位盈亏计算每日收益
 */
function calculateDailyReturns(sessions: PositionSession[]): number[] {
  // 按日期分组计算盈亏
  const dailyPnl = new Map<string, number>();
  
  sessions.forEach(session => {
    if (!session.closeTime) return; // 跳过未平仓
    
    const date = session.closeTime.split('T')[0];
    const current = dailyPnl.get(date) || 0;
    dailyPnl.set(date, current + session.netPnl);
  });
  
  // 计算收益率（假设每日初始资金相等，简化计算）
  // 或使用 wallet balance 计算实际收益率
  const returns: number[] = [];
  let previousBalance = 10000; // 假设初始资金，实际应从 wallet 获取
  
  const sortedDates = Array.from(dailyPnl.keys()).sort();
  
  sortedDates.forEach(date => {
    const pnl = dailyPnl.get(date) || 0;
    const returnRate = pnl / previousBalance;
    returns.push(returnRate);
    previousBalance += pnl;
  });
  
  return returns;
}
```

### 3.4 最大回撤计算

```typescript
/**
 * 计算最大回撤
 * 
 * 从权益曲线的峰值到谷底的最大跌幅
 * 
 * @returns { maxDrawdown: 金额, maxDrawdownPercent: 百分比 }
 */
function calculateMaxDrawdown(
  sessions: PositionSession[]
): { maxDrawdown: number; maxDrawdownPercent: number } {
  if (sessions.length === 0) {
    return { maxDrawdown: 0, maxDrawdownPercent: 0 };
  }
  
  // 按时间排序计算累计盈亏
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.closeTime || a.openTime).getTime() - 
              new Date(b.closeTime || b.openTime).getTime()
  );
  
  let peak = 0;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  let cumulativePnl = 0;
  
  sortedSessions.forEach(session => {
    cumulativePnl += session.netPnl;
    
    if (cumulativePnl > peak) {
      peak = cumulativePnl;
    }
    
    const drawdown = peak - cumulativePnl;
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
    
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      maxDrawdownPercent = drawdownPercent;
    }
  });
  
  return {
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
  };
}
```

### 3.5 期望值计算

```typescript
/**
 * 计算交易期望值 (Expectancy)
 * 
 * 公式：Expectancy = (WinRate × AvgWin) + ((1 - WinRate) × AvgLoss)
 * 
 * 解释：每笔交易的平均预期收益
 */
function calculateExpectancy(
  winningSessions: PositionSession[],
  losingSessions: PositionSession[]
): number {
  const totalSessions = winningSessions.length + losingSessions.length;
  
  if (totalSessions === 0) {
    return 0;
  }
  
  const winRate = winningSessions.length / totalSessions;
  
  const avgWin = winningSessions.length > 0
    ? winningSessions.reduce((sum, s) => sum + s.netPnl, 0) / winningSessions.length
    : 0;
  
  const avgLoss = losingSessions.length > 0
    ? losingSessions.reduce((sum, s) => sum + s.netPnl, 0) / losingSessions.length
    : 0;
  
  const expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss);
  
  return Math.round(expectancy * 100) / 100;
}
```

---

## 4. API 接口设计

### 4.1 GET /api/trades?type=stats

**Query 参数（简化版）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `symbols` | string | 否 | 逗号分隔的代币列表（例：BTCUSDT,ETHUSDT），不传则所有 |
| `includeAdvanced` | boolean | 否 | 是否返回高级指标，默认 true |

**返回数据结构：**

```json
{
  "stats": {
    // ===== 基础统计（向后兼容）=====
    "totalTrades": 150,
    "totalOrders": 280,
    "filledOrders": 200,
    "canceledOrders": 80,
    "rejectedOrders": 0,
    "fillRate": 71.4,
    "cancelRate": 28.6,
    "limitOrders": 180,
    "marketOrders": 50,
    "stopOrders": 50,
    "limitOrderPercent": 64.3,
    "totalRealizedPnl": 15000,
    "totalFunding": -500,
    "totalFees": 1200,
    "netPnl": 13300,
    "winningTrades": 98,
    "losingTrades": 52,
    "winRate": 65.3,
    "avgWin": 205,
    "avgLoss": -98,
    "profitFactor": 2.1,
    "fundingPaid": 800,
    "fundingReceived": 300,
    "tradingDays": 120,
    "avgTradesPerDay": 1.25,
    "monthlyPnl": [
      { "month": "2024-01", "pnl": 3000, "funding": -100, "trades": 25 },
      { "month": "2024-02", "pnl": 2500, "funding": -50, "trades": 20 }
    ],
    
    // ===== 新增：时间范围信息（从导入数据中自动计算）=====
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "totalDays": 365,
    "profitableDays": 180,
    "unprofitableDays": 185,
    
    // ===== 新增：整体高级指标 =====
    "sharpeRatio": 1.65,
    "maxDrawdown": -3200,
    "maxDrawdownPercent": -12.5,
    "avgTradeReturn": 88.67,
    "returnVolatility": 2.3,
    "avgHoldingTimeMs": 172800000,
    "avgTradesPerToken": 30,
    "bestPerformingToken": "BTCUSDT",
    "worstPerformingToken": "DOGEUSDT",
    
    // ===== 新增：按代币详细统计 =====
    "byToken": [
      {
        "symbol": "BTCUSDT",
        "displaySymbol": "BTCUSDT",
        "totalSessions": 50,
        "winningSessions": 35,
        "losingSessions": 15,
        "winRate": 70,
        "grossProfit": 15000,
        "grossLoss": -3000,
        "netPnl": 12000,
        "totalFunding": -200,
        "totalFees": 400,
        "sharpeRatio": 1.85,
        "sortinoRatio": 2.1,
        "maxDrawdown": -2000,
        "maxDrawdownPercent": -10.5,
        "volatility": 1.8,
        "avgHoldingTimeHours": 48,
        "bestSession": { "pnl": 1200, "duration": 3600000, "date": "2024-03-15" },
        "worstSession": { "pnl": -800, "duration": 7200000, "date": "2024-02-20" },
        "longSessions": 30,
        "shortSessions": 20,
        "longPnl": 9000,
        "shortPnl": 3000,
        "longWinRate": 75,
        "shortWinRate": 60,
        "avgDailyTrades": 0.5,
        "mostActiveHour": 14,
        "mostActiveDay": "Wednesday",
        "firstTradeDate": "2024-01-05",
        "lastTradeDate": "2024-12-20",
        "pnlTrend": "up",
        "volumeTrend": "neutral"
      },
      {
        "symbol": "ETHUSDT",
        "displaySymbol": "ETHUSDT",
        "totalSessions": 40,
        "winningSessions": 22,
        "losingSessions": 18,
        "winRate": 55,
        "netPnl": 3000,
        "sharpeRatio": 1.2,
        "maxDrawdownPercent": -18.3,
        // ... 其他字段
      }
    ],
    
    // ===== 新增：高级统计对象 =====
    "advanced": {
      "totalTokens": 5,
      "profitableTokens": 3,
      "unprofitableTokens": 2,
      "topTokenConcentration": 0.8,
      "tokenConcentrationRisk": "high",
      "totalTradingDays": 250,
      "profitableDays": 130,
      "avgDailyPnl": 53.2,
      "avgDailyVolume": 15000,
      "portfolioSharpe": 1.65,
      "portfolioSortino": 1.9,
      "calmarRatio": 3.2,
      "expectancy": 150,
      "profitFactor": 2.1,
      "recoveryFactor": 4.16,
      "longestWinStreak": 8,
      "longestLossStreak": 4,
      "currentStreak": 3,
      "tokenMetrics": [ /* TokenMetrics 数组 */ ]
    }
  },
  "account": {
    "exportDate": "2024-12-31",
    "user": {
      "id": 12345,
      "username": "trader_user",
      "email": "trader@example.com"
    },
    "wallet": {
      "walletBalance": 50000,
      "marginBalance": 45000,
      "availableMargin": 40000,
      "unrealisedPnl": 1000,
      "realisedPnl": 15000
    },
    "positions": [ /* 当前持仓 */ ]
  }
}
```

### 4.2 新增 API 端点：GET /api/tokens

**用途：** 获取所有交易过的代币列表（用于前端选择器）

**Query 参数：**
- `exchange`: 交易所类型（bitmex/binance/okx/bybit）
- `startDate`: 开始日期（可选）
- `endDate`: 结束日期（可选）

**返回：**
```json
{
  "tokens": [
    {
      "symbol": "BTCUSDT",
      "displaySymbol": "BTCUSDT",
      "totalTrades": 50,
      "totalPnl": 12000,
      "firstTrade": "2024-01-05",
      "lastTrade": "2024-12-20"
    },
    {
      "symbol": "ETHUSDT",
      "displaySymbol": "ETHUSDT",
      "totalTrades": 40,
      "totalPnl": 3000,
      "firstTrade": "2024-01-10",
      "lastTrade": "2024-12-25"
    }
  ],
  "totalCount": 5
}
```

---

## 5. 前端组件设计

### 5.1 组件清单

#### 5.1.1 TokenSelector 组件

**文件：** `components/TokenSelector.tsx`

**Props：**
```typescript
interface TokenSelectorProps {
  availableTokens: Array<{
    symbol: string;
    displaySymbol: string;
    totalPnl: number;
    totalTrades: number;
    winRate: number;
  }>;
  selectedTokens: string[];
  onChange: (tokens: string[]) => void;
  sortBy?: 'pnl' | 'trades' | 'winRate' | 'name';
}
```

**功能：**
- 多选下拉框（类似 Select with checkbox）
- 按盈亏排序，盈利标绿，亏损标红
- 显示每个代币的基础信息（盈亏、交易次数、胜率）
- 全选/清空按钮
- 搜索过滤

**UI 设计：**
```
┌─────────────────────────────────────────────┐
│ 🪙 代币筛选  [全选] [清空]                    │
├─────────────────────────────────────────────┤
│ 🔍 搜索代币...                               │
├─────────────────────────────────────────────┤
│ ☑️ BTCUSDT    +$12,000    50笔    70%       │
│ ☑️ ETHUSDT    +$3,000     40笔    55%       │
│ ☐ SOLUSDT     +$800       25笔    60%       │
│ ☐ DOGEUSDT    -$500       30笔    40%       │
└─────────────────────────────────────────────┘
```

#### 5.1.2 TokenMetricsTable 组件

**文件：** `components/TokenMetricsTable.tsx`

**Props：**
```typescript
interface TokenMetricsTableProps {
  metrics: TokenMetrics[];
  sortable?: boolean;
  onRowClick?: (token: TokenMetrics) => void;
  selectedToken?: string;
}
```

**功能：**
- 表格展示所有代币的详细指标
- 列：代币、净盈亏、胜率、夏普比率、最大回撤、平均持仓、多空胜率
- 可点击行展开/下钻详情
- 排序功能（点击表头排序）
- 盈亏列带颜色（绿/红）
- 趋势列带图标（↗️ ↘️ ➡️）

**列定义：**
| 列名 | 字段 | 说明 |
|------|------|------|
| 代币 | displaySymbol | 带交易所图标 |
| 净盈亏 | netPnl | 格式化金额，带颜色 |
| 交易次数 | totalSessions | 数字 |
| 胜率 | winRate | 百分比，带进度条 |
| 夏普比率 | sharpeRatio | 数值，>2 标绿 |
| 最大回撤 | maxDrawdownPercent | 百分比，负数 |
| 平均持仓 | avgHoldingTimeHours | 格式化时间 |
| 做多胜率 | longWinRate | 百分比 |
| 做空胜率 | shortWinRate | 百分比 |
| 趋势 | pnlTrend | 图标表示 |

#### 5.1.3 AdvancedStatsPanel 组件

**文件：** `components/AdvancedStatsPanel.tsx`

**Props：**
```typescript
interface AdvancedStatsPanelProps {
  stats: AdvancedStats;
}
```

**功能：**
- 卡片组展示高级指标
- 分组展示：风险指标、交易质量、代币分布、连续记录

**UI 设计：**
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 高级量化指标                                               │
├─────────────────────────────────────────────────────────────┤
│ 风险指标                    交易质量                          │
│ ┌──────────────┐          ┌──────────────┐                  │
│ │ 夏普比率      │          │ 期望值        │                  │
│ │   1.65       │          │   $150       │                  │
│ │   🟢 良好    │          │   每笔交易    │                  │
│ └──────────────┘          └──────────────┘                  │
│ ┌──────────────┐          ┌──────────────┐                  │
│ │ 最大回撤      │          │ 盈亏比        │                  │
│ │  -12.5%      │          │   2.1        │                  │
│ │   🟡 中等    │          │   🟢 良好    │                  │
│ └──────────────┘          └──────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│ 代币分布                                                     │
│ [饼图：各代币盈亏占比]                                        │
│                                                             │
│ 集中度风险: 高 (80% 收益来自 BTCUSDT)                         │
├─────────────────────────────────────────────────────────────┤
│ 连续记录                                                     │
│ 最长连胜: 8次    最长连败: 4次    当前: 3连胜 🔥               │
└─────────────────────────────────────────────────────────────┘
```

#### 5.1.4 PerformanceChart 组件（增强）

**文件：** `components/PerformanceChart.tsx`

**新增功能：**
- 代币盈亏分布图（柱状图）
- 胜率趋势图（时间序列折线图）
- 持仓时间分布（箱线图或直方图）

### 5.2 Dashboard 布局调整

**修改：** `components/Dashboard.tsx`

**布局变化（K 线隔离，页面简洁）：**
```
┌─────────────────────────────────────────────────────────────┐
│ TradeVoyage Header                              [主题] [设置] │
├─────────────────────────────────────────────────────────────┤
│ [交易所] [Overview|Positions|Trades|AI]    [📈 查看K线]     │
│ 数据范围: 2024-01-01 ~ 2024-12-31（从导入数据自动获取）        │
├─────────────────────────────────────────────────────────────┤
│ 📊 Stats Overview Cards（显示所有代币汇总统计）               │
├─────────────────────────────────────────────────────────────┤
│ [权益曲线]                    [月度盈亏]                      │
├─────────────────────────────────────────────────────────────┤
│ 📈 代币表现对比                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [TokenMetricsTable 详细表格]                             │ │
│ │ 每行末尾有 [查看K线] 按钮                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 📊 高级量化指标                                               │
│ [AdvancedStatsPanel]                                         │
└─────────────────────────────────────────────────────────────┘
```

**K 线按钮交互：**

| 按钮 | 位置 | 点击行为 |
|------|------|---------|
| [📈 查看K线] | Header 右侧 | 打开默认代币（盈亏最高）的 K 线页面 |
| [查看K线] | 表格每行末尾 | 打开该代币的 K 线页面 |

### 5.3 K 线独立页面

**新建路由：** `app/chart/[symbol]/page.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│ [← 返回Dashboard]                  [在新窗口打开 🔗]         │
├─────────────────────────────────────────────────────────────┤
│ 📈 BTCUSDT                               [代币选择器 ▼]      │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                                                         │ │
│ │               TradingView K 线图表                       │ │
│ │               （带交易买入/卖出标记）                      │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 📋 BTCUSDT 交易记录                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 时间       方向   数量    价格    盈亏                     │ │
│ │ 2024-03-15 BUY   100    $42000  +$1200                  │ │
│ │ 2024-03-16 SELL  100    $43200  (平仓)                  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**路由参数：**
- `/chart/BTCUSDT` - 查看 BTCUSDT 的 K 线
- `/chart/ETHUSDT` - 查看 ETHUSDT 的 K 线

**页面功能：**
- 代币切换选择器
- K 线图表（TradingView）
- 交易标记（Entry/Exit 点位）
- 该代币的交易记录列表
- 返回 Dashboard 按钮
- 新窗口打开按钮

---

## 6. 统计口径详细说明

### 6.1 代币盈亏计算

**计算基础：**
- 基于 `PositionSession` 的 `netPnl` 字段
- 包含已实现盈亏和手续费
- 不包含未实现盈亏

**公式：**
```
Net PnL = Σ(PositionSession.netPnl)
Gross Profit = Σ(盈利的 PositionSession.netPnl)
Gross Loss = Σ(亏损的 PositionSession.netPnl)
```

### 6.2 胜率计算

**口径：**
- 以完整仓位为单位（`PositionSession`）
- 不是以单笔 execution 或订单为单位
- 只要 netPnl > 0 即算盈利

**公式：**
```
Win Rate = (盈利仓位数 / 总仓位数) × 100%
```

### 6.3 夏普比率计算

**步骤：**
1. 按日汇总盈亏（基于 session close time）
2. 计算每日收益率（当日盈亏 / 前日余额）
3. 计算收益率均值和标准差
4. 年化处理（× √365）

**假设：**
- 无风险利率：年化 2%（日化约 0.0055%）
- 日收益率基于 wallet balance 或累计盈亏计算

### 6.4 最大回撤计算

**步骤：**
1. 按时间排序所有 session
2. 计算累计盈亏曲线
3. 找到从峰值到谷底的最大跌幅
4. 返回绝对金额和百分比两种形式

**注意：**
- 包含所有已完成 session
- 不考虑未平仓 session

---

## 7. 实施计划

### Phase 1: 后端基础（核心功能）

**目标：** 实现全币种统计的后端支持

**任务清单：**

| # | 文件 | 改动内容 | 预估工时 |
|---|------|---------|---------|
| 1 | `lib/types.ts` | 新增 TokenMetrics、AdvancedStats、TokenFilter 接口 | 2h |
| 2 | `lib/types.ts` | 扩展 TradingStats 接口，添加新字段 | 1h |
| 3 | `lib/data_loader.ts` | 新增 `getAllTradedSymbols()` 函数 | 2h |
| 4 | `lib/data_loader.ts` | 新增指标计算函数（calculateSharpeRatio、calculateMaxDrawdown 等） | 4h |
| 5 | `lib/data_loader.ts` | 重构 `calculateTradingStats()` 支持代币分组统计 | 4h |
| 6 | `lib/data_loader.ts` | 新增 `calculateTokenMetrics()` 函数 | 4h |
| 7 | `lib/data_loader.ts` | 新增 `calculateAdvancedStats()` 函数 | 3h |
| 8 | `app/api/trades/route.ts` | 修改 GET handler 返回新结构 | 2h |
| 9 | `app/api/tokens/route.ts` | 新建端点返回代币列表 | 2h |

**Phase 1 总计：** 24 小时

### Phase 2: 前端组件

**目标：** 实现代币展示组件和 K 线按需加载

**任务清单：**

| # | 文件 | 改动内容 | 预估工时 |
|---|------|---------|---------|
| 10 | `components/TokenSelector.tsx` | 新建代币选择器组件 | 4h |
| 11 | `components/TokenMetricsTable.tsx` | 新建代币统计表格组件 | 6h |
| 12 | `components/AdvancedStatsPanel.tsx` | 新建高级指标面板组件 | 5h |
| 13 | `components/Dashboard.tsx` | 集成新组件，实现 K 线按需加载 | 6h |
| 14 | `components/Dashboard.tsx` | 修改数据加载逻辑 | 2h |
| 15 | `components/Dashboard.tsx` | 新增 "量化分析" 视图 Tab | 2h |
| 16 | `components/StatsOverview.tsx` | 添加代币分布概览 | 3h |
| 17 | `components/PositionSessionList.tsx` | 支持按代币筛选 | 2h |

**Phase 2 总计：** 30 小时

### Phase 3: K 线独立页面（可选，优先级低）

**目标：** 实现独立的 K 线查看页面

**任务清单：**

| # | 文件 | 改动内容 | 预估工时 |
|---|------|---------|---------|
| 18 | `app/chart/[symbol]/page.tsx` | 新建 K 线独立页面 | 4h |
| 19 | `components/ChartPage.tsx` | K 线页面主体组件 | 4h |
| 20 | `components/Dashboard.tsx` | 添加"查看K线"按钮 | 2h |
| 21 | `components/TokenMetricsTable.tsx` | 每行添加"查看K线"按钮 | 2h |
| 22 | `components/TradingViewChart.tsx` | 优化为独立页面使用 | 2h |

**Phase 3 总计：** 14 小时

### Phase 3: 可视化增强

**目标：** 增加图表和可视化展示

**任务清单：**

| # | 文件 | 改动内容 | 预估工时 |
|---|------|---------|---------|
| 20 | `components/TokenPnlChart.tsx` | 新建代币盈亏分布图 | 4h |
| 21 | `components/WinRateTrendChart.tsx` | 新建胜率趋势图 | 4h |
| 22 | `components/HoldingTimeChart.tsx` | 新建持仓时间分布图 | 3h |
| 23 | `components/MonthlyPnLChart.tsx` | 增强：支持按代币筛选 | 2h |
| 24 | `components/EquityCurve.tsx` | 增强：显示最大回撤标记 | 3h |

**Phase 3 总计：** 16 小时

### Phase 4: 测试与优化

**目标：** 确保功能稳定，性能优化

**任务清单：**

| # | 内容 | 预估工时 |
|---|------|---------|
| 25 | 单元测试：统计计算函数 | 6h |
| 26 | 集成测试：API 端点 | 4h |
| 27 | 性能优化：大数据量下的统计计算 | 4h |
| 28 | 缓存策略：统计结果缓存 | 4h |
| 29 | 文档更新：API 文档和用户使用说明 | 4h |

**Phase 4 总计：** 22 小时

### 项目总工时

- **Phase 1:** 24 小时（核心统计功能）
- **Phase 2:** 30 小时（前端组件）
- **Phase 3:** 14 小时（K 线页面，可选）
- **Phase 4:** 22 小时（测试优化）
- **总计（不含 Phase 3）：** 约 76 小时（约 10 个工作日）
- **总计（含 Phase 3）：** 约 90 小时（约 11 个工作日）

---

## 8. 风险与挑战

### 8.1 性能风险

**问题：** 如果交易历史很大（数年数据，数万笔交易），统计计算可能很慢

**解决方案：**
1. **服务端缓存：** 对统计结果进行缓存
2. **增量计算：** 保存每日的累计统计
3. **前端优化：** 防抖处理，避免频繁请求

### 8.2 K 线功能隔离

**优点：**
- 主页面简洁，加载快
- K 线逻辑完全独立，不影响主流程
- 可分享 K 线页面链接
- 用户可选择性使用

**实现方式：**
- 独立路由 `/chart/[symbol]`
- 按钮触发跳转，不在主页面嵌入
- K 线页面可独立开发和测试

### 8.3 汇率换算

**问题：** 多币种盈亏汇总需要统一汇率（如 BTC 和 ETH 盈亏如何加总）

**解决方案：**
1. **保持分离：** 各代币盈亏分开展示，不做强制汇总
2. **计价货币：** 统一转换为 USDT 或 USD 计价（使用导入时的汇率）
3. **钱包结算：** 使用 wallet history 中的实际结算金额（已经过汇率转换）

### 8.4 向后兼容

**问题：** 现有 API 调用者可能依赖旧的数据结构

**解决方案：**
- 新增字段为可选，旧客户端可忽略
- 保持原有字段不变

### 8.5 数据一致性

**问题：** PositionSession、Executions、Wallet History 可能不一致

**解决方案：**
- 以 PositionSession 为主要统计源（最准确）
- Wallet History 仅用于资金费率和手续费验证
- 添加数据校验逻辑，发现不一致时发出警告

---

## 9. 关键设计决策

### 9.1 决策记录

| # | 决策 | 选择 | 理由 |
|---|------|------|------|
| 1 | 统计基础单位 | PositionSession | 比单笔 execution 更准确，包含完整交易周期 |
| 2 | 日期选择 | 去掉 | Import API 时已选择时间范围 |
| 3 | K 线功能 | 独立页面 + 按钮控制 | 页面简洁，逻辑隔离，可选择性使用 |
| 4 | 夏普比率计算 | 基于每日收益 | 行业标准做法，便于对比 |
| 5 | 多币种汇总 | 保持分离展示 | 避免汇率换算争议，更清晰 |
| 6 | 向后兼容 | 可选字段 | 不破坏现有功能，平滑过渡 |
| 7 | 自动发现代币 | 从 executions 提取 | 无需配置，自动识别所有交易过的代币 |

### 9.2 待确认问题

**需要用户确认：**

1. **统计基础单位确认：**
   - 当前设计：以 `PositionSession`（完整仓位）为单位统计
   - 替代方案：以单笔 `Execution` 或订单为单位
   - 你的交易习惯是哪种？

2. **指标优先级：**
   - P0（必须有）：盈亏、胜率、交易次数、夏普比率、最大回撤
   - P1（重要）：索提诺比率、期望值、Calmar 比率
   - P2（加分）：持仓时间分析、时间分布
   - 是否有你特别看重但没列出的指标？

3. **币种展示：**
   - 当前设计：各代币分开统计展示
   - 替代方案：统一转换为 USDT 汇总
   - 你希望看到总体汇总还是分开？

---

## 10. 附录

### 10.1 量化指标说明

#### 夏普比率 (Sharpe Ratio)
- **定义**：风险调整后的收益率
- **公式**：(平均收益率 - 无风险利率) / 收益率标准差
- **解读**：>1 良好，>2 优秀，>3 卓越
- **用途**：衡量单位风险获得的超额收益

#### 索提诺比率 (Sortino Ratio)
- **定义**：只考虑下行风险的夏普比率变体
- **公式**：(平均收益率 - 无风险利率) / 下行标准差
- **解读**：比夏普比率更能反映真实风险
- **用途**：对策略评估更宽容（不惩罚上行波动）

#### 最大回撤 (Max Drawdown)
- **定义**：从峰值到谷底的最大跌幅
- **公式**：峰值 - 谷值
- **解读**：越小越好，反映极端风险
- **用途**：评估最坏情况下的损失

#### Calmar 比率
- **定义**：年化收益与最大回撤的比值
- **公式**：年化收益率 / 最大回撤百分比
- **解读**：>2 良好，>3 优秀
- **用途**：衡量承受回撤的能力

#### 期望值 (Expectancy)
- **定义**：每笔交易的平均预期收益
- **公式**：胜率 × 平均盈利 + 败率 × 平均亏损
- **解读**：>0 正期望，越大越好
- **用途**：评估交易系统长期盈利能力

### 10.2 文件依赖关系

```
app/api/trades/route.ts
  └─> lib/data_loader.ts
       ├─> lib/types.ts (类型定义)
       ├─> lib/exchange_types.ts (交易所类型)
       └─> lib/position_calculator.ts (仓位计算)

components/Dashboard.tsx
  ├─> components/TokenSelector.tsx
  ├─> components/TokenMetricsTable.tsx
  ├─> components/AdvancedStatsPanel.tsx
  ├─> components/StatsOverview.tsx
  ├─> components/MonthlyPnLChart.tsx
  ├─> components/EquityCurve.tsx
  └─> components/TradingViewChart.tsx (懒加载)
```

### 10.3 参考资料

- [夏普比率 - Investopedia](https://www.investopedia.com/terms/s/sharperatio.asp)
- [索提诺比率 - Investopedia](https://www.investopedia.com/terms/s/sortinoratio.asp)
- [Calmar 比率 - Investopedia](https://www.investopedia.com/terms/c/calmarratio.asp)
- [交易期望值 - BabyPips](https://www.babypips.com/learn/forex/expectancy)

---

## 11. Implementation Notes & Recommendations (2026-02-21)

### 11.1 已验证的问题与最小修复思路

**问题：代币发现不全（只拿到部分交易币种）**
- 原因：`/fapi/v1/income` 单次 `limit=1000` 且无分页，会漏掉历史记录
- 建议最小修复：
  - 使用 `incomeType=COMMISSION`（每笔交易都会有手续费记录）
  - 按时间窗口（7 天）+ “lastTime + 1” 分页循环
  - 先保留 `USDT` 过滤（用户仅做 USDT 合约）

**结论：最小修复无需改 UI 或统计结构，先保证 symbol 能完整发现**

### 11.2 结构性优化建议（后续阶段）

1. **代币发现解耦**
   - 新增 `/api/tokens` 轻量接口，Dashboard 不必依赖 `stats` 才能拿到币种列表
2. **避免重复 API 调用**
   - `exportBinanceData` 先拿 `symbols`，传递给 orders/trades/income 子流程
3. **统计计算可控**
   - `/api/trades?type=stats` 增加 `includeAdvanced` 参数
   - 对 CSV mtime 做缓存，避免每次全量重算
4. **K 线隔离**
   - 按设计迁移到独立路由 `/chart/[symbol]`，避免多币种同时渲染
5. **重新导入体验**
   - 由于 CSV 是导入时生成的，新发现的币种必须重新导入
   - 建议提供“快速重新导入/刷新币种”按钮（默认复用旧 CSV + 只拉新增币种）

---

## 12. 评审检查清单

**设计评审前请确认：**

- [ ] 统计口径（PositionSession vs Execution）
- [ ] 指标列表（是否遗漏重要指标）
- [ ] 多币种展示方式（分开 vs 汇总）
- [ ] K 线按需加载策略是否合理
- [ ] 优先级（Phase 1/2/3/4 的顺序）
- [ ] 性能要求（数据量预期）
- [ ] 向后兼容性要求

**确认后请回复：**
1. 方案是否通过？
2. 是否有修改意见？
3. 是否需要调整优先级？
4. 何时开始实施？

---

*文档版本：v1.3*
*创建日期：2026-02-19*
*更新日期：2026-02-26*
*状态：实施中*

---

## 13. Dashboard UI 重构需求（2026-02-26）

> 基于 Figma 设计：`https://www.figma.com/make/UNioyL2en7YVT90LDAXOfE/portfolio-page-design`

### 13.1 需求概述

采用 Figma 设计风格重构 Dashboard，实现更简洁现代的 UI。

### 13.2 组件改动清单

#### 13.2.1 MetricsCards 指标卡片

**需求：**
- 采用 Figma 卡片样式（圆角、阴影、图标）
- 动态支持数据，高可维护性
- 后续添加新指标只需简单配置

**设计参考：** Figma `MetricsCards.tsx`

**数据映射：**
```typescript
const cardConfigs = [
  { key: 'netPnl', title: 'Net PnL', icon: DollarSign, color: 'blue' },
  { key: 'winRate', title: 'Win Rate', icon: Target, color: 'green' },
  { key: 'profitFactor', title: 'Profit Factor', icon: Award, color: 'purple' },
  { key: 'maxDrawdown', title: 'Max Drawdown', icon: BarChart3, color: 'orange' },
  // 可扩展：只需在此数组添加新配置即可
];
```

#### 13.2.2 ApiConnection 组件

**需求：**
- 采用 Figma 样式
- 点击齿轮弹出设置面板
- 设置面板包含：日期选择器（与现有 Import 页面一致）
- Save config 后显示 Fetch 按钮
- 点击 Fetch 开始拉取数据，显示进度条

**交互流程：**
```
[⚙️ Settings] → 弹出面板
  ├── API Key 输入框
  ├── API Secret 输入框
  ├── 日期选择器（开始/结束日期）
  └── [Save] [Cancel]

Save 后 → 显示 [🔄 Fetch Data] 按钮
Fetch 点击 → 显示进度条
  ├── 0%: Connecting...
  ├── 25%: Fetching orders...
  ├── 50%: Fetching trades...
  ├── 75%: Fetching income...
  └── 100%: Complete!
```

**数据流：**
```
ApiConnection (设置日期 + Fetch)
    ↓
调用币安 API 拉取数据
    ↓
存储到本地 / 更新 stats
    ↓
MetricsCards / PerformanceChart / TradesTable 响应更新
```

#### 13.2.3 PerformanceChart 权益曲线

**需求：**
- 采用 Figma Area Chart 样式（渐变填充）
- 根据 ApiConnection 选择的日期范围渲染
- 使用 fetch 回来的数据

**设计参考：** Figma `PerformanceChart.tsx`

#### 13.2.4 TradesTable 交易记录表格

**需求：**
- 采用 Figma 表格样式
- 显示从币安 API 拉取的交易记录
- 列：Symbol | Type | Quantity | Entry | Exit | Time | P&L | Return | Status

**设计参考：** Figma `TradesTable.tsx`

#### 13.2.5 K线处理

**需求：**
- 从 Dashboard 移除（注释或删除）
- 后续移至独立页面 `/chart/[symbol]`

### 13.3 实施优先级

| 优先级 | 组件 | 说明 |
|--------|------|------|
| P0 | MetricsCards | 核心展示组件 |
| P0 | ApiConnection | 数据入口，阻塞其他组件 |
| P1 | PerformanceChart | 依赖 ApiConnection 数据 |
| P1 | TradesTable | 依赖 ApiConnection 数据 |
| P2 | K线移除/独立 | 可后续处理 |

---

**v1.3 更新内容：**
- 新增 Dashboard UI 重构需求（基于 Figma 设计）
- MetricsCards 动态配置设计
- ApiConnection 组件交互流程
- K线暂时移除，后续独立页面

**v1.2 更新内容：**
- K 线改为独立页面 + 按钮控制
- 主页面更简洁，K 线逻辑完全隔离
- 新增 `/chart/[symbol]` 路由设计
- 调整实施计划，Phase 3 改为 K 线页面（可选）

**v1.1 更新内容：**
- 去掉日期选择器（Import API 时已选择时间范围）
- 简化 API 参数
