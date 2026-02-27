// SERVER-SIDE ONLY - Do not import this file in client components
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import {
    Trade,
    Execution,
    Order,
    WalletTransaction,
    AccountSummary,
    TradingStats,
    PositionSession,
    TokenMetrics,
    AdvancedStats,
    formatSymbol
} from './types';
import { ExchangeType, toInternalSymbol } from './exchange_types';

// Re-export types and utilities for convenience
export * from './types';

// ============ Exchange File Prefixes ============

function getFilePrefix(exchange: ExchangeType): string {
    if (exchange === 'binance') return 'binance_';
    if (exchange === 'okx') return 'okx_';
    if (exchange === 'bybit') return 'bybit_';
    return 'bitmex_';
}

// ============ Cache (per exchange) ============

const cacheStore: Record<ExchangeType, {
    executions: Execution[] | null;
    trades: Trade[] | null;
    orders: Order[] | null;
    wallet: WalletTransaction[] | null;
    accountSummary: AccountSummary | null;
    sessions: PositionSession[] | null;
}> = {
    bitmex: {
        executions: null,
        trades: null,
        orders: null,
        wallet: null,
        accountSummary: null,
        sessions: null,
    },
    binance: {
        executions: null,
        trades: null,
        orders: null,
        wallet: null,
        accountSummary: null,
        sessions: null,
    },
    okx: {
        executions: null,
        trades: null,
        orders: null,
        wallet: null,
        accountSummary: null,
        sessions: null,
    },
    bybit: {
        executions: null,
        trades: null,
        orders: null,
        wallet: null,
        accountSummary: null,
        sessions: null,
    },
};

export function resetExchangeCache(exchange?: ExchangeType): void {
    const reset = (ex: ExchangeType) => {
        cacheStore[ex].executions = null;
        cacheStore[ex].trades = null;
        cacheStore[ex].orders = null;
        cacheStore[ex].wallet = null;
        cacheStore[ex].accountSummary = null;
        cacheStore[ex].sessions = null;
    };

    if (exchange) {
        reset(exchange);
        return;
    }

    (Object.keys(cacheStore) as ExchangeType[]).forEach(reset);
}

// ============ Clear Cache ============

export function clearCache(exchange?: ExchangeType) {
    const exchanges: ExchangeType[] = exchange ? [exchange] : ['bitmex', 'binance', 'okx', 'bybit'];
    for (const ex of exchanges) {
        cacheStore[ex] = {
            executions: null,
            trades: null,
            orders: null,
            wallet: null,
            accountSummary: null,
            sessions: null,
        };
    }
}

// ============ Check if exchange data exists ============

export function hasExchangeData(exchange: ExchangeType): boolean {
    const prefix = getFilePrefix(exchange);
    const csvPath = path.join(process.cwd(), `${prefix}executions.csv`);
    return fs.existsSync(csvPath);
}

// ============ Loaders ============

export function loadExecutionsFromCSV(exchange: ExchangeType = 'bitmex'): Execution[] {
    if (cacheStore[exchange].executions) return cacheStore[exchange].executions!;

    const prefix = getFilePrefix(exchange);
    const csvPath = path.join(process.cwd(), `${prefix}executions.csv`);
    if (!fs.existsSync(csvPath)) {
        console.warn(`${prefix}executions.csv not found`);
        return [];
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true, relax_quotes: true });

    cacheStore[exchange].executions = records.map((record: any) => ({
        execID: record.execID,
        orderID: record.orderID || '',
        symbol: record.symbol,
        displaySymbol: formatSymbol(record.symbol),
        side: record.side as 'Buy' | 'Sell',
        lastQty: parseFloat(record.lastQty) || 0,
        lastPx: parseFloat(record.lastPx) || 0,
        execType: record.execType,
        ordType: record.ordType,
        ordStatus: record.ordStatus,
        execCost: parseFloat(record.execCost) || 0,
        execComm: parseFloat(record.execComm) || 0,
        timestamp: record.timestamp,
        text: record.text || '',
    }));

    return cacheStore[exchange].executions!;
}

// Load trades aggregated by OrderID (combine partial fills into single trades)
export function loadTradesFromCSV(exchange: ExchangeType = 'bitmex'): Trade[] {
    if (cacheStore[exchange].trades) return cacheStore[exchange].trades!;

    const executions = loadExecutionsFromCSV(exchange);

    // Filter only actual trades
    const tradeExecutions = executions.filter(e =>
        e.execType === 'Trade' && e.side && e.lastQty > 0 && e.orderID
    );

    // Group by OrderID
    const orderGroups = new Map<string, Execution[]>();
    tradeExecutions.forEach(e => {
        const key = e.orderID;
        if (!orderGroups.has(key)) {
            orderGroups.set(key, []);
        }
        orderGroups.get(key)!.push(e);
    });

    // Aggregate each order's executions into a single trade
    cacheStore[exchange].trades = Array.from(orderGroups.entries()).map(([orderID, execs]) => {
        // Sort by timestamp to get the first execution time
        execs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const firstExec = execs[0];
        const totalQty = execs.reduce((sum, e) => sum + e.lastQty, 0);
        const totalCost = execs.reduce((sum, e) => sum + Math.abs(e.execCost), 0);
        const totalFee = execs.reduce((sum, e) => sum + e.execComm, 0);

        // Weighted average price
        const weightedPriceSum = execs.reduce((sum, e) => sum + (e.lastPx * e.lastQty), 0);
        const avgPrice = totalQty > 0 ? weightedPriceSum / totalQty : firstExec.lastPx;

        // Determine fee currency based on exchange
        const feeCurrency = (exchange === 'binance' || exchange === 'okx') ? 'USDT' : 'XBT';

        return {
            id: orderID, // Use orderID as the trade ID
            datetime: firstExec.timestamp,
            symbol: firstExec.symbol,
            displaySymbol: firstExec.displaySymbol,
            side: firstExec.side.toLowerCase() as 'buy' | 'sell',
            price: avgPrice,
            amount: totalQty,
            cost: totalCost,
            fee: {
                cost: totalFee,
                currency: feeCurrency,
            },
            orderID: orderID,
            execType: firstExec.execType,
            executionCount: execs.length, // Track how many fills this order had
        };
    });

    // Sort by datetime
    cacheStore[exchange].trades!.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    return cacheStore[exchange].trades!;
}

