'use client';

import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { ExchangeType } from '@/lib/exchange_types';

interface EquityData {
    time: number;
    balance: number;
}

interface PerformanceChartProps {
    data: EquityData[];
    exchange?: ExchangeType;
    loading?: boolean;
}

export function PerformanceChart({ data, exchange = 'binance', loading = false }: PerformanceChartProps) {
    const currencyUnit = (exchange === 'binance' || exchange === 'okx' || exchange === 'bybit') ? 'USDT' : 'BTC';

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-6 animate-pulse"></div>
                <div className="h-80 bg-gray-100 rounded animate-pulse"></div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Equity Curve</h2>
                <div className="h-80 flex items-center justify-center text-gray-500">
                    No data available. Connect your API and fetch data to see your equity curve.
                </div>
            </div>
        );
    }

    // Transform data for Recharts
    const chartData = data.map((d) => ({
        date: new Date(d.time * 1000).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        }),
        fullDate: new Date(d.time * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }),
        equity: d.balance,
        time: d.time,
    }));

    // Calculate stats
    const startBalance = data[0]?.balance || 0;
    const endBalance = data[data.length - 1]?.balance || 0;
    const change = endBalance - startBalance;
    const changePercent = startBalance > 0 ? (change / startBalance) * 100 : 0;

    // Find peak and drawdown
    let peak = 0;
    let maxDrawdown = 0;
    data.forEach((d) => {
        if (d.balance > peak) peak = d.balance;
        const drawdown = peak > 0 ? (peak - d.balance) / peak : 0;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    const formatCurrency = (value: number) => {
        return `${value.toFixed(4)} ${currencyUnit}`;
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
                    <p className="text-sm text-gray-600 mb-2">{data.fullDate}</p>
                    <p className="text-base font-semibold text-gray-900">
                        Equity: {formatCurrency(data.equity)}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Equity Curve</h2>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="text-sm text-gray-600">Portfolio Value</span>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-100">
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">
                        Current Balance
                    </p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(endBalance)}</p>
                    <p className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {change >= 0 ? '+' : ''}{change.toFixed(4)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">
                        Peak Balance
                    </p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(peak)}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider font-medium">
                        Max Drawdown
                    </p>
                    <p className="text-lg font-bold text-red-600">{(maxDrawdown * 100).toFixed(2)}%</p>
                </div>
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="date"
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                    />
                    <YAxis
                        stroke="#6b7280"
                        style={{ fontSize: '12px' }}
                        tickFormatter={(value) => value.toFixed(2)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#colorEquity)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
