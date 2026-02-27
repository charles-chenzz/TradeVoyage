'use client';

import React, { useState } from 'react';
import { Trade } from '@/lib/types';
import { ArrowUpRight, ArrowDownRight, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { ExchangeType } from '@/lib/exchange_types';

interface TradesTableProps {
    trades: Trade[];
    exchange?: ExchangeType;
    loading?: boolean;
}

export function TradesTable({ trades, exchange = 'binance', loading = false }: TradesTableProps) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const currencyUnit = (exchange === 'binance' || exchange === 'okx' || exchange === 'bybit') ? 'USDT' : 'BTC';

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-6 animate-pulse"></div>
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (!trades || trades.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Recent Trades</h2>
                <div className="h-40 flex items-center justify-center text-gray-500">
                    No trades available. Connect your API and fetch data to see your trades.
                </div>
            </div>
        );
    }

    const formatTime = (timeStr: string) => {
        if (!timeStr) return '-';
        const date = new Date(timeStr);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatPrice = (price: number) => {
        if (!price) return '-';
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Pagination
    const totalPages = Math.ceil(trades.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentTrades = trades.slice(startIndex, endIndex);

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Recent Trades</h2>
                <span className="text-sm text-gray-500">{trades.length} total trades</span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Symbol</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Quantity</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Price</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Cost</th>
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Time</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Fee</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentTrades.map((trade) => (
                            <tr key={trade.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                <td className="py-4 px-4">
                                    <span className="font-semibold text-gray-900">{trade.displaySymbol || trade.symbol}</span>
                                </td>
                                <td className="py-4 px-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        trade.side === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {trade.side.toUpperCase()}
                                    </span>
                                </td>
                                <td className="py-4 px-4 text-right text-gray-700">
                                    {trade.amount.toLocaleString()}
                                </td>
                                <td className="py-4 px-4 text-right text-gray-700">
                                    {formatPrice(trade.price)}
                                </td>
                                <td className="py-4 px-4 text-right text-gray-700">
                                    {trade.cost ? `${trade.cost.toFixed(4)} ${currencyUnit}` : '-'}
                                </td>
                                <td className="py-4 px-4 text-sm text-gray-600">
                                    {formatTime(trade.datetime)}
                                </td>
                                <td className="py-4 px-4 text-right">
                                    {trade.fee?.cost !== undefined ? (
                                        <span className="text-gray-600">
                                            {trade.fee.cost.toFixed(4)} {trade.fee.currency || currencyUnit}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500">
                        Showing {startIndex + 1} to {Math.min(endIndex, trades.length)} of {trades.length} trades
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm text-gray-600">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
