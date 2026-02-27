# Dashboard 重构计划 - Figma 风格化改造

## Context

将现有 Dashboard 从深色主题改造为 Figma 设计的简洁白色风格，同时保持所有现有功能，并集成 API 连接配置组件。

**Figma 设计参考**: https://www.figma.com/make/UNioyL2en7YVT90LDAXOfE/portfolio-page-design

**用户确认的需求**:
- 交易所支持：支持所有交易所（Binance/BitMEX/OKX/Bybit）
- 数据存储：复用现有 CSV 流程（/api/import/stream）
- MetricsCards：Figma 样式，默认展示 4 个指标
- 布局风格：完全采用 Figma 风格（白色背景、蓝色主题）

---

## 设计风格对比

| 方面 | 现有风格 | Figma 风格 |
|------|---------|-----------|
| 背景 | 深色 (gray-900) | 白色 (gray-50) |
| 卡片 | 玻璃态 (glass class) | 白色 + 阴影 |
| 主题色 | blue-400/500 | blue-600 |
| 视觉层次 | 复杂渐变 | 简洁现代 |

---

## 文件改动清单

### 新增组件

| 文件 | 说明 |
|------|------|
| `/components/ApiConnection.tsx` | API 连接配置面板（交易所选择、凭据输入、日期选择、Fetch 按钮、进度条） |
| `/components/MetricsCards.tsx` | Figma 风格 4 指标卡片（白色背景、圆角阴影） |
| `/components/PerformanceChart.tsx` | Figma 风格权益曲线（Recharts AreaChart、蓝色渐变） |
| `/components/TradesTable.tsx` | Figma 风格交易表格（简洁白色表格） |

### 重构组件

| 文件 | 说明 |
|------|------|
| `/components/Dashboard.tsx` | 主布局重构：白色背景、集成新组件、移除 K 线 |

### 删除/注释组件

| 文件 | 说明 |
|------|------|
| `/components/StatsOverview.tsx` | 被 MetricsCards 替代（保留作为可选详细视图） |
| `/components/EquityCurve.tsx` | 被 PerformanceChart 替代 |
| `/components/TradingViewChart.tsx` | 注释掉，后续移至独立页面 |

---

## 数据流设计

```
ApiConnection 组件
    ├── 用户输入 API 凭据 + 日期范围
    ├── 点击 "Fetch Data"
    ├── POST /api/import/stream (SSE)
    │       ↓
    │   exportBinanceDataWithProgress()
    │       ↓
    │   CSV 文件保存 + SSE 进度更新
    │       ↓
    ├── 进度条显示 (0-100%)
    └── onDataFetched() 回调
            ↓
        Dashboard 数据刷新
            ↓
        GET /api/trades?exchange=xxx
            ↓
        MetricsCards / PerformanceChart / TradesTable 响应更新
```

---

## 实施步骤

### Phase 1: 核心组件开发

#### Step 1.1: 创建 ApiConnection.tsx

**复用代码**:
- `/lib/import_settings.ts` - loadImportConfig, saveImportConfig
- `/app/api/import/stream/route.ts` - SSE 流式导入 API
- `/app/settings/page.tsx` - 日期选择器 UI 参考

**关键功能**:
1. 交易所选择器（4 个交易所）
2. API Key/Secret 输入框（OKX 增加 Passphrase）
3. 日期范围选择器（原生 date input）
4. Save Config 按钮 → localStorage
5. Fetch 按钮 → SSE 连接
6. 进度条 + 日志显示

#### Step 1.2: 重写 MetricsCards.tsx

**Figma 样式**:
```tsx
<div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
  <div className="flex items-start justify-between mb-4">
    <div className="p-3 rounded-lg bg-blue-50">
      <Icon className="w-6 h-6 text-blue-600" />
    </div>
  </div>
  <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
  <p className="text-2xl font-semibold text-gray-900 mb-2">{value}</p>
  <p className="text-sm text-gray-500">{change}</p>
</div>
```

**4 个指标映射**:
1. Total Portfolio Value → `account.wallet.marginBalance`
2. Win Rate → `stats.winRate` + W/L 计数
3. Profit Factor → `stats.profitFactor`
4. Max Drawdown → `stats.maxDrawdown`

