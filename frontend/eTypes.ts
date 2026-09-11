// Additional ETYPES / Notes
// ETypes which resulted in an error: RedeemFramePromo(67), RestartNeeded(66), LoggedInAsUser(65), PeerContentUpload(25)
// ETypes which behaved differently: TimerExpired(38) has a different sound, OverlaySplashScreen(33) renders not in the correct position
// ETypes which sound can be controlled by Steams Notification settings: Achievement, ControllerConnected/Disconnected, ControllerLowBattery
// ETypes which sound SHOULD be controlled by Steams Notification settings: FriendInGame, FriendOnline, FriendMessage, GroupChatMessage

export const ETYPE_UNSET = -1; // not a real EClientNotificationType value - sentinel for "no override set"

// These ETYPES always play a sound when used for a toast
export const SOUND_ON_ETYPES = [
	{ data: 31, label: 'General' },
	{ data: 0, label: 'Invalid' },
	{ data: 1, label: 'DownloadCompleted' },
	{ data: 6, label: 'LowBattery' },
	{ data: 7, label: 'SystemUpdate' },
	{ data: 12, label: 'FamilySharingStopPlaying' },
	{ data: 15, label: 'CloudSyncFailure' },
	{ data: 16, label: 'CloudSyncConflict' },
	{ data: 18, label: 'ClaimSteamDeckRewards' },
	{ data: 19, label: 'GiftReceived' },
	{ data: 20, label: 'ItemAnnouncement' },
	{ data: 21, label: 'HardwareSurvey' },
	{ data: 22, label: 'LowDiskSpace' },
	{ data: 23, label: 'BatteryTemperature' },
	{ data: 24, label: 'DockUnsupportedFirmware' },
	{ data: 26, label: 'CannotReadControllerGuideButton' },
	{ data: 27, label: 'Comment' },
	{ data: 28, label: 'Wishlist' },
	{ data: 29, label: 'TradeOffer' },
	{ data: 30, label: 'AsyncGame' },
	{ data: 32, label: 'HelpRequest' },
	{ data: 35, label: 'TimedTrialRemaining' },
	{ data: 36, label: 'LoginRefresh' },
	{ data: 37, label: 'MajorSale' },
	{ data: 39, label: 'ModeratorMsg' },
	{ data: 42, label: 'RemoteClientStartStream' },
	{ data: 44, label: 'FamilyInvite' },
	{ data: 45, label: 'PlaytimeWarning' },
	{ data: 46, label: 'FamilyPurchaseRequest' },
	{ data: 47, label: 'FamilyPurchaseRequestResponse' },
	{ data: 48, label: 'ParentalFeatureRequest' },
	{ data: 49, label: 'ParentalPlaytimeRequest' },
	{ data: 50, label: 'GameRecordingError' },
	{ data: 51, label: 'ParentalFeatureResponse' },
	{ data: 52, label: 'ParentalPlaytimeResponse' },
	{ data: 53, label: 'RequestedGameAdded' },
	{ data: 54, label: 'ClipDownloaded' },
	{ data: 59, label: 'PlaytestInvite' },
	{ data: 60, label: 'TradeReversal' },
	{ data: 61, label: 'HardwareUpdateAvailable' },
];

// These ETYPES never play a sound when used for a toast
export const SOUND_OFF_ETYPES = [
	{ data: 57, label: 'GameRecordingUserMarkerAdded' },
	{ data: 55, label: 'GameRecordingStart' },
	{ data: 56, label: 'GameRecordingStop' },
	{ data: 58, label: 'GameRecordingInstantClip' },
	{ data: 2, label: 'FriendInvite' },
	{ data: 10, label: 'FriendInviteRollup' },
	{ data: 14, label: 'Screenshot' },
	{ data: 17, label: 'IncomingVoiceChat' },
	{ data: 34, label: 'BroadcastAvailableToWatch' },
	{ data: 40, label: 'SteamInputActionSetChanged' },
	{ data: 41, label: 'RemoteClientConnection' },
	{ data: 43, label: 'StreamingClientConnection' },
];

export const DEFAULT_SOUND_ON_ETYPE = 31; // General
export const DEFAULT_SOUND_OFF_ETYPE = 57; // GameRecordingUserMarkerAdded

const withDefaultOption = (pool: { data: number; label: string }[], defaultEType: number) => {
	const defaultLabel = pool.find((o) => o.data === defaultEType)?.label ?? String(defaultEType);
	return [{ data: ETYPE_UNSET, label: `Default (${defaultLabel})` }, ...pool];
};

export const SOUND_ON_ETYPE_OPTIONS = withDefaultOption(SOUND_ON_ETYPES, DEFAULT_SOUND_ON_ETYPE);
export const SOUND_OFF_ETYPE_OPTIONS = withDefaultOption(SOUND_OFF_ETYPES, DEFAULT_SOUND_OFF_ETYPE);

export const resolveSoundEType = (playSound: boolean, soundOnEType: number, soundOffEType: number): number => {
	if (playSound) {
		return soundOnEType !== ETYPE_UNSET ? soundOnEType : DEFAULT_SOUND_ON_ETYPE;
	}
	return soundOffEType !== ETYPE_UNSET ? soundOffEType : DEFAULT_SOUND_OFF_ETYPE;
};
