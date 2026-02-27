'use client';

import React from 'react';
import { ExchangeType } from '@/lib/exchange_types';
import {
    TrendingUp,
    TrendingDown,
    Target,
    Award,
    BarChart3,
    DollarSign,
} from 'lucide-react';

// Safe number helper - handles null/undefined values
const safeNum = (value: number | null | undefined, defaultValue: number = 0): number => {
    if (value === null || value === undefined || isNaN(value)) return defaultValue;
    return value;
};

interface TradingStats {
    totalRealizedPnl: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    sharpeRatio?: number;
}

interface AccountSummary {
    wallet: {
        marginBalance: number;
        availableMargin: number;
        unrealisedPnl: number;
    };
}

interface MetricsCardsProps {
    stats: TradingStats | null;
    account: AccountSummary | null;
    exchange?: ExchangeType;
    loading?: boolean;
}

function MetricCard({
    title,
    value,
    change,
    changePercent,
    icon: Icon,
    positive,
    color,
}: {
    title: string;
    value: string;
    change?: string;
    changePercent?: string;
    icon: React.ElementType;
    positive?: boolean;
    color: 'blue' | 'green' | 'purple' | 'orange';
}) {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        purple: 'bg-purple-50 text-purple-600',
        orange: 'bg-orange-50 text-orange-600',
    };

    return (
        <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
                {positive !== undefined && (
                    <div className={`flex items-center text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
                        {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                )}
            </div>
            <h3 className="text-sm text-gray-600 mb-1">{title}</h3>
            <p className="text-2xl font-semibold text-gray-900 mb-2">{value}</p>
            {change && <p className="text-sm text-gray-500">{change}</p>}
            {changePercent && (
                <p className={`text-sm mt-1 ${positive ? 'text-green-600' : 'text-red-600'}`}>
                    {changePercent}
                </p>
            )}
        </div>
    );
}

export function MetricsCards({ stats, account, exchange = 'binance', loading = false }: MetricsCardsProps) {
    const currencyUnit = (exchange === 'binance' || exchange === 'okx' || exchange === 'bybit') ? 'USDT' : 'BTC';

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 rounded-lg bg-gray-100">
                                <div className="w-6 h-6 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                    </div>
                ))}
            </div>
        );
    }

    const marginBalance = safeNum(account?.wallet?.marginBalance);
    const totalRealizedPnl = safeNum(stats?.totalRealizedPnl);
    const winRate = safeNum(stats?.winRate);
    const profitFactor = safeNum(stats?.profitFactor);
    const maxDrawdown = safeNum(stats?.maxDrawdown);
    const maxDrawdownPercent = safeNum(stats?.maxDrawdownPercent);

    const cards = [
        {
            title: 'Total Portfolio Value',
            value: `${marginBalance >= 0 ? '' : '-'}${Math.abs(marginBalance).toFixed(4)} ${currencyUnit}`,
            change: totalRealizedPnl !== 0 ? `${totalRealizedPnl >= 0 ? '+' : ''}${totalRealizedPnl.toFixed(4)} ${currencyUnit}` : undefined,
            icon: DollarSign,
            positive: totalRealizedPnl >= 0,
            color: 'blue' as const,
        },
        {
            title: 'Win Rate',
            value: `${winRate.toFixed(1)}%`,
            change: `${safeNum(stats?.winningTrades)}W / ${safeNum(stats?.losingTrades)}L`,
            icon: Target,
            positive: winRate >= 50,
            color: 'green' as const,
        },
        {
            title: 'Profit Factor',
            value: profitFactor === Infinity ? '∞' : profitFactor.toFixed(2),
            change: stats?.avgWin !== undefined ? `Avg Win: ${safeNum(stats.avgWin).toFixed(4)}` : undefined,
            icon: Award,
            positive: profitFactor >= 1,
            color: 'purple' as const,
        },
        {
            title: 'Max Drawdown',
            value: `${maxDrawdownPercent.toFixed(2)}%`,
            change: stats?.sharpeRatio !== undefined ? `Sharpe: ${safeNum(stats.sharpeRatio).toFixed(2)}` : undefined,
            icon: BarChart3,
            positive: maxDrawdownPercent > -15,
            color: 'orange' as const,
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card, index) => (
                <MetricCard key={index} {...card} />
            ))}
        </div>
    );
}
