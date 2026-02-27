'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Trade, PositionSession, TokenMetrics } from '@/lib/types';
import { TradeList } from './TradeList';
import { PositionSessionList } from './PositionSessionList';
import { PositionDetail } from './PositionDetail';
import { StatsOverview } from './StatsOverview';
import { MonthlyPnLChart } from './MonthlyPnLChart';
import { TokenSelector } from './TokenSelector';
import { TokenMetricsTable } from './TokenMetricsTable';
import { AIAnalysis } from './AIAnalysis';
// Figma-style components
import { ApiConnection } from './ApiConnection';
import { MetricsCards } from './MetricsCards';
import { PerformanceChart } from './PerformanceChart';
import { TradesTable } from './TradesTable';
import {
    Loader2,
    ChevronLeft,
    ChevronRight,
    LayoutList,
    History,
    BarChart3,
    TrendingUp,
    Activity,
    Settings,
    Sun,
    Moon,
    Github,
    Bot,
    Coins,
} from 'lucide-react';
import { ExchangeType, EXCHANGE_DISPLAY_NAMES } from '@/lib/exchange_types';
import { useTheme } from './ThemeProvider';

type ViewMode = 'overview' | 'positions' | 'trades' | 'ai';

export function Dashboard() {
    const { theme, toggleTheme } = useTheme();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [sessions, setSessions] = useState<PositionSession[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [account, setAccount] = useState<any>(null);
    const [equityCurve, setEquityCurve] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedExchange, setSelectedExchange] = useState<ExchangeType | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState('BTCUSD');
    const [viewMode, setViewMode] = useState<ViewMode>('overview');
    const [selectedSession, setSelectedSession] = useState<PositionSession | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const limit = 20;
    const [reloadKey, setReloadKey] = useState(0);

    // State for available exchanges (auto-detected based on data)
    const [availableExchanges, setAvailableExchanges] = useState<ExchangeType[]>([]);
    const [checkingData, setCheckingData] = useState(true);

    // State for all sessions (loaded upfront for chart markers)
    const [allSessions, setAllSessions] = useState<PositionSession[]>([]);

    // Collect Entry & Exit points from ALL sessions for the TradingView chart
    const allSessionTrades = useMemo(() => {
        if (!allSessions || allSessions.length === 0) return [];

        const tradesList: { datetime: string; side: 'buy' | 'sell'; price: number; amount: number; sessionId: string; label: string }[] = [];

        const normalizeSymbol = (sym: string): string => {
            return sym.toUpperCase()
                .replace('XBT', 'BTC')
                .replace('-USDT-SWAP', '')
                .replace('-USD-SWAP', '')
                .replace('-SWAP', '')
                .replace('USD', '')
                .replace('USDT', '')
                .replace('/', '')
                .replace('-', '')
                .replace(':BTC', '');
        };

        const baseNormalized = normalizeSymbol(selectedSymbol);

        allSessions.forEach(session => {
            const sessionNormalized = normalizeSymbol(session.symbol);
            if (sessionNormalized !== baseNormalized) {
                return;
            }

            if (session.avgEntryPrice > 0) {
                tradesList.push({
                    datetime: session.openTime,
                    side: session.side === 'long' ? 'buy' : 'sell',
                    price: session.avgEntryPrice,
                    amount: session.maxSize,
                    sessionId: session.id,
                    label: `${session.side.toUpperCase()} ENTRY`,
                });
            }

            if (session.status === 'closed' && session.avgExitPrice > 0 && session.closeTime) {
                tradesList.push({
                    datetime: session.closeTime,
                    side: session.side === 'long' ? 'sell' : 'buy',
                    price: session.avgExitPrice,
                    amount: session.maxSize,
                    sessionId: session.id,
                    label: `${session.side.toUpperCase()} EXIT`,
                });
            }
        });

        tradesList.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
        return tradesList;
    }, [allSessions, selectedSymbol]);

    // Get entry & exit for selected session only
    const selectedSessionTrades = useMemo(() => {
        if (!selectedSession) return [];

        const tradesList: { datetime: string; side: 'buy' | 'sell'; price: number; amount: number; label: string }[] = [];

        if (selectedSession.avgEntryPrice > 0) {
            tradesList.push({
                datetime: selectedSession.openTime,
                side: selectedSession.side === 'long' ? 'buy' : 'sell',
                price: selectedSession.avgEntryPrice,
                amount: selectedSession.maxSize,
                label: `ENTRY @ ${selectedSession.avgEntryPrice.toLocaleString()}`,
            });
        }

        if (selectedSession.status === 'closed' && selectedSession.avgExitPrice > 0 && selectedSession.closeTime) {
            tradesList.push({
                datetime: selectedSession.closeTime,
                side: selectedSession.side === 'long' ? 'sell' : 'buy',
                price: selectedSession.avgExitPrice,
                amount: selectedSession.maxSize,
                label: `EXIT @ ${selectedSession.avgExitPrice.toLocaleString()}`,
            });
        }

        return tradesList;
    }, [selectedSession]);

    // Symbol options based on exchange - now dynamic from stats
    const symbolOptions = useMemo(() => {
        if (stats?.byToken && stats.byToken.length > 0) {
            return stats.byToken.map((t: TokenMetrics) => t.displaySymbol);
        }
        if (selectedExchange === 'bitmex') return ['BTCUSD', 'ETHUSD'];
        if (selectedExchange === 'okx') return ['BTC-USDT-SWAP', 'ETH-USDT-SWAP'];
        return ['BTCUSDT', 'ETHUSDT'];
    }, [stats?.byToken, selectedExchange]);

    // Check available exchanges on mount
    useEffect(() => {
        async function checkAvailableExchanges() {
            setCheckingData(true);
            try {
                const res = await fetch('/api/exchanges');
                if (!res.ok) throw new Error('Failed to check exchanges');
                const data = await res.json();
                setAvailableExchanges(data.availableExchanges || []);

                if (data.availableExchanges && data.availableExchanges.length > 0) {
                    const firstExchange = data.availableExchanges[0];
                    setSelectedExchange(firstExchange);
                    if (firstExchange === 'bitmex') {
                        setSelectedSymbol('BTCUSD');
                    } else if (firstExchange === 'okx') {
                        setSelectedSymbol('BTC-USDT-SWAP');
                    } else {
                        setSelectedSymbol('BTCUSDT');
                    }
                }
            } catch (err) {
                console.error('Error checking available exchanges:', err);
            } finally {
                setCheckingData(false);
            }
        }
        checkAvailableExchanges();
    }, [reloadKey]);

    // Reset symbol when exchange changes
    useEffect(() => {
        if (!selectedExchange) return;
        if (selectedExchange === 'bitmex') {
            setSelectedSymbol('BTCUSD');
        } else if (selectedExchange === 'okx') {
            setSelectedSymbol('BTC-USDT-SWAP');
        } else {
            setSelectedSymbol('BTCUSDT');
        }
    }, [selectedExchange]);

    // Load Stats and Account Data
    useEffect(() => {
        if (!selectedExchange) return;
        async function loadStats() {
            try {
                const res = await fetch(`/api/trades?type=stats&exchange=${selectedExchange}`);
                if (!res.ok) throw new Error('Failed to fetch stats');
                const data = await res.json();
                setStats(data.stats);
                setAccount(data.account);

                if (data.stats?.byToken && data.stats.byToken.length > 0) {
                    const sorted = [...data.stats.byToken].sort((a: TokenMetrics, b: TokenMetrics) => b.netPnl - a.netPnl);
                    if (sorted[0]) {
                        setSelectedSymbol(sorted[0].displaySymbol);
                    }
                }
            } catch (err) {
                console.error('Error loading stats:', err);
            }
        }
        loadStats();
    }, [selectedExchange, reloadKey]);

    // Load Equity Curve
    useEffect(() => {
        if (!selectedExchange) return;
        async function loadEquity() {
            try {
                const res = await fetch(`/api/trades?type=equity&exchange=${selectedExchange}`);
                if (!res.ok) throw new Error('Failed to fetch equity');
                const data = await res.json();
                setEquityCurve(data.equityCurve);
            } catch (err) {
                console.error('Error loading equity:', err);
            }
        }
        loadEquity();
    }, [selectedExchange, reloadKey]);


    // Load all sessions upfront for chart markers
    useEffect(() => {
        if (!selectedExchange) return;
        async function loadAllSessions() {
            try {
                const res = await fetch(`/api/trades?type=sessions&limit=10000&exchange=${selectedExchange}`);
                if (!res.ok) throw new Error('Failed to fetch sessions');
                const data = await res.json();
                setAllSessions(data.sessions || []);
            } catch (err) {
                console.error('Error loading sessions for markers:', err);
            }
        }
        loadAllSessions();
    }, [selectedExchange, reloadKey]);

    // Load Table Data (Paginated)
    useEffect(() => {
        if (!selectedExchange) return;
        async function loadData() {
            if (viewMode === 'overview') {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const typeParam = viewMode === 'positions' ? '&type=sessions' : '';
                const res = await fetch(`/api/trades?page=${page}&limit=${limit}&symbol=${encodeURIComponent(selectedSymbol)}${typeParam}&exchange=${selectedExchange}`);
                if (!res.ok) throw new Error('Failed to fetch data');
                const data = await res.json();

                if (viewMode === 'positions') {
                    setSessions(data.sessions);
                    setTotalPages(Math.ceil(data.total / limit));
                } else {
                    setTrades(data.trades);
                    setTotalPages(Math.ceil(data.total / limit));
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [page, selectedSymbol, viewMode, selectedExchange, reloadKey]);

    // Reset selected session when switching views or symbols
    useEffect(() => {
        setSelectedSession(null);
    }, [viewMode, selectedSymbol]);

    // Handler to select a session and fetch full trade details
    const handleSelectSession = async (session: PositionSession) => {
        try {
            const res = await fetch(`/api/trades?sessionId=${encodeURIComponent(session.id)}&exchange=${selectedExchange}`);
            if (!res.ok) throw new Error('Failed to fetch session details');
            const data = await res.json();
            setSelectedSession(data.session);
        } catch (err) {
            console.error('Error fetching session:', err);
            setSelectedSession(session);
        }
    };

    // Handler for data refresh after API fetch
    const handleDataFetched = () => {
        setReloadKey(prev => prev + 1);
    };

    if (checkingData) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Checking available data...</p>
            </div>
        );
    }

    // No data available - show onboarding screen with API connection
    if (availableExchanges.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-600 rounded-lg">
                                    <TrendingUp className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">TradeVoyage</h1>
                                    <p className="text-sm text-gray-600">Monitor your trading performance in real-time</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href="https://github.com/0x0funky/TradeVoyage"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <Github className="w-5 h-5" />
                                </a>
                                <Link
                                    href="/settings"
                                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <Settings className="w-5 h-5" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="space-y-8">
                        <ApiConnection
                            onDataFetched={handleDataFetched}
                            totalTrades={stats?.totalTrades}
                            tradingDays={stats?.tradingDays}
                            avgTradesPerDay={stats?.avgTradesPerDay}
                        />

                        {/* Welcome Card */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Welcome to TradeVoyage</h2>
                            <p className="text-gray-600 mb-4">
                                No trading data found. Configure your exchange API above to import your trading history.
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-gray-50 rounded-lg text-center">
                                    <p className="font-medium text-gray-900">BitMEX</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg text-center">
                                    <p className="font-medium text-gray-900">Binance</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg text-center">
                                    <p className="font-medium text-gray-900">OKX</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg text-center">
                                    <p className="font-medium text-gray-900">Bybit</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (loading && !stats) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Loading analytics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-red-600">Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-600 rounded-lg">
                                <TrendingUp className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Trading Portfolio</h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    {selectedExchange && EXCHANGE_DISPLAY_NAMES[selectedExchange]}
                                    {account?.user?.username && ` • @${account.user.username}`}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Exchange Selector */}
                            <select
                                value={selectedExchange || ''}
                                onChange={(e) => {
                                    setSelectedExchange(e.target.value as ExchangeType);
                                    setPage(1);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                                {availableExchanges.map(ex => (
                                    <option key={ex} value={ex}>{EXCHANGE_DISPLAY_NAMES[ex]}</option>
                                ))}
                            </select>

                            {/* Symbol Selector */}
                            <select
                                value={selectedSymbol}
                                onChange={(e) => {
                                    setSelectedSymbol(e.target.value);
                                    setPage(1);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                                {symbolOptions.map((sym: string) => (
                                    <option key={sym} value={sym}>{sym}</option>
                                ))}
                            </select>

                            {/* View Mode Tabs */}
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => { setViewMode('overview'); setPage(1); }}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        viewMode === 'overview'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <BarChart3 size={16} className="inline mr-2" /> Overview
                                </button>
                                <button
                                    onClick={() => { setViewMode('positions'); setPage(1); }}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        viewMode === 'positions'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <History size={16} className="inline mr-2" /> Positions
                                </button>
                                <button
                                    onClick={() => { setViewMode('trades'); setPage(1); }}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        viewMode === 'trades'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <LayoutList size={16} className="inline mr-2" /> Trades
                                </button>
                                <button
                                    onClick={() => { setViewMode('ai'); }}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                        viewMode === 'ai'
                                            ? 'bg-white text-purple-600 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Bot size={16} className="inline mr-2" /> AI
                                </button>
                            </div>

                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                            >
                                {theme === 'dark' ? (
                                    <Sun className="w-5 h-5" />
                                ) : (
                                    <Moon className="w-5 h-5" />
                                )}
                            </button>

                            {/* Settings Link */}
                            <Link
                                href="/settings"
                                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <Settings className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-8">
                    {/* API Connection */}
                    <ApiConnection
                        onDataFetched={handleDataFetched}
                        totalTrades={stats?.totalTrades}
                        tradingDays={stats?.tradingDays}
                        avgTradesPerDay={stats?.avgTradesPerDay}
                    />

                    {/* Overview Mode */}
                    {viewMode === 'overview' && stats && (
                        <div className="space-y-8">
                            {/* Metrics Cards - Figma Style */}
                            <MetricsCards stats={stats} account={account} exchange={selectedExchange!} loading={loading} />

                            {/* Performance Chart - Figma Style */}
                            <PerformanceChart data={equityCurve} exchange={selectedExchange!} loading={loading} />

                            {/* Recent Trades Table - Figma Style */}
                            <TradesTable trades={trades.slice(0, 10)} exchange={selectedExchange!} loading={loading} />

                            {/* Token Metrics Table */}
                            {stats.byToken && stats.byToken.length > 0 && (
                                <div className="bg-white rounded-lg shadow p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
                                            <Coins className="w-5 h-5 text-blue-600" />
                                            Token Performance
                                        </h3>
                                        <div className="text-sm text-gray-500">
                                            {stats.byToken.length} tokens • {stats.startDate} ~ {stats.endDate}
                                        </div>
                                    </div>
                                    <TokenMetricsTable
                                        metrics={stats.byToken}
                                        selectedToken={selectedSymbol}
                                        onTokenClick={(token) => {
                                            setSelectedSymbol(token.displaySymbol);
                                        }}
                                    />
                                </div>
                            )}

                            {/* Monthly PnL Chart */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-gray-900">
                                    <BarChart3 className="w-5 h-5 text-blue-600" />
                                    Monthly PnL
                                </h3>
                                <MonthlyPnLChart data={stats.monthlyPnl} exchange={selectedExchange!} />
                            </div>
                        </div>
                    )}

                    {/* Positions Mode */}
                    {viewMode === 'positions' && (
                        <div className="space-y-6">
                            {selectedSession ? (
                                <PositionDetail
                                    session={selectedSession}
                                    onBack={() => setSelectedSession(null)}
                                />
                            ) : (
                                <>
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-xl font-bold text-gray-900">Position History</h2>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                disabled={page === 1}
                                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronLeft size={20} />
                                            </button>
                                            <span className="text-sm font-medium px-2 text-gray-600">
                                                Page {page} of {totalPages}
                                            </span>
                                            <button
                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                                disabled={page === totalPages}
                                                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronRight size={20} />
                                            </button>
                                        </div>
                                    </div>
                                    <PositionSessionList
                                        sessions={sessions}
                                        onSelectSession={handleSelectSession}
                                    />
                                </>
                            )}
                        </div>
                    )}

                    {/* Trades Mode */}
                    {viewMode === 'trades' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-bold text-gray-900">Trade Log</h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <span className="text-sm font-medium px-2 text-gray-600">
                                        Page {page} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow overflow-hidden">
                                <TradeList trades={trades} />
                            </div>
                        </div>
                    )}

                    {/* AI Analysis Mode */}
                    {viewMode === 'ai' && (
                        <div className="bg-white rounded-lg shadow p-6">
                            <AIAnalysis
                                stats={stats}
                                sessions={allSessions}
                                exchange={selectedExchange!}
                            />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
