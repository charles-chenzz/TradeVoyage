# TradeVoyage

![TradeVoyage Banner](public/banner.png)

![Next.js](https://img.shields.io/badge/Next.js-16.0-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss)
![AI Powered](https://img.shields.io/badge/AI_Powered-GPT5%20%7C%20Claude%20%7C%20Gemini-blueviolet)

**TradeVoyage** - Your crypto trading journey analytics platform. Integrates multiple centralized exchanges (CEX), providing visualized charts and detailed statistics to help you understand your trading strategies and position management. Supports **GPT-5.2, Claude Sonnet 4, Gemini 3 Pro** and 21 latest AI models.

[Chinese Version](README.md)

## v2.0 New Features

- **Multi-Exchange Support** - BitMEX, Binance Futures, OKX, Bybit
- **Read-Only API Import** - Securely download your trading data using read-only API
- **AI Trading Analysis** - 21 AI models (GPT-5.2, Claude Sonnet 4, Gemini 3 Pro, etc.)
- **Optimized Position Calculation** - More accurate position open/close logic and PnL calculation
- **Enhanced Chart Display** - Improved K-line chart and trade markers
- **Dark/Light Mode** - Theme switching support
- **New Brand Design** - Modern UI with exchange icons

## Core Features

- **Multi-Timeframe K-Line Charts** - 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w
- **Position History Analysis** - Track every position from open to close
- **PnL Statistics** - Monthly PnL, win rate, profit factor
- **Equity Curve** - Visualize capital changes
- **Trade Markers** - Mark all buy/sell points on charts, jump to historical positions
- **Position Details** - Click any position to view all trade details
- **Online Data Import** - Enter API keys directly on the platform
- **AI Smart Analysis** - Use GPT/Claude/Gemini to analyze trading performance

## Screenshot Preview

![Platform Preview](TradeVoyage.gif)

---

## Quick Start

### Requirements

- Node.js 18+
- npm or yarn

### Installation

1. **Clone the project**
```bash
git clone https://github.com/0x0funky/TradeVoyage
cd TradeVoyage
```

2. **Install dependencies**
```bash
npm install
```

3. **Start development server**
```bash
npm run dev
```

4. **Open browser**

Visit [http://localhost:3000](http://localhost:3000)

---

## Data Import Methods

### Method 1: Import via Platform Interface (Recommended)

1. Click the Settings icon in the top right corner
2. Select exchange (BitMEX, Binance Futures, OKX, or Bybit)
3. Enter Read-Only API Key and API Secret (OKX requires Passphrase)
4. OKX users can select Instrument Type (SWAP, FUTURES, MARGIN, or ALL)
5. Set data date range
6. Click "Test Connection" to verify API
7. Click "Start Import" to automatically fetch and save data

> **Security Note:**
> - Please use **Read-Only** permission API Key
> - API keys are only used for fetching data, not stored or sent to third parties
> - Data is stored in local project directory

### Method 2: Use Demo Data

**paulwei trader demo data** (CSV files, place in root directory)

[Download Link (Google Drive)](https://drive.google.com/file/d/11i_nJ90QpgP6Lnwalucapcsd2NbuC9co/view?usp=sharing)

After downloading, extract and place CSV files in the project root directory.

### Method 3: Manual Data Files

#### Trading Data (Root Directory)

**BitMEX:**
```
TradeVoyage/
├── bitmex_executions.csv      # Execution records (required)
├── bitmex_trades.csv          # Trade records
├── bitmex_orders.csv          # Order history
├── bitmex_wallet_history.csv  # Wallet history (funding, deposits/withdrawals)
└── bitmex_account_summary.json # Account summary
```

**Binance Futures:**
```
TradeVoyage/
├── binance_executions.csv      # Execution records (required)
├── binance_wallet_history.csv  # Income history (PnL, funding)
└── binance_account_summary.json # Account summary
```

**OKX:**
```
TradeVoyage/
├── okx_executions.csv          # Execution records (required)
├── okx_positions_history.csv   # Closed position history
├── okx_wallet_history.csv      # Fund changes (Funding, PnL)
└── okx_account_summary.json    # Account summary
```

**Bybit:**
```
TradeVoyage/
├── bybit_executions.csv        # Execution records (required)
├── bybit_closed_pnl.csv        # Closed PnL records (accurate position calculation)
├── bybit_wallet_history.csv    # Fund changes
└── bybit_account_summary.json  # Account summary
```

---

## API Key Setup Guide

### BitMEX

1. Go to [BitMEX API Keys](https://www.bitmex.com/app/apiKeys)
2. Click "Create API Key"
3. Permissions:
   - [x] **Read** - Required
   - [ ] Order - Not needed
   - [ ] Withdraw - Not needed
4. Copy API Key and Secret

### Binance Futures

1. Go to [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Click "Create API"
3. Select "System generated"
4. Complete security verification
5. Permissions:
   - [x] **Enable Reading** - Required
   - [x] **Enable Futures** - Required
   - [ ] Enable Spot & Margin Trading - Not needed
   - [ ] Enable Withdrawals - Not needed
6. Copy API Key and Secret Key

### OKX

1. Go to [OKX API Management](https://www.okx.com/account/my-api)
2. Click "Create V5 API Key"
3. Set Passphrase (required for import)
4. Permissions:
   - [x] **Read** - Required
   - [ ] Trade - Not needed
   - [ ] Withdraw - Not needed
5. Select Instrument Type:
   - **SWAP** - Perpetual contracts (default)
   - **FUTURES** - Delivery contracts
   - **MARGIN** - Margin trading
   - **ALL** - Query all types
6. Copy API Key, Secret Key, and Passphrase

### Bybit

1. Go to [Bybit API Management](https://www.bybit.com/app/user/api-management)
2. Click "Create New Key"
3. Select "API Transaction"
4. Permissions:
   - [x] **Read-Only** - Required
   - [ ] Contract - Trade - Not needed
   - [ ] Withdraw - Not needed
5. Copy API Key and Secret Key

> **Note:** Bybit API only supports querying the last 2 years of trading data, with a maximum of 7 days per request (system will automatically batch process).

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React full-stack framework |
| **React 19** | UI framework |
| **TypeScript** | Type safety |
| **Tailwind CSS 4** | Styling framework |
| **Lightweight Charts** | K-line charts |
| **Lucide React** | Icons |

---

## Project Structure

```
TradeVoyage/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── trades/       # Trade data API
│   │   └── import/       # Data import API
│   ├── settings/         # Settings page (data import)
│   ├── page.tsx          # Main page
│   └── layout.tsx        # Root layout
├── components/            # React components
│   ├── Dashboard.tsx     # Main dashboard
│   ├── TradingViewChart.tsx   # K-line chart (Binance API)
│   ├── PositionSessionList.tsx  # Position list
│   ├── PositionDetail.tsx       # Position details
│   ├── StatsOverview.tsx        # Stats overview
│   ├── MonthlyPnLChart.tsx      # Monthly PnL
│   ├── EquityCurve.tsx          # Equity curve
│   └── ThemeProvider.tsx        # Theme switching
├── lib/                   # Utilities
│   ├── types.ts          # TypeScript type definitions
│   ├── exchange_types.ts # Exchange type definitions
│   ├── data_loader.ts    # Data loader (multi-exchange support)
│   ├── bitmex_exporter.ts   # BitMEX data export
│   ├── binance_exporter.ts  # Binance data export
│   ├── okx_exporter.ts      # OKX data export
│   └── bybit_exporter.ts    # Bybit data export
├── scripts/               # Data fetch scripts
│   └── export_all_data.js
└── *.csv / *.json        # Trading data files
```

---

## Development Commands

```bash
# Development mode
npm run dev

# Build production
npm run build

# Start production server
npm run start

# Linting
npm run lint
```

---

## Roadmap

- [x] ~~Bybit exchange integration~~ - Done!
- [x] ~~OKX exchange integration~~ - Done!
- [x] ~~AI trading analysis~~ - Done!
- [ ] Multi-account management
- [ ] More statistics

---

## AI Trading Analysis

TradeVoyage integrates multiple AI models for intelligent trading performance analysis and improvement suggestions:

### Supported AI Models (21 Total)

#### OpenAI (9 Models)
| Model | API Name | Features |
|-------|----------|----------|
| **GPT-5.2** | `gpt-5.2` | Latest and most powerful - Best for code and agentic tasks |
| GPT-5.1 | `gpt-5.1` | Balance of speed and intelligence |
| GPT-5 | `gpt-5` | 5th generation flagship - Powerful multimodal |
| GPT-4o | `gpt-4o` | Classic - Stable and reliable |
| GPT-4o Mini | `gpt-4o-mini` | Fast and economical |
| GPT-4 Turbo | `gpt-4-turbo` | 128K context |
| o3 Mini | `o3-mini` | Reasoning model - High performance |
| o1 | `o1` | Reasoning model - Complex problems |
| o1 Mini | `o1-mini` | Fast reasoning |

#### Anthropic Claude (5 Models)
| Model | API Name | Features |
|-------|----------|----------|
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | Latest - Balance of performance and cost |
| Claude Opus 4 | `claude-opus-4-20250514` | Most powerful - Complex tasks |
| Claude 3.5 Sonnet | `claude-3-5-sonnet-20241022` | Classic - Stable and reliable |
| Claude 3.5 Haiku | `claude-3-5-haiku-20241022` | Fastest - Instant response |
| Claude 3 Opus | `claude-3-opus-20240229` | Legacy flagship |

#### Google Gemini (7 Models)
| Model | API Name | Features |
|-------|----------|----------|
| **Gemini 3 Pro** | `gemini-3-pro` | Latest - High precision multimodal reasoning |
| Gemini 2.5 Pro | `gemini-2.5-pro` | Professional - Deep thinking |
| Gemini 2.5 Flash | `gemini-2.5-flash` | Best value - Adaptive thinking |
| Gemini 2.0 Flash | `gemini-2.0-flash` | 2x speed improvement |
| Gemini 2.0 Flash Lite | `gemini-2.0-flash-lite` | Ultra low latency |
| Gemini 1.5 Pro | `gemini-1.5-pro` | 1M tokens |
| Gemini 1.5 Flash | `gemini-1.5-flash` | Classic fast version |

### Setup

1. Go to **Settings > AI Settings**
2. Enter your AI Provider API Key
3. (Optional) Customize System Prompt
4. Click "Save Settings"

### Usage

1. Click **AI Analysis** tab on Dashboard
2. Select AI Provider and Model
3. Click "Analyze My Trades"
4. AI will analyze:
   - Overall statistics (win rate, profit factor, etc.)
   - Recent 20 positions
   - Monthly PnL trends
5. Get detailed analysis report and improvement suggestions

### Features

- **Comprehensive Analysis** - Analyzes win rate, profit factor, holding time, etc.
- **Local Storage** - Analysis results are automatically saved
- **Secure** - API Keys are only stored in your browser
- **Multi-Exchange** - Separate analysis results for each exchange

---

## License

MIT License

---

## Acknowledgments

Thanks to paulwei trader for providing Read-Only API, enabling this learning platform to continuously improve.

**Disclaimer: This platform is for learning and research purposes only, and does not constitute investment advice. Cryptocurrency trading involves high risk, please invest carefully.**
