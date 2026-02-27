import { ExchangeType } from './exchange_types';

export interface ImportConfig {
    exchange: ExchangeType;
    apiKey: string;
    apiSecret: string;
    passphrase: string;
    okxInstType: 'SWAP' | 'FUTURES' | 'MARGIN' | 'ALL';
    startDate: string;
    endDate: string;
    forceRefetch: boolean;
}

export interface StoredImportConfig extends ImportConfig {
    savedAt: string;
}

export const IMPORT_SETTINGS_KEY = 'tradevoyage.import_settings_v1';
export const IMPORT_REMEMBER_KEY = 'tradevoyage.import_remember_v1';

function safeLocalStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

export function loadImportConfig(): StoredImportConfig | null {
    const storage = safeLocalStorage();
    if (!storage) return null;
    const raw = storage.getItem(IMPORT_SETTINGS_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as StoredImportConfig;
    } catch {
        return null;
    }
}

export function saveImportConfig(config: ImportConfig): StoredImportConfig | null {
    const storage = safeLocalStorage();
    if (!storage) return null;
    const payload: StoredImportConfig = {
        ...config,
        savedAt: new Date().toISOString(),
    };
    storage.setItem(IMPORT_SETTINGS_KEY, JSON.stringify(payload));
    return payload;
}

export function clearImportConfig(): void {
    const storage = safeLocalStorage();
    if (!storage) return;
    storage.removeItem(IMPORT_SETTINGS_KEY);
}

export function loadRememberChoice(): boolean {
    const storage = safeLocalStorage();
    if (!storage) return false;
    return storage.getItem(IMPORT_REMEMBER_KEY) === 'true';
}

export function saveRememberChoice(remember: boolean): void {
    const storage = safeLocalStorage();
    if (!storage) return;
    storage.setItem(IMPORT_REMEMBER_KEY, remember ? 'true' : 'false');
}