export function loadOrdersFromCSV(exchange: ExchangeType = 'bitmex'): Order[] {
    if (cacheStore[exchange].orders) return cacheStore[exchange].orders!;

    const prefix = getFilePrefix(exchange);
    const csvPath = path.join(process.cwd(), `${prefix}orders.csv`);
    if (!fs.existsSync(csvPath)) {
        console.warn(`${prefix}orders.csv not found`);
        return [];
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true, relax_quotes: true });

    cacheStore[exchange].orders = records.map((record: any) => ({
        orderID: record.orderID,
        symbol: record.symbol,
        displaySymbol: formatSymbol(record.symbol),
        side: record.side as 'Buy' | 'Sell',
        ordType: record.ordType as Order['ordType'],
        orderQty: parseFloat(record.orderQty) || 0,
        price: record.price ? parseFloat(record.price) : null,
        stopPx: record.stopPx ? parseFloat(record.stopPx) : null,
        avgPx: record.avgPx ? parseFloat(record.avgPx) : null,
        cumQty: parseFloat(record.cumQty) || 0,
        ordStatus: record.ordStatus as Order['ordStatus'],
        timestamp: record.timestamp,
        text: record.text,
    }));

    return cacheStore[exchange].orders!;
}

export function loadWalletHistoryFromCSV(exchange: ExchangeType = 'bitmex'): WalletTransaction[] {
    if (cacheStore[exchange].wallet) return cacheStore[exchange].wallet!;

    const prefix = getFilePrefix(exchange);
    const csvPath = path.join(process.cwd(), `${prefix}wallet_history.csv`);
    if (!fs.existsSync(csvPath)) {
        console.warn(`${prefix}wallet_history.csv not found`);
        return [];
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true, relax_quotes: true });

    cacheStore[exchange].wallet = records.map((record: any) => ({
        transactID: record.transactID,
        account: parseInt(record.account) || record.account,
        currency: record.currency,
        transactType: record.transactType as WalletTransaction['transactType'],
        amount: parseFloat(record.amount) || 0,
        fee: parseFloat(record.fee) || 0,
        transactStatus: record.transactStatus,
        address: record.address || '',
        tx: record.tx || '',
        text: record.text || '',
        timestamp: record.timestamp,
        walletBalance: parseFloat(record.walletBalance) || 0,
        marginBalance: record.marginBalance ? parseFloat(record.marginBalance) : null,
    }));

    return cacheStore[exchange].wallet!;
}

export function loadAccountSummary(exchange: ExchangeType = 'bitmex'): AccountSummary | null {
    if (cacheStore[exchange].accountSummary) return cacheStore[exchange].accountSummary;

    const prefix = getFilePrefix(exchange);
    const jsonPath = path.join(process.cwd(), `${prefix}account_summary.json`);
    if (!fs.existsSync(jsonPath)) {
        console.warn(`${prefix}account_summary.json not found`);
        return null;
    }

    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(fileContent);

    cacheStore[exchange].accountSummary = {
        ...data,
        positions: data.positions.map((p: any) => ({
            ...p,
            displaySymbol: formatSymbol(p.symbol),
        })),
    };

    return cacheStore[exchange].accountSummary;
}

// ============ Bybit Closed PnL Loader ============

interface BybitClosedPnlRecord {
    symbol: string;
    side: 'Buy' | 'Sell';  // Buy = Long position, Sell = Short position
    qty: number;
    orderPrice: number;
    avgEntryPrice: number;
    avgExitPrice: number;
    closedPnl: number;
    cumEntryValue: number;
    cumExitValue: number;
    orderId: string;
    createdTime: string;
    updatedTime: string;
}

function loadBybitClosedPnl(): BybitClosedPnlRecord[] {
    const csvPath = path.join(process.cwd(), 'bybit_closed_pnl.csv');
    if (!fs.existsSync(csvPath)) {
        console.warn('bybit_closed_pnl.csv not found');
        return [];
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, { columns: true, skip_empty_lines: true, relax_quotes: true });

    return records.map((record: any) => ({
        symbol: record.symbol,
        side: record.side as 'Buy' | 'Sell',
        qty: parseFloat(record.qty) || 0,
        orderPrice: parseFloat(record.orderPrice) || 0,
        avgEntryPrice: parseFloat(record.avgEntryPrice) || 0,
        avgExitPrice: parseFloat(record.avgExitPrice) || 0,
        closedPnl: parseFloat(record.closedPnl) || 0,
        cumEntryValue: parseFloat(record.cumEntryValue) || 0,
        cumExitValue: parseFloat(record.cumExitValue) || 0,
        orderId: record.orderId,
        createdTime: record.createdTime,
        updatedTime: record.updatedTime,
    }));
}

