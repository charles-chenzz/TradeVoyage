'use client';

import React, { useState } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { TokenMetrics } from '@/lib/types';

interface TokenSelectorProps {
    tokens: TokenMetrics[];
    selectedToken: string | null;
    onChange: (symbol: string | null) => void;
}

export function TokenSelector({ tokens, selectedToken, onChange }: TokenSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filteredTokens = tokens.filter(t => 
        t.displaySymbol.toLowerCase().includes(search.toLowerCase())
    );

    const selected = tokens.find(t => t.symbol === selectedToken);

    const formatPnl = (pnl: number) => {
        const sign = pnl >= 0 ? '+' : '';
        return `${sign}$${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground hover:bg-secondary/50 transition-all min-w-[200px]"
            >
                {selected ? (
                    <>
                        <span className={`w-2 h-2 rounded-full ${selected.netPnl >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span className="flex-1 text-left">{selected.displaySymbol}</span>
                        <span className={`text-xs ${selected.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatPnl(selected.netPnl)}
                        </span>
                    </>
                ) : (
                    <span className="text-muted-foreground">选择代币</span>
                )}
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-xl shadow-lg z-20 max-h-80 overflow-hidden">
                        <div className="p-2 border-b border-border">
                            <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg">
                                <Search className="w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="搜索代币..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-y-auto max-h-56">
                            {filteredTokens.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                                    没有找到代币
                                </div>
                            ) : (
                                filteredTokens.map((token) => (
                                    <button
                                        key={token.symbol}
                                        onClick={() => {
                                            onChange(token.symbol);
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors ${
                                            selectedToken === token.symbol ? 'bg-secondary/30' : ''
                                        }`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${token.netPnl >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                        <span className="flex-1 text-left font-medium">{token.displaySymbol}</span>
                                        <div className="text-right">
                                            <div className={`text-sm font-medium ${token.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {formatPnl(token.netPnl)}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {token.totalSessions} 笔 · {token.winRate.toFixed(0)}%
                                            </div>
                                        </div>
                                        {selectedToken === token.symbol && (
                                            <Check className="w-4 h-4 text-primary" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
