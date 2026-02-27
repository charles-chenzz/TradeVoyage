# Phase 2.1-2.4 实施记录

> 实施日期：2026-02-21  
> 状态：已完成

---

## 实施概览

本阶段完成了以下任务：

| # | 任务 | 文件 | 状态 |
|---|------|------|------|
| 2.1 | TokenSelector 组件 | `components/TokenSelector.tsx` | ✅ |
| 2.2 | TokenMetricsTable 组件 | `components/TokenMetricsTable.tsx` | ✅ |
| 2.4 | Dashboard 集成新组件 | `components/Dashboard.tsx` | ✅ |

---

## 设计思路

### 1. TokenSelector 组件

**功能：** 代币选择下拉框，支持搜索、按盈亏排序

**特性：**
- 下拉框形式，点击展开
- 搜索过滤功能
- 显示代币名称、盈亏金额、交易次数
- 盈利代币绿色圆点，亏损代币红色圆点
- 选中状态有勾选标记

**UI 效果：**
```
┌─────────────────────────────────┐
│ 🟢 BTCUSDT  +$12,000    ▼      │
└─────────────────────────────────┘
          ↓ 点击展开
┌─────────────────────────────────┐
│ 🔍 搜索代币...                  │
├─────────────────────────────────┤
│ 🟢 BTCUSDT    +$12,000   50笔  │ ✓
│ 🟢 ETHUSDT    +$3,000    40笔  │
│ 🔴 DOGEUSDT   -$500      30笔  │
└─────────────────────────────────┘
```

### 2. TokenMetricsTable 组件

**功能：** 表格展示所有代币的详细统计指标

**特性：**
- 可排序列（点击表头）
- 盈亏颜色编码（绿色盈利、红色亏损）
- 胜率进度条
- 趋势图标（↗️ ↘️ ➡️）
- 点击行选中代币

**列定义：**

| 列名 | 字段 | 说明 |
|------|------|------|
| 代币 | displaySymbol | 带颜色圆点和日期范围 |
| 净盈亏 | netPnl | 格式化金额，带颜色 |
| 交易次数 | totalSessions | 数字 |
| 胜率 | winRate | 进度条 + 百分比 |
| 夏普比率 | sharpeRatio | >2 标绿 |
| 最大回撤 | maxDrawdownPercent | 红色百分比 |
| 做多/做空 | longWinRate/shortWinRate | 百分比 |
| 趋势 | pnlTrend | 图标 |

**UI 效果：**
```
┌──────────────────────────────────────────────────────────────────────┐
│ 代币表现对比                              共 5 个代币 · 2024-01 ~ 2024-12 │
├────────┬──────────┬────────┬────────┬────────┬──────────┬───────────┤
│ 代币   │ 净盈亏   │ 交易   │ 胜率   │ 夏普   │ 最大回撤 │ 多/空     │
├────────┼──────────┼────────┼────────┼────────┼──────────┼───────────┤
│🟢BTC   │+$12,000  │ 50     │███░ 70%│ 1.85   │ -10.5%   │ 75%/60%   │
│🟢ETH   │+$3,000   │ 40     │██░░ 55%│ 1.20   │ -18.3%   │ 60%/50%   │
│🔴DOGE  │-$500     │ 30     │█░░░ 40%│ -0.30  │ -25.0%   │ 35%/45%   │
└────────┴──────────┴────────┴────────┴────────┴──────────┴───────────┘
```

### 3. Dashboard 集成

**改动内容：**

1. **新增导入：**
   - `TokenMetrics` 类型
   - `TokenSelector` 组件
   - `TokenMetricsTable` 组件
   - `Coins` 图标

2. **动态代币列表：**
   ```typescript
   const symbolOptions = useMemo(() => {
       if (stats?.byToken && stats.byToken.length > 0) {
           return stats.byToken.map((t: TokenMetrics) => t.displaySymbol);
       }
       // Fallback to hardcoded if no data yet
       return ['BTCUSDT', 'ETHUSDT'];
   }, [stats?.byToken, selectedExchange]);
   ```

3. **自动选择最佳代币：**
   ```typescript
   if (data.stats?.byToken && data.stats.byToken.length > 0) {
       const sorted = [...data.stats.byToken].sort((a, b) => b.netPnl - a.netPnl);
       if (sorted[0]) {
           setSelectedSymbol(sorted[0].displaySymbol);
       }
   }
   ```

4. **Overview 视图新增代币表格：**
   - 在 StatsOverview 卡片下方
   - 显示所有代币对比
   - 点击行切换当前选中代币

---

## 文件变更

### 新建文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `components/TokenSelector.tsx` | ~110 | 代币选择器组件 |
| `components/TokenMetricsTable.tsx` | ~170 | 代币统计表格组件 |

### 修改文件

| 文件 | 改动 | 说明 |
|------|------|------|
| `components/Dashboard.tsx` | +50 行 | 集成新组件，动态代币列表 |

---

## 验收检查

- [x] TokenSelector 组件正常显示
- [x] TokenMetricsTable 组件正常显示
- [x] 点击表格行切换代币
- [x] 动态代币列表从 API 获取
- [x] 自动选择盈亏最高的代币

---

## 运行方式

```bash
cd /Users/rekles/.superset/worktrees/TradeVoyage/count
npm run dev
```

访问：http://localhost:3001（如果 3000 端口被占用）

---

## 剩余 TODO

### Phase 2 前端组件（剩余）

| # | 任务 | 优先级 | 预估工时 |
|---|------|--------|---------|
| 2.3 | AdvancedStatsPanel 组件 | P1 | 5h |
| 2.5 | 动态获取代币列表 | ✅ 已完成 | - |
| 2.6 | StatsOverview 显示代币分布 | P1 | 3h |
| 2.7 | PositionSessionList 代币筛选 | P1 | 2h |

### Phase 3 K 线独立页面（可选）

| # | 任务 | 优先级 | 预估工时 |
|---|------|--------|---------|
| 3.1 | K 线页面路由 | P2 | 4h |
| 3.2 | ChartPage 组件 | P2 | 4h |
| 3.3-3.4 | 添加"查看K线"按钮 | P2 | 4h |

### Phase 4 测试与优化

| # | 任务 | 优先级 | 预估工时 |
|---|------|--------|---------|
| 4.1 | 单元测试 | P1 | 6h |
| 4.2 | 集成测试 | P1 | 4h |
| 4.3-4.4 | 性能优化和缓存 | P2 | 8h |