// Convert Bybit Closed PnL records to PositionSessions
// Combines closed PnL data with executions to get complete position info
function convertBybitClosedPnlToSessions(records: BybitClosedPnlRecord[]): PositionSession[] {
    // Load executions to find open times and individual trades
    const executions = loadExecutionsFromCSV('bybit');

    // Sort closed PnL by close time
    const sorted = [...records].sort((a, b) =>
        new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime()
    );

    // Group executions by orderId for quick lookup
    const execsByOrderId = new Map<string, Execution[]>();
    executions.forEach(exec => {
        const key = exec.orderID;
        if (!execsByOrderId.has(key)) {
            execsByOrderId.set(key, []);
        }
        execsByOrderId.get(key)!.push(exec);
    });

    // Group executions by symbol and side for finding open trades
    const execsBySymbolSide = new Map<string, Execution[]>();
    executions.forEach(exec => {
        const key = `${exec.symbol}-${exec.side}`;
        if (!execsBySymbolSide.has(key)) {
            execsBySymbolSide.set(key, []);
        }
        execsBySymbolSide.get(key)!.push(exec);
    });

    return sorted.map((rec, idx) => {
        // In Bybit closed PnL: 
        // - Sell = closing a Long position (you sell to close long)
        // - Buy = closing a Short position (you buy to close short)
        const positionSide = rec.side === 'Sell' ? 'long' : 'short';

        // The close order side matches the closed PnL 'side' field
        // Open order side is the opposite
        const closeOrderSide = rec.side;  // Sell for Long, Buy for Short
        const openOrderSide = rec.side === 'Sell' ? 'Buy' : 'Sell';

        // Find the close trade executions (matching orderId from closed PnL)
        const closeExecs = execsByOrderId.get(rec.orderId) || [];
        const closeTime = new Date(rec.createdTime).getTime();

        // Find open trades for this specific position
        // Strategy: Look for open trades with same symbol, opposite side, before close time
        // Use avgEntryPrice to help identify matching open trades
        const symbolOpenExecs = execsBySymbolSide.get(`${rec.symbol}-${openOrderSide}`) || [];

        // Find open trades that are:
        // 1. Before close time
        // 2. Close to the avgEntryPrice (within 1% tolerance for the same position)
        const priceTolerance = rec.avgEntryPrice * 0.01;
        let matchingOpenExecs = symbolOpenExecs
            .filter(e => {
                const execTime = new Date(e.timestamp).getTime();
                const priceMatch = Math.abs(e.lastPx - rec.avgEntryPrice) <= priceTolerance;
                return execTime < closeTime && priceMatch;
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // Most recent first

        // If no price match found, fallback to finding most recent open before close
        if (matchingOpenExecs.length === 0) {
            matchingOpenExecs = symbolOpenExecs
                .filter(e => new Date(e.timestamp).getTime() < closeTime)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }

        // Find the open trade that matches this position's qty
        // The open should have similar cumulative quantity
        let openTime = '';
        let openExecsForPosition: Execution[] = [];
        let accumulatedQty = 0;

        for (const exec of matchingOpenExecs) {
            if (accumulatedQty >= rec.qty) break;
            openExecsForPosition.push(exec);
            accumulatedQty += exec.lastQty;
        }

        // Get open time from the earliest matching execution
        if (openExecsForPosition.length > 0) {
            openExecsForPosition.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            openTime = openExecsForPosition[0].timestamp;
        }

        // Calculate fees from executions if available, otherwise estimate
        let totalFees = 0;
        const allRelatedExecs = [...closeExecs, ...openExecsForPosition];
        totalFees = allRelatedExecs.reduce((sum, e) => sum + (e.execComm / 100000000), 0);

        // Fallback: estimate from closed PnL
        if (totalFees === 0) {
            const grossPnl = rec.cumExitValue - rec.cumEntryValue;
            totalFees = Math.abs(grossPnl - rec.closedPnl);
        }

        // Calculate duration
        const openTimeMs = openTime ? new Date(openTime).getTime() : 0;
        const closeTimeMs = closeTime;
        const durationMs = openTimeMs > 0 ? closeTimeMs - openTimeMs : 0;

        // Convert executions to Trade format
        const trades: Trade[] = closeExecs.map(e => ({
            id: e.execID,
            datetime: e.timestamp,
            symbol: e.symbol,
            displaySymbol: formatSymbol(e.symbol),
            side: e.side.toLowerCase() as 'buy' | 'sell',
            price: e.lastPx,
            amount: e.lastQty,
            cost: e.execCost / 100000000,
            fee: { cost: e.execComm / 100000000, currency: 'USDT' },
            orderID: e.orderID,
            execType: e.execType,
        }));

        return {
            id: rec.orderId || `bybit-session-${idx}`,
            symbol: rec.symbol,
            displaySymbol: formatSymbol(rec.symbol),
            side: positionSide,
            openTime: openTime,
            closeTime: rec.createdTime,
            durationMs: durationMs,
            maxSize: rec.qty,
            totalBought: positionSide === 'long' ? rec.qty : 0,
            totalSold: positionSide === 'short' ? rec.qty : 0,
            avgEntryPrice: rec.avgEntryPrice,
            avgExitPrice: rec.avgExitPrice,
            realizedPnl: rec.closedPnl,
            totalFees: totalFees,
            netPnl: rec.closedPnl,
            tradeCount: closeExecs.length || 1,
            trades: trades,
            status: 'closed' as const,
        };
    });
}

// ============ Position Session Calculator (Server-side) ============

import { calculatePositionSessionsFromExecutions } from './position_calculator';

export function getPositionSessions(exchange: ExchangeType = 'bitmex'): PositionSession[] {
    if (cacheStore[exchange].sessions) return cacheStore[exchange].sessions!;

    // For Bybit, prefer using closed PnL data for more accurate position tracking
    if (exchange === 'bybit') {
        const closedPnlRecords = loadBybitClosedPnl();
        if (closedPnlRecords.length > 0) {
            cacheStore[exchange].sessions = convertBybitClosedPnlToSessions(closedPnlRecords);
            console.log(`[bybit] Loaded ${cacheStore[exchange].sessions!.length} position sessions from closed PnL records`);
            return cacheStore[exchange].sessions!;
        }
    }

    // Fallback: Use executions for position tracking
    const executions = loadExecutionsFromCSV(exchange);
    cacheStore[exchange].sessions = calculatePositionSessionsFromExecutions(executions, exchange);

    console.log(`[${exchange}] Calculated ${cacheStore[exchange].sessions!.length} position sessions from ${executions.length} executions`);

    return cacheStore[exchange].sessions!;
}

// ============ Token Discovery ============

export interface TradedTokenInfo {
    symbol: string;
    displaySymbol: string;
    totalSessions: number;
    totalPnl: number;
    firstTrade: string;
    lastTrade: string;
}

export function getAllTradedSymbols(exchange: ExchangeType = 'bitmex'): string[] {
    const executions = loadExecutionsFromCSV(exchange);
    const symbolSet = new Set<string>();
    
    executions.forEach(exec => {
        if (exec.execType === 'Trade' && exec.lastQty > 0) {
            symbolSet.add(exec.symbol);
        }
    });
    
    return Array.from(symbolSet).sort();
}

export function getTradedTokensInfo(exchange: ExchangeType = 'bitmex'): TradedTokenInfo[] {
    const sessions = getPositionSessions(exchange);
    const tokenMap = new Map<string, {
        sessions: PositionSession[];
        totalPnl: number;
        firstTrade: string;
        lastTrade: string;
    }>();
    
    sessions.forEach(session => {
        const symbol = session.symbol;
        if (!tokenMap.has(symbol)) {
            tokenMap.set(symbol, {
                sessions: [],
                totalPnl: 0,
                firstTrade: session.openTime,
                lastTrade: session.closeTime || session.openTime,
            });
        }
        
        const info = tokenMap.get(symbol)!;
        info.sessions.push(session);
        info.totalPnl += session.netPnl;
        
        if (session.openTime < info.firstTrade) {
            info.firstTrade = session.openTime;
        }
        if ((session.closeTime || session.openTime) > info.lastTrade) {
            info.lastTrade = session.closeTime || session.openTime;
        }
    });
    
    return Array.from(tokenMap.entries())
        .map(([symbol, info]) => ({
            symbol,
            displaySymbol: formatSymbol(symbol),
            totalSessions: info.sessions.length,
            totalPnl: info.totalPnl,
            firstTrade: info.firstTrade.split('T')[0],
            lastTrade: info.lastTrade.split('T')[0],
        }))
        .sort((a, b) => b.totalPnl - a.totalPnl);
}

// ============ Token Metrics Calculation ============

function calculateTokenMetrics(
    symbol: string,
    sessions: PositionSession[],
    exchange: ExchangeType
): TokenMetrics {
    const symbolSessions = sessions.filter(s => s.symbol === symbol);
    const closedSessions = symbolSessions.filter(s => s.status === 'closed' && s.closeTime);
    
    const winningSessions = closedSessions.filter(s => s.netPnl > 0);
    const losingSessions = closedSessions.filter(s => s.netPnl < 0);
    
    const grossProfit = winningSessions.reduce((sum, s) => sum + s.netPnl, 0);
    const grossLoss = losingSessions.reduce((sum, s) => sum + s.netPnl, 0);
    const netPnl = grossProfit + grossLoss;
    
    const totalFees = symbolSessions.reduce((sum, s) => sum + s.totalFees, 0);
    
    const winRate = closedSessions.length > 0 
        ? (winningSessions.length / closedSessions.length) * 100 
        : 0;
    
    const longSessions = closedSessions.filter(s => s.side === 'long');
    const shortSessions = closedSessions.filter(s => s.side === 'short');
    const longPnl = longSessions.reduce((sum, s) => sum + s.netPnl, 0);
    const shortPnl = shortSessions.reduce((sum, s) => sum + s.netPnl, 0);
    const longWinRate = longSessions.length > 0 
        ? (longSessions.filter(s => s.netPnl > 0).length / longSessions.length) * 100 
        : 0;
    const shortWinRate = shortSessions.length > 0 
        ? (shortSessions.filter(s => s.netPnl > 0).length / shortSessions.length) * 100 
        : 0;
    
    const avgHoldingTimeMs = closedSessions.length > 0
        ? closedSessions.reduce((sum, s) => sum + s.durationMs, 0) / closedSessions.length
        : 0;
    const avgHoldingTimeHours = avgHoldingTimeMs / (1000 * 60 * 60);
    
    const sortedByPnl = [...closedSessions].sort((a, b) => b.netPnl - a.netPnl);
    const bestSession = sortedByPnl[0];
    const worstSession = sortedByPnl[sortedByPnl.length - 1];
    
    const sortedByTime = [...closedSessions].sort((a, b) => 
        new Date(a.closeTime!).getTime() - new Date(b.closeTime!).getTime()
    );
    const firstTradeDate = sortedByTime[0]?.closeTime?.split('T')[0] || '';
    const lastTradeDate = sortedByTime[sortedByTime.length - 1]?.closeTime?.split('T')[0] || '';
    
    const tradeDates = new Set(closedSessions.map(s => s.closeTime?.split('T')[0]));
    const tradingDays = tradeDates.size;
    const avgDailyTrades = tradingDays > 0 ? closedSessions.length / tradingDays : 0;
    
    const hourCounts = new Map<number, number>();
    const dayCounts = new Map<string, number>();
    closedSessions.forEach(s => {
        if (s.closeTime) {
            const date = new Date(s.closeTime);
            const hour = date.getUTCHours();
            const day = date.toLocaleDateString('en-US', { weekday: 'long' });
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
            dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
        }
    });
    const mostActiveHour = Array.from(hourCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    const mostActiveDay = Array.from(dayCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    
    const firstHalf = sortedByTime.slice(0, Math.floor(sortedByTime.length / 2));
    const secondHalf = sortedByTime.slice(Math.floor(sortedByTime.length / 2));
    const firstHalfPnl = firstHalf.reduce((sum, s) => sum + s.netPnl, 0);
    const secondHalfPnl = secondHalf.reduce((sum, s) => sum + s.netPnl, 0);
    let pnlTrend: 'up' | 'down' | 'neutral' = 'neutral';
    if (secondHalfPnl > firstHalfPnl * 1.1) pnlTrend = 'up';
    else if (secondHalfPnl < firstHalfPnl * 0.9) pnlTrend = 'down';
    
    const volumeTrend: 'up' | 'down' | 'neutral' = 'neutral';
    
    let cumulativePnl = 0;
    let peak = 0;
    let maxDrawdown = 0;
    sortedByTime.forEach(s => {
        cumulativePnl += s.netPnl;
        if (cumulativePnl > peak) peak = cumulativePnl;
        const drawdown = peak - cumulativePnl;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
    const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
    
    const dailyPnl = new Map<string, number>();
    closedSessions.forEach(s => {
        if (s.closeTime) {
            const date = s.closeTime.split('T')[0];
            dailyPnl.set(date, (dailyPnl.get(date) || 0) + s.netPnl);
        }
    });
    const dailyReturns = Array.from(dailyPnl.values());
    const avgReturn = dailyReturns.length > 0 
        ? dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length 
        : 0;
    const variance = dailyReturns.length > 1 
        ? dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (dailyReturns.length - 1)
        : 0;
    const volatility = Math.sqrt(variance) * Math.sqrt(365);
    
    const sharpeRatio = volatility > 0 ? (avgReturn * 365) / volatility : 0;
    
    const negativeReturns = dailyReturns.filter(r => r < 0);
    const downVariance = negativeReturns.length > 1 
        ? negativeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (negativeReturns.length - 1)
        : 0;
    const downVolatility = Math.sqrt(downVariance) * Math.sqrt(365);
    const sortinoRatio = downVolatility > 0 ? (avgReturn * 365) / downVolatility : 0;
    
    return {
        symbol,
        displaySymbol: formatSymbol(symbol),
        totalSessions: closedSessions.length,
        winningSessions: winningSessions.length,
        losingSessions: losingSessions.length,
        winRate: Math.round(winRate * 100) / 100,
        grossProfit,
        grossLoss,
        netPnl,
        totalFunding: 0,
        totalFees,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        sortinoRatio: Math.round(sortinoRatio * 100) / 100,
        maxDrawdown,
        maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
        volatility: Math.round(volatility * 100) / 100,
        avgHoldingTimeHours: Math.round(avgHoldingTimeHours * 100) / 100,
        bestSession: bestSession ? {
            pnl: bestSession.netPnl,
            duration: bestSession.durationMs,
            date: bestSession.closeTime?.split('T')[0] || '',
        } : { pnl: 0, duration: 0, date: '' },
        worstSession: worstSession ? {
            pnl: worstSession.netPnl,
            duration: worstSession.durationMs,
            date: worstSession.closeTime?.split('T')[0] || '',
        } : { pnl: 0, duration: 0, date: '' },
        longSessions: longSessions.length,
        shortSessions: shortSessions.length,
        longPnl,
        shortPnl,
        longWinRate: Math.round(longWinRate * 100) / 100,
        shortWinRate: Math.round(shortWinRate * 100) / 100,
        avgDailyTrades: Math.round(avgDailyTrades * 100) / 100,
        mostActiveHour,
        mostActiveDay,
        firstTradeDate,
        lastTradeDate,
        pnlTrend,
        volumeTrend,
    };
}

function calculateAdvancedStats(
    tokenMetrics: TokenMetrics[],
    sessions: PositionSession[]
): AdvancedStats {
    const closedSessions = sessions.filter(s => s.status === 'closed' && s.closeTime);
    
    const totalTokens = tokenMetrics.length;
    const profitableTokens = tokenMetrics.filter(t => t.netPnl > 0).length;
    const unprofitableTokens = tokenMetrics.filter(t => t.netPnl < 0).length;
    
    const sortedByPnl = [...tokenMetrics].sort((a, b) => b.netPnl - a.netPnl);
    const topTokenPnl = sortedByPnl[0]?.netPnl || 0;
    const totalPnl = tokenMetrics.reduce((sum, t) => sum + t.netPnl, 0);
    const topTokenConcentration = totalPnl !== 0 ? Math.abs(topTokenPnl / totalPnl) : 0;
    
    let tokenConcentrationRisk: 'low' | 'medium' | 'high' = 'low';
    if (topTokenConcentration > 0.7) tokenConcentrationRisk = 'high';
    else if (topTokenConcentration > 0.4) tokenConcentrationRisk = 'medium';
    
    const tradeDates = new Set(closedSessions.map(s => s.closeTime?.split('T')[0]));
    const totalTradingDays = tradeDates.size;
    
    const dailyPnl = new Map<string, number>();
    closedSessions.forEach(s => {
        if (s.closeTime) {
            const date = s.closeTime.split('T')[0];
            dailyPnl.set(date, (dailyPnl.get(date) || 0) + s.netPnl);
        }
    });
    const profitableDays = Array.from(dailyPnl.values()).filter(pnl => pnl > 0).length;
    const avgDailyPnl = dailyPnl.size > 0 
        ? Array.from(dailyPnl.values()).reduce((sum, pnl) => sum + pnl, 0) / dailyPnl.size 
        : 0;
    
    const avgDailyVolume = 0;
    
    const portfolioSharpe = tokenMetrics.length > 0 
        ? tokenMetrics.reduce((sum, t) => sum + t.sharpeRatio, 0) / tokenMetrics.length 
        : 0;
    const portfolioSortino = tokenMetrics.length > 0 
        ? tokenMetrics.reduce((sum, t) => sum + t.sortinoRatio, 0) / tokenMetrics.length 
        : 0;
    
    let cumulativePnl = 0;
    let peak = 0;
    let maxDrawdown = 0;
    const sortedSessions = [...closedSessions].sort((a, b) => 
        new Date(a.closeTime!).getTime() - new Date(b.closeTime!).getTime()
    );
    sortedSessions.forEach(s => {
        cumulativePnl += s.netPnl;
        if (cumulativePnl > peak) peak = cumulativePnl;
        const drawdown = peak - cumulativePnl;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
    const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
    
    const calmarRatio = maxDrawdownPercent > 0 
        ? ((totalPnl / totalTradingDays) * 365) / maxDrawdownPercent 
        : 0;
    
    const winningSessions = closedSessions.filter(s => s.netPnl > 0);
    const losingSessions = closedSessions.filter(s => s.netPnl < 0);
    const winRate = closedSessions.length > 0 ? winningSessions.length / closedSessions.length : 0;
    const avgWin = winningSessions.length > 0 
        ? winningSessions.reduce((sum, s) => sum + s.netPnl, 0) / winningSessions.length 
        : 0;
    const avgLoss = losingSessions.length > 0 
        ? losingSessions.reduce((sum, s) => sum + s.netPnl, 0) / losingSessions.length 
        : 0;
    const expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss);
    
    const grossProfit = winningSessions.reduce((sum, s) => sum + s.netPnl, 0);
    const grossLoss = Math.abs(losingSessions.reduce((sum, s) => sum + s.netPnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    
    const recoveryFactor = maxDrawdown > 0 ? totalPnl / maxDrawdown : 0;
    
    let currentStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;
    
    sortedSessions.forEach(s => {
        if (s.netPnl > 0) {
            tempWinStreak++;
            tempLossStreak = 0;
            longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
        } else if (s.netPnl < 0) {
            tempLossStreak++;
            tempWinStreak = 0;
            longestLossStreak = Math.max(longestLossStreak, tempLossStreak);
        }
    });
    
    if (sortedSessions.length > 0) {
        const lastSession = sortedSessions[sortedSessions.length - 1];
        if (lastSession.netPnl > 0) currentStreak = tempWinStreak;
        else if (lastSession.netPnl < 0) currentStreak = -tempLossStreak;
    }
    
    return {
        totalTokens,
        profitableTokens,
        unprofitableTokens,
        topTokenConcentration: Math.round(topTokenConcentration * 100) / 100,
        tokenConcentrationRisk,
        totalTradingDays,
        profitableDays,
        avgDailyPnl: Math.round(avgDailyPnl * 100) / 100,
        avgDailyVolume,
        portfolioSharpe: Math.round(portfolioSharpe * 100) / 100,
        portfolioSortino: Math.round(portfolioSortino * 100) / 100,
        calmarRatio: Math.round(calmarRatio * 100) / 100,
        expectancy: Math.round(expectancy * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        recoveryFactor: Math.round(recoveryFactor * 100) / 100,
        longestWinStreak,
        longestLossStreak,
        currentStreak,
        tokenMetrics,
    };
}

// ============ Analytics ============

export function calculateTradingStats(exchange: ExchangeType = 'bitmex'): TradingStats {
    const trades = loadTradesFromCSV(exchange);
    const orders = loadOrdersFromCSV(exchange);
    const wallet = loadWalletHistoryFromCSV(exchange);
    const sessions = getPositionSessions(exchange);
    const allSymbols = getAllTradedSymbols(exchange);

    const filledOrders = orders.filter(o => o.ordStatus === 'Filled').length;
    const canceledOrders = orders.filter(o => o.ordStatus === 'Canceled').length;
    const rejectedOrders = orders.filter(o => o.ordStatus === 'Rejected').length;

    const limitOrders = orders.filter(o => o.ordType === 'Limit').length;
    const marketOrders = orders.filter(o => o.ordType === 'Market').length;
    const stopOrders = orders.filter(o => o.ordType === 'Stop' || o.ordType === 'StopLimit').length;

    const SAT_TO_BTC = 100000000;

    const realizedPnlTxs = wallet.filter(w =>
        (w.transactType === 'RealisedPNL' || w.transactType === 'Funding') &&
        w.transactStatus === 'Completed'
    );
    const fundingTxs = wallet.filter(w => w.transactType === 'Funding' && w.transactStatus === 'Completed');

    const totalRealizedPnl = realizedPnlTxs
        .filter(w => w.transactType === 'RealisedPNL')
        .reduce((sum, w) => sum + w.amount, 0) / SAT_TO_BTC;
    const totalFees = realizedPnlTxs.reduce((sum, w) => sum + Math.abs(w.fee), 0) / SAT_TO_BTC;

    const totalFunding = fundingTxs.reduce((sum, w) => sum + w.amount, 0) / SAT_TO_BTC;
    const fundingPaid = fundingTxs.filter(w => w.amount < 0).reduce((sum, w) => sum + Math.abs(w.amount), 0) / SAT_TO_BTC;
    const fundingReceived = fundingTxs.filter(w => w.amount > 0).reduce((sum, w) => sum + w.amount, 0) / SAT_TO_BTC;

    const winningTxs = realizedPnlTxs.filter(w => w.amount > 0 && w.transactType === 'RealisedPNL');
    const losingTxs = realizedPnlTxs.filter(w => w.amount < 0 && w.transactType === 'RealisedPNL');

    const totalWins = winningTxs.reduce((sum, w) => sum + w.amount, 0) / SAT_TO_BTC;
    const totalLosses = Math.abs(losingTxs.reduce((sum, w) => sum + w.amount, 0)) / SAT_TO_BTC;

    const tradeDates = new Set(trades.map(t => t.datetime.split('T')[0]));
    const tradingDays = tradeDates.size;

    const monthlyData = new Map<string, { pnl: number; funding: number; trades: number }>();

    realizedPnlTxs.filter(w => w.transactType === 'RealisedPNL').forEach(w => {
        const month = w.timestamp.substring(0, 7);
        if (!monthlyData.has(month)) {
            monthlyData.set(month, { pnl: 0, funding: 0, trades: 0 });
        }
        monthlyData.get(month)!.pnl += w.amount / SAT_TO_BTC;
    });

    fundingTxs.forEach(w => {
        const month = w.timestamp.substring(0, 7);
        if (!monthlyData.has(month)) {
            monthlyData.set(month, { pnl: 0, funding: 0, trades: 0 });
        }
        monthlyData.get(month)!.funding += w.amount / SAT_TO_BTC;
    });

    trades.forEach(t => {
        const month = t.datetime.substring(0, 7);
        if (monthlyData.has(month)) {
            monthlyData.get(month)!.trades += 1;
        }
    });

    const monthlyPnl = Array.from(monthlyData.entries())
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => a.month.localeCompare(b.month));

    const byToken = allSymbols.map(symbol => calculateTokenMetrics(symbol, sessions, exchange));
    
    const closedSessions = sessions.filter(s => s.status === 'closed' && s.closeTime);
    const sortedSessions = [...closedSessions].sort((a, b) => 
        new Date(a.closeTime!).getTime() - new Date(b.closeTime!).getTime()
    );
    
    const startDate = sortedSessions[0]?.closeTime?.split('T')[0] || '';
    const endDate = sortedSessions[sortedSessions.length - 1]?.closeTime?.split('T')[0] || '';
    const totalDays = tradeDates.size;
    
    const dailyPnl = new Map<string, number>();
    closedSessions.forEach(s => {
        if (s.closeTime) {
            const date = s.closeTime.split('T')[0];
            dailyPnl.set(date, (dailyPnl.get(date) || 0) + s.netPnl);
        }
    });
    const profitableDays = Array.from(dailyPnl.values()).filter(pnl => pnl > 0).length;
    const unprofitableDays = Array.from(dailyPnl.values()).filter(pnl => pnl < 0).length;
    
    const avgHoldingTimeMs = closedSessions.length > 0 
        ? closedSessions.reduce((sum, s) => sum + s.durationMs, 0) / closedSessions.length 
        : 0;
    const avgTradesPerToken = allSymbols.length > 0 ? trades.length / allSymbols.length : 0;
    
    let cumulativePnl = 0;
    let peak = 0;
    let maxDrawdown = 0;
    sortedSessions.forEach(s => {
        cumulativePnl += s.netPnl;
        if (cumulativePnl > peak) peak = cumulativePnl;
        const drawdown = peak - cumulativePnl;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
    const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
    
    const dailyReturns = Array.from(dailyPnl.values());
    const avgReturn = dailyReturns.length > 0 
        ? dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length 
        : 0;
    const variance = dailyReturns.length > 1 
        ? dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (dailyReturns.length - 1)
        : 0;
    const returnVolatility = Math.sqrt(variance) * Math.sqrt(365);
    const sharpeRatio = returnVolatility > 0 ? (avgReturn * 365) / returnVolatility : 0;
    
    const avgTradeReturn = trades.length > 0 
        ? closedSessions.reduce((sum, s) => sum + s.netPnl, 0) / trades.length 
        : 0;
    
    const sortedByPnl = [...byToken].sort((a, b) => b.netPnl - a.netPnl);
    const bestPerformingToken = sortedByPnl[0]?.displaySymbol || '';
    const worstPerformingToken = sortedByPnl[sortedByPnl.length - 1]?.displaySymbol || '';
    
    const advanced = calculateAdvancedStats(byToken, sessions);

    return {
        totalTrades: trades.length,
        totalOrders: orders.length,
        filledOrders,
        canceledOrders,
        rejectedOrders,
        fillRate: orders.length > 0 ? (filledOrders / orders.length) * 100 : 0,
        cancelRate: orders.length > 0 ? (canceledOrders / orders.length) * 100 : 0,
        limitOrders,
        marketOrders,
        stopOrders,
        limitOrderPercent: orders.length > 0 ? (limitOrders / orders.length) * 100 : 0,
        totalRealizedPnl,
        totalFunding,
        totalFees,
        netPnl: totalRealizedPnl + totalFunding - totalFees,
        winningTrades: winningTxs.length,
        losingTrades: losingTxs.length,
        winRate: (winningTxs.length + losingTxs.length) > 0
            ? (winningTxs.length / (winningTxs.length + losingTxs.length)) * 100
            : 0,
        avgWin: winningTxs.length > 0 ? totalWins / winningTxs.length : 0,
        avgLoss: losingTxs.length > 0 ? totalLosses / losingTxs.length : 0,
        profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
        fundingPaid,
        fundingReceived,
        tradingDays,
        avgTradesPerDay: tradingDays > 0 ? trades.length / tradingDays : 0,
        monthlyPnl,
        byToken,
        startDate,
        endDate,
        totalDays,
        profitableDays,
        unprofitableDays,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        maxDrawdown,
        maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
        avgTradeReturn: Math.round(avgTradeReturn * 100) / 100,
        returnVolatility: Math.round(returnVolatility * 100) / 100,
        avgHoldingTimeMs,
        avgTradesPerToken: Math.round(avgTradesPerToken * 100) / 100,
        bestPerformingToken,
        worstPerformingToken,
        advanced,
    };
}

export function getPaginatedTrades(page: number, limit: number, symbol?: string, exchange: ExchangeType = 'bitmex'): { trades: Trade[], total: number } {
    const allTrades = loadTradesFromCSV(exchange);

    let filtered = allTrades;
    if (symbol) {
        const internalSymbol = toInternalSymbol(symbol, exchange);
        filtered = allTrades.filter(t => t.symbol === symbol || t.symbol === internalSymbol || t.displaySymbol === symbol);
    }

    filtered.sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());

    const start = (page - 1) * limit;
    const end = start + limit;

    return {
        trades: filtered.slice(start, end),
        total: filtered.length
    };
}

export function getOHLCData(symbol: string = 'BTCUSD', timeframe: '1h' | '4h' | '1d' | '1w' = '1d', exchange: ExchangeType = 'bitmex') {
    const allTrades = loadTradesFromCSV(exchange);

    const internalSymbol = toInternalSymbol(symbol, exchange);
    const filtered = allTrades.filter(t =>
        t.symbol === symbol ||
        t.symbol === internalSymbol ||
        t.displaySymbol === symbol
    );

    filtered.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    const candles = new Map<number, {
        time: number,
        open: number,
        high: number,
        low: number,
        close: number,
        volume: number,
        markers: any[]
    }>();

    const getBucketTime = (timestamp: number): number => {
        const date = new Date(timestamp);
        if (timeframe === '1h') {
            date.setMinutes(0, 0, 0);
            return date.getTime() / 1000;
        }
        if (timeframe === '4h') {
            const h = date.getHours();
            date.setHours(h - (h % 4), 0, 0, 0);
            return date.getTime() / 1000;
        }
        if (timeframe === '1w') {
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            date.setDate(diff);
            date.setHours(0, 0, 0, 0);
            return date.getTime() / 1000;
        }
        date.setHours(0, 0, 0, 0);
        return date.getTime() / 1000;
    };

    filtered.forEach(t => {
        const timestamp = new Date(t.datetime).getTime();
        const bucketTime = getBucketTime(timestamp);

        if (!candles.has(bucketTime)) {
            candles.set(bucketTime, {
                time: bucketTime,
                open: t.price,
                high: t.price,
                low: t.price,
                close: t.price,
                volume: 0,
                markers: []
            });
        }

        const candle = candles.get(bucketTime)!;
        candle.high = Math.max(candle.high, t.price);
        candle.low = Math.min(candle.low, t.price);
        candle.close = t.price;
        candle.volume += t.amount;

        if (t.side === 'buy' || t.side === 'sell') {
            candle.markers.push({
                time: bucketTime,
                position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
                color: t.side === 'buy' ? '#10b981' : '#ef4444',
                shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
                text: `${t.side.toUpperCase()} ${t.amount.toLocaleString()} @ $${t.price.toLocaleString()}`
            });
        }
    });

    const candleArray = Array.from(candles.values()).sort((a, b) => a.time - b.time);
    const markers: any[] = [];

    candleArray.forEach(c => {
        const buys = c.markers.filter((m: any) => m.shape === 'arrowUp');
        const sells = c.markers.filter((m: any) => m.shape === 'arrowDown');

        if (buys.length > 0) markers.push(buys[buys.length - 1]);
        if (sells.length > 0) markers.push(sells[sells.length - 1]);

        delete (c as any).markers;
    });

    return { candles: candleArray, markers };
}

export function getEquityCurve(exchange: ExchangeType = 'bitmex'): { time: number; balance: number }[] {
    const wallet = loadWalletHistoryFromCSV(exchange);

    const balanceHistory = wallet
        .filter(w => w.transactStatus === 'Completed' && w.walletBalance > 0)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(w => ({
            time: Math.floor(new Date(w.timestamp).getTime() / 1000),
            balance: w.walletBalance / 100000000
        }));

    const dailyBalance = new Map<number, number>();
    balanceHistory.forEach(b => {
        const dayTime = Math.floor(b.time / 86400) * 86400;
        dailyBalance.set(dayTime, b.balance);
    });

    return Array.from(dailyBalance.entries())
        .map(([time, balance]) => ({ time, balance }))
        .sort((a, b) => a.time - b.time);
}

export function getFundingHistory(exchange: ExchangeType = 'bitmex'): { time: number; amount: number; cumulative: number }[] {
    const wallet = loadWalletHistoryFromCSV(exchange);
    const SAT_TO_BTC = 100000000;

    const fundingTxs = wallet
        .filter(w => w.transactType === 'Funding' && w.transactStatus === 'Completed')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let cumulative = 0;
    return fundingTxs.map(w => {
        cumulative += w.amount / SAT_TO_BTC;
        return {
            time: Math.floor(new Date(w.timestamp).getTime() / 1000),
            amount: w.amount / SAT_TO_BTC,
            cumulative
        };
    });
}
