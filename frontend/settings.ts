import { callable } from '@steambrew/client';
import { log } from './log';
import { ETYPE_UNSET, SOUND_ON_ETYPES, SOUND_OFF_ETYPES } from './eTypes';

// A tier covers achievements with max progress at or below maxValue.
// Tiers sort low to high. Each tier covers the range above the previous tier's maxValue.
// A toast fires when progress crosses or lands on a multiple of everyN.
// Progress above the largest maxValue uses the largest tier's everyN.
// With no tiers set, everyN is 1. Then every change toasts.
export type Tier = {
	maxValue: number;
	everyN: number;
};

export type Settings = {
	pollIntervalMs: number;
	playSound: boolean;
	soundOnEType: number;
	soundOffEType: number;
	tiers: Tier[];
};

const DEFAULT_TIERS: Tier[] = [
	{ maxValue: 100, everyN: 1 },
	{ maxValue: 1000, everyN: 10 },
	{ maxValue: 10000, everyN: 100 },
	{ maxValue: 100000, everyN: 1000 },
];

export const DEFAULT_SETTINGS: Settings = {
	pollIntervalMs: 2000,
	tiers: DEFAULT_TIERS,
	playSound: false,
	soundOnEType: ETYPE_UNSET,
	soundOffEType: ETYPE_UNSET,
};

export const getEveryNForMax = (tiers: Tier[], maxProgress: number): number => {
	const sorted = [...tiers].sort((a, b) => a.maxValue - b.maxValue);
	for (const tier of sorted) {
		if (maxProgress <= tier.maxValue) return tier.everyN;
	}
	return sorted.length > 0 ? sorted[sorted.length - 1].everyN : 1;
};

const GetSettingsRpc = callable<[], string>('GetSettings');
const SaveSettingsRpc = callable<[{ settings_json: string }], string>('SaveSettings');

export let settings: Settings = { ...DEFAULT_SETTINGS };

export const loadSettings = async (): Promise<Settings> => {
	try {
		const raw = await GetSettingsRpc();
		const result = JSON.parse(raw ?? '{}');
		if (result?.success && result?.data) {
			settings = { ...DEFAULT_SETTINGS, ...result.data };
			if (!Array.isArray(settings.tiers)) {
				settings.tiers = [];
			}
			if (settings.soundOnEType !== ETYPE_UNSET && !SOUND_ON_ETYPES.some((o) => o.data === settings.soundOnEType)) {
				settings.soundOnEType = ETYPE_UNSET;
			}
			if (settings.soundOffEType !== ETYPE_UNSET && !SOUND_OFF_ETYPES.some((o) => o.data === settings.soundOffEType)) {
				settings.soundOffEType = ETYPE_UNSET;
			}
		}
	} catch (e) {
		log('failed to load settings from backend, using defaults', e);
	}
	return settings;
};

export const persistSettings = async (next: Settings) => {
	settings = next;
	try {
		const raw = await SaveSettingsRpc({ settings_json: JSON.stringify(next) });
		const result = JSON.parse(raw ?? '{}');
		if (!result?.success) {
			log('backend rejected settings save', result?.error);
		}
	} catch (e) {
		log('failed to save settings to backend', e);
	}
};
