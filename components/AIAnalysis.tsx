'use client';

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
    Bot,
    Sparkles,
    Loader2,
    AlertCircle,
    Settings,
    RefreshCw,
    CheckCircle2,
    Clock,
    Trash2,
    Key,
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff
} from 'lucide-react';
import {
    AIProvider,
    AISettings,
    AIModel,
    AI_PROVIDER_NAMES,
    AI_MODELS,
    DEFAULT_MODELS,
    loadAISettings,
    saveAISettings,
    getApiKeyForProvider,
    hasConfiguredProvider,
    TradingDataForAI
} from '@/lib/ai_types';
import { ExchangeType } from '@/lib/exchange_types';

interface AIAnalysisProps {
    stats: any;
    sessions: any[];
    exchange: ExchangeType;
}

export function AIAnalysis({ stats, sessions, exchange }: AIAnalysisProps) {
    const [settings, setSettings] = useState<AISettings | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openai');
    const [selectedModel, setSelectedModel] = useState<AIModel>('gpt-5.2');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [analysisTime, setAnalysisTime] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({
        openai: false,
        claude: false,
        gemini: false
    });

    // Local API key state for editing
    const [apiKeys, setApiKeys] = useState({
        openai: '',
        claude: '',
        gemini: ''
    });

    const ANALYSIS_STORAGE_KEY = `tradevoyage_ai_analysis_${exchange}`;

    // Load settings and previous analysis from localStorage
    useEffect(() => {
        const loaded = loadAISettings();
        setSettings(loaded);
        setSelectedProvider(loaded.selectedProvider);
        setSelectedModel(loaded.selectedModel || DEFAULT_MODELS[loaded.selectedProvider]);
        setApiKeys({
            openai: loaded.openaiApiKey || '',
            claude: loaded.claudeApiKey || '',
            gemini: loaded.geminiApiKey || ''
        });

        // Clear previous analysis state first when exchange changes
        setAnalysis(null);
        setAnalysisTime(null);
        setError(null);

        // Load previous analysis for this exchange
        try {
            const saved = localStorage.getItem(ANALYSIS_STORAGE_KEY);
            if (saved) {
                const { content, timestamp, provider } = JSON.parse(saved);
                setAnalysis(content);
                setAnalysisTime(timestamp);
                if (provider) setSelectedProvider(provider);
            }
        } catch (e) {
            console.error('Failed to load previous analysis:', e);
        }
    }, [exchange]);

    // Save API keys
    const saveApiKeys = () => {
        if (!settings) return;
        const newSettings: AISettings = {
            ...settings,
            openaiApiKey: apiKeys.openai,
            claudeApiKey: apiKeys.claude,
            geminiApiKey: apiKeys.gemini,
            selectedProvider,
            selectedModel
        };
        saveAISettings(newSettings);
        setSettings(newSettings);
    };

    // Prepare trading data for AI
    const prepareTradingData = (): TradingDataForAI => {
        const recentPositions = (sessions || []).slice(0, 20).map(s => ({
            symbol: s.displaySymbol || s.symbol,
            side: s.side as 'long' | 'short',
            pnl: s.realizedPnl || 0,
            duration: formatDuration(s.durationMs),
            maxSize: s.maxSize || 0,
        }));

        const monthlyPnl = (stats?.monthlyPnl || []).map((m: any) => ({
            month: m.month,
            pnl: m.pnl || 0,
        }));

        return {
            exchange,
            stats: {
                totalTrades: stats?.totalTrades || 0,
                winningTrades: stats?.winningTrades || 0,
                losingTrades: stats?.losingTrades || 0,
                winRate: stats?.winRate || 0,
                profitFactor: stats?.profitFactor || 0,
                avgWin: stats?.avgWin || 0,
                avgLoss: stats?.avgLoss || 0,
                totalRealizedPnl: stats?.totalRealizedPnl || 0,
                totalFunding: stats?.totalFunding || 0,
                totalFees: stats?.totalFees || 0,
                netPnl: stats?.netPnl || 0,
                tradingDays: stats?.tradingDays || 0,
            },
            recentPositions,
            monthlyPnl,
        };
    };

    const formatDuration = (ms: number): string => {
        if (!ms) return 'N/A';
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 24) {
            return `${Math.floor(hours / 24)}d ${hours % 24}h`;
        }
        return `${hours}h ${minutes}m`;
    };

    const runAnalysis = async () => {
        // Save keys first if changed
        saveApiKeys();

        if (!settings) return;

        const apiKey = getApiKeyForProvider(settings, selectedProvider);
        if (!apiKey) {
            setError(`請先配置 ${AI_PROVIDER_NAMES[selectedProvider]} API Key`);
            setShowSettings(true);
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        setAnalysis(null);
        setAnalysisTime(null);

        try {
            const tradingData = prepareTradingData();

            const response = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: selectedProvider,
                    model: selectedModel,
                    apiKey,
                    systemPrompt: settings.systemPrompt,
                    tradingData,
                }),
            });

            const result = await response.json();

            if (result.success) {
                const timestamp = new Date().toISOString();
                setAnalysis(result.analysis);
                setAnalysisTime(timestamp);

                try {
                    localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify({
                        content: result.analysis,
                        timestamp,
                        provider: selectedProvider,
                    }));
                } catch (e) {
                    console.error('Failed to save analysis:', e);
                }
            } else {
                setError(result.error || 'Analysis failed');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to connect to AI service');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const clearAnalysisHistory = () => {
        try {
            localStorage.removeItem(ANALYSIS_STORAGE_KEY);
            setAnalysis(null);
            setAnalysisTime(null);
        } catch (e) {
            console.error('Failed to clear analysis history:', e);
        }
    };

    const formatTimestamp = (isoString: string): string => {
        const date = new Date(isoString);
        return date.toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Check if any provider is configured
    const hasProvider = settings && hasConfiguredProvider(settings);
    const currentApiKey = settings ? getApiKeyForProvider(settings, selectedProvider) : '';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-200">
                        <Bot className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">AI Trading Analysis</h2>
                        <p className="text-sm text-gray-500">使用 AI 分析您的交易表現並獲得改進建議</p>
                    </div>
                </div>
            </div>

            {/* Provider Selection & Controls */}
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                AI Provider
                            </label>
                            <select
                                value={selectedProvider}
                                onChange={(e) => {
                                    const newProvider = e.target.value as AIProvider;
                                    setSelectedProvider(newProvider);
                                    setSelectedModel(DEFAULT_MODELS[newProvider]);
                                }}
                                className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                                disabled={isAnalyzing}
                            >
                                <option value="openai">OpenAI</option>
                                <option value="claude">Anthropic Claude</option>
                                <option value="gemini">Google Gemini</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Model
                            </label>
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value as AIModel)}
                                className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors min-w-[180px]"
                                disabled={isAnalyzing}
                            >
                                {AI_MODELS[selectedProvider].map(model => (
                                    <option key={model.id} value={model.id}>
                                        {model.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status indicator */}
                        <div className="flex items-center gap-2 mt-5">
                            {currentApiKey ? (
                                <span className="flex items-center gap-1.5 text-emerald-600 text-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                    已配置
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 text-amber-600 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    未配置
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                        >
                            <Key className="w-4 h-4" />
                            API Key
                            {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        <button
                            onClick={runAnalysis}
                            disabled={isAnalyzing || !currentApiKey}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isAnalyzing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    分析中...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    分析我的交易
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* API Key Settings Panel */}
                {showSettings && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Key className="w-4 h-4 text-purple-600" />
                            API Key 配置
                        </h3>
                        <div className="space-y-4">
                            {/* OpenAI */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    OpenAI API Key (GPT-4)
                                </label>
                                <div className="relative">
                                    <input
                                        type={showApiKeys.openai ? 'text' : 'password'}
                                        value={apiKeys.openai}
                                        onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
                                        placeholder="sk-..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKeys({ ...showApiKeys, openai: !showApiKeys.openai })}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showApiKeys.openai ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Get your key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-purple-600 hover:underline">platform.openai.com</a>
                                </p>
                            </div>

                            {/* Claude */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Anthropic API Key (Claude)
                                </label>
                                <div className="relative">
                                    <input
                                        type={showApiKeys.claude ? 'text' : 'password'}
                                        value={apiKeys.claude}
                                        onChange={(e) => setApiKeys({ ...apiKeys, claude: e.target.value })}
                                        placeholder="sk-ant-..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKeys({ ...showApiKeys, claude: !showApiKeys.claude })}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showApiKeys.claude ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Get your key at <a href="https://console.anthropic.com/" target="_blank" rel="noopener" className="text-purple-600 hover:underline">console.anthropic.com</a>
                                </p>
                            </div>

                            {/* Gemini */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Google Gemini API Key
                                </label>
                                <div className="relative">
                                    <input
                                        type={showApiKeys.gemini ? 'text' : 'password'}
                                        value={apiKeys.gemini}
                                        onChange={(e) => setApiKeys({ ...apiKeys, gemini: e.target.value })}
                                        placeholder="AIza..."
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKeys({ ...showApiKeys, gemini: !showApiKeys.gemini })}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showApiKeys.gemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Get your key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" className="text-purple-600 hover:underline">aistudio.google.com</a>
                                </p>
                            </div>

                            <button
                                onClick={saveApiKeys}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                            >
                                保存 API Keys
                            </button>
                        </div>
                    </div>
                )}

                {/* Trading Stats Preview */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-3">將分析以下數據：</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">總交易</p>
                            <p className="text-lg font-bold text-gray-900">{stats?.totalTrades || 0}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">勝率</p>
                            <p className="text-lg font-bold text-gray-900">{(stats?.winRate || 0).toFixed(1)}%</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">盈虧比</p>
                            <p className="text-lg font-bold text-gray-900">{(stats?.profitFactor || 0).toFixed(2)}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">倉位數</p>
                            <p className="text-lg font-bold text-gray-900">{sessions?.length || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-white rounded-lg shadow p-4 border border-rose-200 bg-rose-50">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5" />
                        <div>
                            <p className="font-medium text-rose-700">分析失敗</p>
                            <p className="text-sm text-rose-600 mt-1">{error}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isAnalyzing && (
                <div className="bg-white rounded-lg shadow p-8 border border-purple-200">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
                            <Bot className="w-8 h-8 text-purple-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-medium text-gray-900">AI 正在分析您的交易...</p>
                            <p className="text-sm text-gray-500 mt-1">這可能需要 10-30 秒</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Analysis Result */}
            {analysis && !isAnalyzing && (
                <div className="bg-white rounded-lg shadow border border-purple-200 overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-600" />
                                <h3 className="font-semibold text-gray-900">AI 分析報告</h3>
                                {analysisTime && (
                                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                        <Clock className="w-3 h-3" />
                                        {formatTimestamp(analysisTime)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={clearAnalysisHistory}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    清除
                                </button>
                                <button
                                    onClick={runAnalysis}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm transition-colors"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    重新分析
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="ai-analysis-content prose prose-sm max-w-none">
                            <ReactMarkdown
                                components={{
                                    h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 text-gray-900">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-xl font-bold mt-6 mb-3 text-gray-900">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-lg font-semibold mt-5 mb-2 text-gray-900">{children}</h3>,
                                    h4: ({ children }) => <h4 className="text-base font-semibold mt-4 mb-2 text-gray-900">{children}</h4>,
                                    p: ({ children }) => <p className="mb-3 text-gray-600 leading-relaxed">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-4 text-gray-600">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-4 text-gray-600">{children}</ol>,
                                    li: ({ children }) => <li className="text-gray-600">{children}</li>,
                                    strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                                    em: ({ children }) => <em className="italic text-purple-600">{children}</em>,
                                    blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-purple-500 pl-4 my-4 italic text-gray-600 bg-purple-50 py-2 rounded-r">
                                            {children}
                                        </blockquote>
                                    ),
                                    code: ({ children }) => (
                                        <code className="px-1.5 py-0.5 rounded bg-gray-100 text-purple-600 text-sm font-mono">
                                            {children}
                                        </code>
                                    ),
                                    hr: () => <hr className="my-6 border-gray-200" />,
                                }}
                            >
                                {analysis}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>
            )}

            {/* No Provider Configured */}
            {!hasProvider && !isAnalyzing && !analysis && (
                <div className="bg-white rounded-lg shadow p-6 border border-amber-200 bg-amber-50">
                    <div className="flex items-center justify-center gap-3 text-center">
                        <Key className="w-5 h-5 text-amber-600" />
                        <p className="text-gray-700">
                            尚未配置 API Key，請點擊上方 <span className="font-medium text-amber-700">"API Key"</span> 按鈕進行配置
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
