import { definePlugin, toaster, DialogButton, SliderField, ToggleField, TextField, IconsModule, callable } from '@steambrew/client';
import { useState, useEffect } from 'react';

function log(...args: unknown[]) {
	console.log('[PAN]', ...args);
}

interface AchievementEntry {
	strID: string;
	strName: string;
	strDescription: string;
	strImage: string;
	bAchieved: boolean;
	flCurrentProgress: number;
	flMaxProgress: number;
}

// A tier covers achievements with max progress at or below maxValue.
// Tiers sort low to high. Each tier covers the range above the previous tier's maxValue.
// A toast fires when progress crosses or lands on a multiple of everyN.
// Progress above the largest maxValue uses the largest tier's everyN.
// With no tiers set, everyN is 1. Then every change toasts.
interface Tier {
	maxValue: number;
	everyN: number;
}

interface Settings {
	pollIntervalMs: number;
	playSound: boolean;
	tiers: Tier[];
}

const DEFAULT_TIERS: Tier[] = [
	{ maxValue: 100, everyN: 1 },
	{ maxValue: 1000, everyN: 10 },
	{ maxValue: 10000, everyN: 100 },
	{ maxValue: 100000, everyN: 1000 },
];

const DEFAULT_SETTINGS: Settings = {
	pollIntervalMs: 5000,
	playSound: false,
	tiers: DEFAULT_TIERS,
};

function getEveryNForMax(tiers: Tier[], maxProgress: number): number {
	const sorted = [...tiers].sort((a, b) => a.maxValue - b.maxValue);
	for (const tier of sorted) {
		if (maxProgress <= tier.maxValue) return tier.everyN;
	}
	return sorted.length > 0 ? sorted[sorted.length - 1].everyN : 1;
}

const MIN_POLL_SECONDS = 1;
const MAX_POLL_SECONDS = 60;
const POLL_STEP_SECONDS = 1;

// ---- backend RPC (Lua) ----
const GetSettingsRpc = callable<[], string>('GetSettings');
const SaveSettingsRpc = callable<[{ settings_json: string }], string>('SaveSettings');

let settings: Settings = { ...DEFAULT_SETTINGS };

async function loadSettings(): Promise<Settings> {
	try {
		const raw = await GetSettingsRpc();
		const result = JSON.parse(raw ?? '{}');
		if (result?.success && result?.data) {
			settings = { ...DEFAULT_SETTINGS, ...result.data };
			if (!Array.isArray(settings.tiers)) {
				settings.tiers = [];
			}
		}
	} catch (e) {
		log('failed to load settings from backend, using defaults', e);
	}
	return settings;
}

async function persistSettings(next: Settings) {
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
}

// ---- toast dispatch ----
function fireToast(title: string, body: string, iconUrl?: string) {
	toaster.toast({
		title,
		body,
		logo: iconUrl ? (
			<img
				src={iconUrl}
				alt=""
				style={{ width: '48px', height: '48px', objectFit: 'cover', flexShrink: 0, display: 'block' }}
			/>
		) : undefined,
		sound: 0,
		playSound: false,
	});
}

// ---- achievement polling ----
let pollTimer: number | undefined;
// Stores the last progress value seen per achievement
let lastSeenProgress: Record<string, number> = {};
let currentAppId: number | undefined;

async function pollAchievements(appId: number) {
	try {
		const res = (await SteamClient.Apps.GetMyAchievementsForApp(String(appId))) as unknown as {
			data: { rgAchievements: AchievementEntry[] };
		};
		const list = res?.data?.rgAchievements ?? [];
		log(`poll appid=${appId}: ${list.length} achievements`);

		for (const a of list) {
			if (a.flMaxProgress <= 0 || a.bAchieved) continue;

			const previous = lastSeenProgress[a.strID];
			lastSeenProgress[a.strID] = a.flCurrentProgress;

			if (previous === undefined) {
				// First time this achievement came up this session. Do not notify.
				continue;
			}
			if (previous === a.flCurrentProgress) continue;

			const everyN = getEveryNForMax(settings.tiers, a.flMaxProgress);
			if (everyN > 0 && Math.floor(a.flCurrentProgress / everyN) !== Math.floor(previous / everyN)) {
				log('PROGRESS CHANGED', a.strID, previous, '->', a.flCurrentProgress, '/', a.flMaxProgress, `(everyN=${everyN})`);
				fireToast(a.strName, `${a.flCurrentProgress}/${a.flMaxProgress}`, a.strImage);
			}
		}
	} catch (e) {
		log('poll error', e);
	}
}

function stopPolling() {
	if (pollTimer) {
		window.clearInterval(pollTimer);
		pollTimer = undefined;
	}
}

function startPolling(appId: number) {
	currentAppId = appId;
	lastSeenProgress = {};
	stopPolling();
	pollAchievements(appId).then();
	pollTimer = window.setInterval(() => pollAchievements(appId), settings.pollIntervalMs);
}

