import { definePlugin, toaster, DialogButton, SliderField, ToggleField, TextField, DropdownItem, IconsModule } from '@steambrew/client';
import { useState, useEffect, Fragment } from 'react';
import { log } from './log';
import { resolveSoundEType, SOUND_ON_ETYPE_OPTIONS, SOUND_OFF_ETYPE_OPTIONS } from './eTypes';
import { Tier, settings, loadSettings, persistSettings, getEveryNForMax } from './settings';

type AchievementEntry = {
	strID: string;
	strName: string;
	strDescription: string;
	strImage: string;
	bAchieved: boolean;
	flCurrentProgress: number;
	flMaxProgress: number;
};

const MIN_POLL_SECONDS = 1;
const MAX_POLL_SECONDS = 60;
const POLL_STEP_SECONDS = 1;

// ---- toast dispatch ----
const fireToast = (title: string, body: string, iconUrl?: string) => {
	// eType is set through the sound settings, since they are the only reliable way to silence a toast
	const eType = resolveSoundEType(settings.playSound, settings.soundOnEType, settings.soundOffEType);
	const toastData: Record<string, unknown> & Parameters<typeof toaster.toast>[0] = {
		title,
		body,
		logo: iconUrl ? (
			<img
				src={iconUrl}
				alt=""
				style={{ width: '48px', height: '48px', objectFit: 'cover', flexShrink: 0, display: 'block' }}
			/>
		) : undefined,
		eType,
		sound: settings.playSound ? 6 : 0,
		playSound: settings.playSound,
		critical: settings.playSound,
	};

	toaster.toast(toastData);
};

// ---- achievement polling ----
let pollTimer: number | undefined;
// Stores the last progress value seen per achievement
let lastSeenProgress: Record<string, number> = {};
let currentAppId: number | undefined;

const pollAchievements = async (appId: number) => {
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
};

const stopPolling = () => {
	if (pollTimer) {
		window.clearInterval(pollTimer);
		pollTimer = undefined;
	}
};

const startPolling = (appId: number) => {
	currentAppId = appId;
	lastSeenProgress = {};
	stopPolling();
	pollAchievements(appId).then();
	pollTimer = window.setInterval(() => pollAchievements(appId), settings.pollIntervalMs);
};

const restartPollingIfActive = () => {
	if (currentAppId === undefined) return;
	stopPolling();
	const appId = currentAppId;
	pollTimer = window.setInterval(() => pollAchievements(appId), settings.pollIntervalMs);
};

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

	const labelStyle = { fontSize: '12px', color: '#8f98a0', fontWeight: 600, textTransform: 'uppercase' as const };

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
			<div style={{ display: 'grid', gridTemplateColumns: '120px 120px auto', columnGap: '8px', rowGap: '4px', alignItems: 'stretch' }}>
				<div style={labelStyle}>Max value</div>
				<div style={labelStyle}>Every n</div>
				<div />
				{tiers.map((tier, i) => (
					<Fragment key={i}>
						<div style={{ width: '120px', overflow: 'hidden' }}>
							<TextField
								mustBeNumeric
								value={String(tier.maxValue)}
								onChange={(e) => updateTier(i, 'maxValue', e.target.value)}
							/>
						</div>
						<div style={{ width: '120px', overflow: 'hidden' }}>
							<TextField
								mustBeNumeric
								value={String(tier.everyN)}
								onChange={(e) => updateTier(i, 'everyN', e.target.value)}
							/>
						</div>
						<DialogButton
							onClick={() => removeTier(i)}
							style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
						>
							X
						</DialogButton>
					</Fragment>
				))}
			</div>
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
	const [soundOnEType, setSoundOnEType] = useState(settings.soundOnEType);
	const [soundOffEType, setSoundOffEType] = useState(settings.soundOffEType);
	const [showAdvanced, setShowAdvanced] = useState(false);

	useEffect(() => {
		loadSettings().then((loaded) => {
			setPollIntervalMs(loaded.pollIntervalMs);
			setPlaySound(loaded.playSound);
			setTiers(loaded.tiers);
			setSoundOnEType(loaded.soundOnEType);
			setSoundOffEType(loaded.soundOffEType);
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
				description=""
				checked={playSound}
				onChange={(checked: boolean) => {
					setPlaySound(checked);
					persistSettings({ ...settings, playSound: checked }).then();
				}}
			/>
			<DialogButton onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? 'Hide advanced sound settings' : 'Show advanced sound settings'}</DialogButton>
			{showAdvanced && (
				<>
					<DropdownItem
						label="Sound-on notification type"
						description="Which notification type is used when the sound toggle above is on."
						rgOptions={SOUND_ON_ETYPE_OPTIONS}
						selectedOption={soundOnEType}
						onChange={({ data }: { data: number }) => {
							setSoundOnEType(data);
							persistSettings({ ...settings, soundOnEType: data }).then();
						}}
					/>
					<DropdownItem
						label="Sound-off notification type"
						description="Which notification type is used when the sound toggle above is off."
						rgOptions={SOUND_OFF_ETYPE_OPTIONS}
						selectedOption={soundOffEType}
						onChange={({ data }: { data: number }) => {
							setSoundOffEType(data);
							persistSettings({ ...settings, soundOffEType: data }).then();
						}}
					/>
				</>
			)}
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
			<DialogButton onClick={() => fireToast('PAN test toast', '2/20')}>Fire test toast</DialogButton>
		</div>
	);
};

// noinspection JSUnusedGlobalSymbols
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
		onDismount: () => {
			unregisterAchievement.unregister();
			unregisterLifetime.unregister();
			stopPolling();
		},
	};
});
