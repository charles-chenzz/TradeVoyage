'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Key,
    Settings,
    RefreshCw,
    Save,
    Calendar,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Activity,
    Clock,
} from 'lucide-react';
import { ExchangeType, EXCHANGE_DISPLAY_NAMES, EXCHANGES } from '@/lib/exchange_types';
import {
    ImportConfig,
    loadImportConfig,
    saveImportConfig,
    StoredImportConfig,
} from '@/lib/import_settings';

interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning' | 'progress';
    progress?: number;
}

interface ApiConnectionProps {
    onDataFetched: () => void;
    isRefreshing?: boolean;
    totalTrades?: number;
    tradingDays?: number;
    avgTradesPerDay?: number;
}

export function ApiConnection({ onDataFetched, isRefreshing = false, totalTrades, tradingDays, avgTradesPerDay }: ApiConnectionProps) {
    const [showSettings, setShowSettings] = useState(false);
    const [exchange, setExchange] = useState<ExchangeType>('binance');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [passphrase, setPassphrase] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [forceRefetch, setForceRefetch] = useState(false);

    const [isFetching, setIsFetching] = useState(false);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle');

    const logsEndRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Load saved config on mount
    useEffect(() => {
        const savedConfig = loadImportConfig();
        if (savedConfig) {
            setExchange(savedConfig.exchange);
            setApiKey(savedConfig.apiKey);
            setApiSecret(savedConfig.apiSecret);
            setPassphrase(savedConfig.passphrase || '');
            setStartDate(savedConfig.startDate);
            setEndDate(savedConfig.endDate);
            setForceRefetch(savedConfig.forceRefetch || false);
            setConnectionStatus('connected');
        }

        // Set default dates if empty
        if (!startDate || !endDate) {
            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            setEndDate(today.toISOString().split('T')[0]);
            setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
        }
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const addLog = (message: string, type: LogEntry['type'], progressValue?: number) => {
        const entry: LogEntry = {
            time: new Date().toLocaleTimeString(),
            message,
            type,
            progress: progressValue,
        };
        setLogs(prev => [...prev.slice(-50), entry]); // Keep last 50 logs
        if (progressValue !== undefined) {
            setProgress(progressValue);
        }
    };

    const handleSaveConfig = () => {
        const config: ImportConfig = {
            exchange,
            apiKey,
            apiSecret,
            passphrase,
            okxInstType: 'SWAP',
            startDate,
            endDate,
            forceRefetch,
        };
        saveImportConfig(config);
        setConnectionStatus('connected');
        addLog('Configuration saved', 'success');
    };

    const handleFetchData = async () => {
        if (!apiKey || !apiSecret || !startDate || !endDate) {
            addLog('Please fill in all required fields', 'error');
            return;
        }

        if (exchange === 'okx' && !passphrase) {
            addLog('OKX requires a passphrase', 'error');
            return;
        }

        setIsFetching(true);
        setProgress(0);
        setLogs([]);
        addLog(`Connecting to ${EXCHANGE_DISPLAY_NAMES[exchange]}...`, 'info');

        try {
            const response = await fetch('/api/import/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exchange,
                    apiKey,
                    apiSecret,
                    passphrase: exchange === 'okx' ? passphrase : undefined,
                    okxInstType: 'SWAP',
                    startDate,
                    endDate,
                    forceRefetch,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.message) {
                                // Check if it's the final result
                                if (data.message.includes('"done":true')) {
                                    const result = JSON.parse(data.message);
                                    addLog(`Import complete! ${result.result?.stats?.executions || 0} executions imported`, 'success', 100);
                                    setConnectionStatus('connected');
                                    setIsFetching(false);
                                    onDataFetched();
                                } else if (data.progress !== undefined) {
                                    addLog(data.message, data.type || 'info', data.progress);
                                } else {
                                    addLog(data.message, data.type || 'info');
                                }
                            }
                        } catch {
                            // Ignore parse errors for incomplete JSON
                        }
                    }
                }
            }
        } catch (error: any) {
            addLog(`Error: ${error.message}`, 'error');
            setConnectionStatus('error');
        } finally {
            setIsFetching(false);
        }
    };

    const currencyUnit = (exchange === 'binance' || exchange === 'okx' || exchange === 'bybit') ? 'USDT' : 'BTC';

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Key className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">API Connection</h3>
                        <p className="text-sm text-gray-600">Configure your trading platform API</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Connection Status */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50">
                        <div className={`w-2 h-2 rounded-full ${
                            connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                            connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
                        }`}></div>
                        <span className="text-sm text-gray-600">
                            {connectionStatus === 'connected' ? 'Connected' :
                             connectionStatus === 'error' ? 'Error' : 'Not Connected'}
                        </span>
                    </div>
                    {/* Quick Stats */}
                    {connectionStatus === 'connected' && totalTrades !== undefined && (
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                                <Activity className="w-4 h-4 text-blue-600" />
                                <span className="font-medium">{totalTrades.toLocaleString()}</span>
                                <span className="text-gray-400">trades</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4 text-green-600" />
                                <span className="font-medium">{avgTradesPerDay?.toFixed(1) || '-'}</span>
                                <span className="text-gray-400">/day</span>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        {showSettings ? <ChevronUp className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
                <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                    {/* Exchange Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Exchange
                        </label>
                        <select
                            value={exchange}
                            onChange={(e) => setExchange(e.target.value as ExchangeType)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                        >
                            {EXCHANGES.map((ex) => (
                                <option key={ex} value={ex}>
                                    {EXCHANGE_DISPLAY_NAMES[ex]}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* API Credentials */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                API Key
                            </label>
                            <input
                                type="text"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your API key"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                API Secret
                            </label>
                            <input
                                type="password"
                                value={apiSecret}
                                onChange={(e) => setApiSecret(e.target.value)}
                                placeholder="Enter your API secret"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>

                    {/* OKX Passphrase */}
                    {exchange === 'okx' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Passphrase (OKX only)
                            </label>
                            <input
                                type="password"
                                value={passphrase}
                                onChange={(e) => setPassphrase(e.target.value)}
                                placeholder="Enter your OKX passphrase"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                    )}

                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                End Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>

                    {/* Force Refetch */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="forceRefetch"
                            checked={forceRefetch}
                            onChange={(e) => setForceRefetch(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="forceRefetch" className="text-sm text-gray-700">
                            Force refetch (ignore cached data)
                        </label>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleSaveConfig}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            Save Config
                        </button>
                        <button
                            onClick={handleFetchData}
                            disabled={isFetching || !apiKey || !apiSecret || !startDate || !endDate}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isFetching ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Fetching...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4" />
                                    Fetch Data
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            {isFetching && (
                <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Progress</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* Logs */}
            {logs.length > 0 && (
                <div className="mt-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Activity Log</div>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto text-xs font-mono">
                        {logs.map((log, i) => (
                            <div key={i} className={`flex items-start gap-2 py-1 ${
                                log.type === 'error' ? 'text-red-600' :
                                log.type === 'success' ? 'text-green-600' :
                                log.type === 'warning' ? 'text-amber-600' : 'text-gray-600'
                            }`}>
                                <span className="text-gray-400">[{log.time}]</span>
                                <span>{log.message}</span>
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            )}
        </div>
    );
}