function restartPollingIfActive() {
	if (currentAppId === undefined) return;
	stopPolling();
	const appId = currentAppId;
	pollTimer = window.setInterval(() => pollAchievements(appId), settings.pollIntervalMs);
}

// ---- tier list UI ----
const TierList = ({ tiers, onChange }: { tiers: Tier[]; onChange: (tiers: Tier[]) => void }) => {
	const updateTier = (index: number, field: keyof Tier, raw: string) => {
		const value = Number(raw);
		if (Number.isNaN(value)) return;
		onChange(tiers.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
	};

	const removeTier = (index: number) => {
		onChange(tiers.filter((_, i) => i !== index));
	};

	const addTier = () => {
		onChange([...tiers, { maxValue: 0, everyN: 1 }]);
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
			{tiers.map((tier, i) => (
				<div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
					<div style={{ flex: 1 }}>
						<TextField
							label={i === 0 ? 'Max value' : undefined}
							mustBeNumeric
							value={String(tier.maxValue)}
							onChange={(e) => updateTier(i, 'maxValue', e.target.value)}
						/>
					</div>
					<div style={{ flex: 1 }}>
						<TextField
							label={i === 0 ? 'Every n' : undefined}
							mustBeNumeric
							value={String(tier.everyN)}
							onChange={(e) => updateTier(i, 'everyN', e.target.value)}
						/>
					</div>
					<DialogButton onClick={() => removeTier(i)}>X</DialogButton>
				</div>
			))}
			<DialogButton onClick={addTier}>Add tier</DialogButton>
			<div style={{ fontSize: '11px', color: '#8f98a0' }}>
				Applied ascending by max value, each tier covering everything above the previous tier's max
			</div>
		</div>
	);
};

// ---- settings UI ----
const SettingsContent = () => {
	const [ready, setReady] = useState(false);
	const [pollIntervalMs, setPollIntervalMs] = useState(settings.pollIntervalMs);
	const [playSound, setPlaySound] = useState(settings.playSound);
	const [tiers, setTiers] = useState<Tier[]>(settings.tiers);

	useEffect(() => {
		loadSettings().then((loaded) => {
			setPollIntervalMs(loaded.pollIntervalMs);
			setPlaySound(loaded.playSound);
			setTiers(loaded.tiers);
			setReady(true);
		});
	}, []);

	if (!ready) {
		return <div style={{ padding: '10px' }}>Loading settings...</div>;
	}

	return (
		<div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
			<SliderField
				label="Poll interval"
				description="How often to check for achievement progress while a game is running."
				value={Math.round(pollIntervalMs / 1000)}
				min={MIN_POLL_SECONDS}
				max={MAX_POLL_SECONDS}
				step={POLL_STEP_SECONDS}
				showValue
				editableValue
				valueSuffix="s"
				onChange={(seconds: number) => {
					const ms = seconds * 1000;
					setPollIntervalMs(ms);
					const next = { ...settings, pollIntervalMs: ms };
					persistSettings(next).then();
					restartPollingIfActive();
				}}
			/>
			<ToggleField
				label="Play notification sound"
				description="Off by default."
				checked={playSound}
				onChange={(checked: boolean) => {
					setPlaySound(checked);
					persistSettings({ ...settings, playSound: checked }).then();
				}}
			/>
			<div style={{ marginTop: '8px', fontWeight: 600 }}>Notification thresholds</div>
			<div style={{ fontSize: '11px', color: '#8f98a0', marginBottom: '4px' }}>
				E.g. max value 100, every 1 -&gt; achievements with 100 or fewer total steps toast on every change.
			</div>
			<TierList
				tiers={tiers}
				onChange={(next) => {
					setTiers(next);
					persistSettings({ ...settings, tiers: next }).then();
				}}
			/>
			<DialogButton onClick={() => fireToast('PAN test toast', 'Chickens 2/20')}>Fire test toast now</DialogButton>
		</div>
	);
};

export default definePlugin(() => {
	log('plugin loading');

	loadSettings().then();

	const unregisterAchievement = SteamClient.GameSessions.RegisterForAchievementNotification((notification) => {
		log('RegisterForAchievementNotification fired (bonus/fast-path):', JSON.stringify(notification));
	});

	const unregisterLifetime = SteamClient.GameSessions.RegisterForAppLifetimeNotifications((notification) => {
		log('RegisterForAppLifetimeNotifications fired:', JSON.stringify(notification));

		if (notification.bRunning) {
			startPolling(notification.unAppID);
		} else if (notification.unAppID === currentAppId) {
			stopPolling();
			currentAppId = undefined;
		}
	});

	return {
		title: <div>Partial Achievement Notifications</div>,
		titleView: <div>Partial Achievement Notifications</div>,
		content: <SettingsContent />,
		icon: <IconsModule.Settings />,
		onDismount() {
			unregisterAchievement.unregister();
			unregisterLifetime.unregister();
			stopPolling();
		},
	};
});