#### Step 1.3: 重写 PerformanceChart.tsx

**替换**: lightweight-charts → Recharts AreaChart

**关键配置**:
```tsx
<defs>
  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
  </linearGradient>
</defs>
<Area dataKey="equity" stroke="#3b82f6" fill="url(#colorEquity)" />
```

#### Step 1.4: 重写 TradesTable.tsx

**简化列**:
- Symbol | Type | Quantity | Entry | Exit | Time | P&L | Return | Status

**样式**:
- 白色背景 (bg-white)
- 清晰边框 (border-b border-gray-100)
- Hover 效果 (hover:bg-gray-50)

### Phase 2: Dashboard 集成

#### Step 2.1: 重构 Dashboard.tsx

**布局结构**:
```tsx
<div className="min-h-screen bg-gray-50">
  {/* Header - 白色背景 */}
  <header className="bg-white shadow-sm border-b border-gray-200">
    {/* Logo + Title + Timestamp */}
  </header>

  {/* Main Content */}
  <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div className="space-y-8">
      <ApiConnection onDataFetched={handleDataFetched} />
      <MetricsCards stats={stats} account={account} loading={loading} />
      <PerformanceChart data={equityCurve} loading={loading} />
      <TradesTable trades={trades} loading={loading} />

      {/* 保留的组件（可选） */}
      <TokenSelector />
      <TokenMetricsTable metrics={tokenMetrics} />
      <PositionSessionList sessions={sessions} />
      <AIAnalysis trades={trades} stats={stats} />
    </div>
  </main>
</div>
```

**数据刷新机制**:
```tsx
const [refreshKey, setRefreshKey] = useState(0);

const handleDataFetched = () => {
  setRefreshKey(prev => prev + 1); // 触发 useEffect 重新执行
};

useEffect(() => {
  // 加载数据...
}, [exchange, refreshKey]);
```

**K 线处理**: 注释掉 `<TradingViewChart />`

---

## 关键文件路径

| 文件 | 用途 |
|------|------|
| `/lib/import_settings.ts` | 配置存储逻辑（复用） |
| `/lib/exchange_types.ts` | 交易所类型定义（复用） |
| `/app/api/import/stream/route.ts` | SSE 流式导入 API（复用） |
| `/app/settings/page.tsx` | 日期选择器参考（复用逻辑） |
| `/lib/binance_exporter.ts` | API 拉取逻辑（复用） |

---

## 样式转换规则

```css
/* 深色 → 白色 */
bg-card / bg-gray-900  → bg-white
glass class            → shadow (移除 glass 效果)
text-foreground        → text-gray-900
text-muted-foreground  → text-gray-600
border-border          → border-gray-200

/* 主题色 */
text-blue-400  → text-blue-600
bg-blue-500/10 → bg-blue-50

/* Figma 风格新增 */
rounded-lg shadow hover:shadow-lg
p-6 gap-6 space-y-8
border-b border-gray-100/200
```

---

## 验证计划

### 功能测试
- [ ] Binance API 连接和数据导入
- [ ] BitMEX API 连接和数据导入
- [ ] OKX API 连接和数据导入（含 Passphrase）
- [ ] Bybit API 连接和数据导入
- [ ] 进度条显示正确性
- [ ] 数据刷新正确性

### UI 测试
- [ ] 白色主题一致性
- [ ] 响应式布局（移动端/平板/桌面）
- [ ] 所有组件正确渲染
- [ ] 无样式错乱

---

## 风险与注意事项

1. **数据刷新时机**: ApiConnection Fetch 成功后，使用 `refreshKey` 触发 Dashboard 数据重新加载

2. **样式冲突**: 检查 `app/globals.css` 是否有深色主题硬编码

3. **SSE 连接稳定性**: 添加错误处理和超时逻辑（30 秒）

---

## 预估工时

| Phase | 时间 |
|-------|------|
| Phase 1: 核心组件 | 8-12 小时 |
| Phase 2: Dashboard 集成 | 3-4 小时 |
| 测试与优化 | 4-6 小时 |
| **总计** | **15-22 小时** |
