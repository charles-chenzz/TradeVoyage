'use client';

import React, { useState } from 'react';
import { TokenMetrics } from '@/lib/types';
import {
    TrendingUp,
    TrendingDown,
    Minus,
    ChevronUp,
    ChevronDown,
    ExternalLink
} from 'lucide-react';

interface TokenMetricsTableProps {
    metrics: TokenMetrics[];
    onTokenClick?: (token: TokenMetrics) => void;
    selectedToken?: string | null;
}

type SortField = 'netPnl' | 'winRate' | 'sharpeRatio' | 'totalSessions' | 'maxDrawdownPercent';
type SortDirection = 'asc' | 'desc';

const formatPnl = (pnl: number) => {
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}$${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${(hours / 24).toFixed(1)}d`;
};

export function TokenMetricsTable({ metrics, onTokenClick, selectedToken }: TokenMetricsTableProps) {
    const [sortField, setSortField] = useState<SortField>('netPnl');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedMetrics = [...metrics].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        const modifier = sortDirection === 'asc' ? 1 : -1;
        return (aVal - bVal) * modifier;
    });

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />;
        return sortDirection === 'asc'
            ? <ChevronUp className="w-3 h-3 text-blue-600" />
            : <ChevronDown className="w-3 h-3 text-blue-600" />;
    };

    const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
        switch (trend) {
            case 'up': return <TrendingUp className="w-4 h-4 text-emerald-600" />;
            case 'down': return <TrendingDown className="w-4 h-4 text-rose-600" />;
            default: return <Minus className="w-4 h-4 text-gray-400" />;
        }
    };

    if (metrics.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                暂无代币交易数据
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            代币
                        </th>
                        <th
                            className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors"
                            onClick={() => handleSort('netPnl')}
                        >
                            <div className="flex items-center justify-end gap-1">
                                净盈亏
                                <SortIcon field="netPnl" />
                            </div>
                        </th>
                        <th
                            className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors"
                            onClick={() => handleSort('totalSessions')}
                        >
                            <div className="flex items-center justify-end gap-1">
                                交易次数
                                <SortIcon field="totalSessions" />
                            </div>
                        </th>
                        <th
                            className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors"
                            onClick={() => handleSort('winRate')}
                        >
                            <div className="flex items-center justify-end gap-1">
                                胜率
                                <SortIcon field="winRate" />
                            </div>
                        </th>
                        <th
                            className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors"
                            onClick={() => handleSort('sharpeRatio')}
                        >
                            <div className="flex items-center justify-end gap-1">
                                夏普
                                <SortIcon field="sharpeRatio" />
                            </div>
                        </th>
                        <th
                            className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 transition-colors"
                            onClick={() => handleSort('maxDrawdownPercent')}
                        >
                            <div className="flex items-center justify-end gap-1">
                                最大回撤
                                <SortIcon field="maxDrawdownPercent" />
                            </div>
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            做多/做空
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            趋势
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedMetrics.map((token) => (
                        <tr
                            key={token.symbol}
                            onClick={() => onTokenClick?.(token)}
                            className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
                                selectedToken === token.symbol ? 'bg-blue-50' : ''
                            }`}
                        >
                            <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                    <span className={`w-2 h-2 rounded-full ${token.netPnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                    <div>
                                        <div className="font-medium text-gray-900">{token.displaySymbol}</div>
                                        <div className="text-xs text-gray-500">
                                            {token.firstTradeDate} ~ {token.lastTradeDate}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                                <span className={`font-mono font-medium ${token.netPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {formatPnl(token.netPnl)}
                                </span>
                            </td>
                            <td className="py-3 px-4 text-right text-gray-900 font-mono">
                                {token.totalSessions}
                            </td>
                            <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-500 rounded-full transition-all"
                                            style={{ width: `${Math.min(token.winRate, 100)}%` }}
                                        />
                                    </div>
                                    <span className="font-mono text-sm w-12 text-right text-gray-700">
                                        {token.winRate.toFixed(0)}%
                                    </span>
                                </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                                <span className={`font-mono ${token.sharpeRatio > 2 ? 'text-emerald-600' : token.sharpeRatio > 1 ? 'text-amber-600' : 'text-gray-700'}`}>
                                    {token.sharpeRatio.toFixed(2)}
                                </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                                <span className="font-mono text-rose-600">
                                    -{token.maxDrawdownPercent.toFixed(1)}%
                                </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2 text-xs">
                                    <span className="text-emerald-600">{token.longWinRate.toFixed(0)}% L</span>
                                    <span className="text-gray-400">/</span>
                                    <span className="text-rose-600">{token.shortWinRate.toFixed(0)}% S</span>
                                </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center">
                                    {getTrendIcon(token.pnlTrend)}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
