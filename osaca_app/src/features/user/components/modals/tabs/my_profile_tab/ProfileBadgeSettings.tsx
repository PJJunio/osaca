// SPDX-License-Identifier: AGPL-3.0-or-later

import {SettingsSection} from '@app/features/app/components/dialogs/shared/SettingsSection';
import {TRY_AGAIN_DESCRIPTOR} from '@app/features/i18n/utils/CommonMessageDescriptors';
import {remFromPx} from '@app/features/theme/layout/RemFromPx';
import {Button} from '@app/features/ui/button/Button';
import {Input} from '@app/features/ui/components/form/FormInput';
import {Switch} from '@app/features/ui/components/form/FormSwitch';
import {Spinner} from '@app/features/ui/components/Spinner';
import {PROFILE_BADGES_SECTION_ID} from '@app/features/user/commands/UserSettingsModalCommands';
import styles from '@app/features/user/components/modals/tabs/my_profile_tab/ProfileBadgeSettings.module.css';
import type {ProfileBadgePreviewState} from '@app/features/user/hooks/useOwnProfileBadges';
import {profileBadgeImageUrl} from '@app/features/user/utils/ProfileUtils';
import {PROFILE_BADGES_DESCRIPTOR} from '@app/features/user/utils/UserMessageDescriptors';
import type {OwnProfileBadgeResponse} from '@osaca/schema/src/domains/user/ProfileBadgeSchemas';
import {msg} from '@lingui/core/macro';
import {useLingui} from '@lingui/react/macro';
import {MagnifyingGlassIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {type ReactNode, useId, useState} from 'react';

const BADGES_DESCRIPTION_DESCRIPTOR = msg({
	message: 'Choose which badges other people see on your profile.',
	comment:
		'Description under the "Badges" title in profile settings. Each badge in the list has a switch that shows or hides it for other people.',
});
const NO_BADGES_DESCRIPTOR = msg({
	message: "You don't have any badges yet.",
	comment: 'Shown in the "Badges" profile settings section when you hold no badges.',
});
const BADGES_LOAD_FAILED_DESCRIPTOR = msg({
	message: "Your badges couldn't be loaded.",
	comment:
		'Shown in the "Badges" profile settings section when the list of badges fails to load, next to a "Try again" button.',
});
const SHOW_BADGE_DESCRIPTOR = msg({
	message: 'Show {badgeLabel} on your profile',
	comment:
		'Screen reader label for the switch next to one badge in the "Badges" profile settings. {badgeLabel} is the badge name, such as "OSACA Staff" or "Operator Pass since November 14, 2026".',
});
const FILTER_BADGES_DESCRIPTOR = msg({
	message: 'Filter badges',
	comment:
		'Placeholder and screen reader label of the text field above a long list of badges in the "Badges" profile settings. Typing in it shows only the badges whose name holds the text.',
});
const NO_BADGES_MATCH_DESCRIPTOR = msg({
	message: 'No badges match.',
	comment:
		'Shown under the badge filter in the "Badges" profile settings when the typed text matches none of your badges.',
});
const BADGE_FILTER_RESULTS_DESCRIPTOR = msg({
	message: '{count, plural, one {# badge matches} other {# badges match}}',
	comment:
		'Read out by screen readers while typing in the badge filter of the "Badges" profile settings, with the number of badges that match.',
});
const FILTER_THRESHOLD = 20;
interface ProfileBadgeSettingsProps {
	preview: ProfileBadgePreviewState;
	hiddenProfileBadges: ReadonlyArray<string>;
	disabled: boolean;
	onToggleHidden: (key: string, hidden: boolean) => void;
}

function BadgeArt({badge}: {badge: OwnProfileBadgeResponse}) {
	const imageUrl = profileBadgeImageUrl(badge);
	if (imageUrl === null) {
		return (
			<span className={styles.caption} aria-hidden="true" data-flx="user.profile-badge-settings.caption">
				{badge.caption}
			</span>
		);
	}
	return (
		<img
			src={imageUrl}
			alt=""
			decoding="async"
			className={styles.art}
			style={badge.aspect_ratio ? {width: 'auto', aspectRatio: badge.aspect_ratio} : undefined}
			data-flx="user.profile-badge-settings.art"
		/>
	);
}

function BadgeList({
	ownBadges,
	hiddenProfileBadges,
	disabled,
	onToggleHidden,
}: Omit<ProfileBadgeSettingsProps, 'preview'> & {ownBadges: ReadonlyArray<OwnProfileBadgeResponse>}) {
	const {i18n} = useLingui();
	const hidden = new Set(hiddenProfileBadges);
	const switchIdPrefix = useId();
	const [filter, setFilter] = useState('');
	const needle = filter.trim().toLocaleLowerCase();
	const filtered =
		needle === '' ? ownBadges : ownBadges.filter((badge) => badge.label.toLocaleLowerCase().includes(needle));
	return (
		<>
			{ownBadges.length > FILTER_THRESHOLD && (
				<div className={styles.filter} data-flx="user.profile-badge-settings.filter">
					<Input
						placeholder={i18n._(FILTER_BADGES_DESCRIPTOR)}
						leftIcon={
							<MagnifyingGlassIcon
								size={remFromPx(16)}
								weight="bold"
								data-flx="user.profile-badge-settings.filter-icon"
							/>
						}
						value={filter}
						onChange={(event) => setFilter(event.target.value)}
						aria-label={i18n._(FILTER_BADGES_DESCRIPTOR)}
						data-flx="user.profile-badge-settings.filter-input"
					/>
					<span className={styles.srOnly} aria-live="polite" data-flx="user.profile-badge-settings.filter-results">
						{needle === '' ? '' : i18n._(BADGE_FILTER_RESULTS_DESCRIPTOR, {count: filtered.length})}
					</span>
				</div>
			)}
			{filtered.length === 0 && (
				<p className={styles.note} data-flx="user.profile-badge-settings.no-match">
					{i18n._(NO_BADGES_MATCH_DESCRIPTOR)}
				</p>
			)}
			<ul className={styles.list} data-flx="user.profile-badge-settings.list">
				{filtered.map((badge) => {
					const shown = !hidden.has(badge.key);
					const switchId = `${switchIdPrefix}-${badge.key}`;
					return (
						<li key={badge.key} className={styles.item} data-flx="user.profile-badge-settings.item">
							<div className={styles.row} data-flx="user.profile-badge-settings.row">
								<label htmlFor={switchId} className={styles.rowLabel} data-flx="user.profile-badge-settings.row-label">
									<span className={styles.artSlot} data-flx="user.profile-badge-settings.art-slot">
										<BadgeArt badge={badge} data-flx="user.profile-badge-settings.badge-art" />
									</span>
									<span className={styles.label} dir="auto" data-flx="user.profile-badge-settings.label">
										{badge.label}
									</span>
								</label>
								<Switch
									id={switchId}
									value={shown}
									onChange={(value) => onToggleHidden(badge.key, !value)}
									disabled={disabled}
									ariaLabel={i18n._(SHOW_BADGE_DESCRIPTOR, {badgeLabel: badge.label})}
									compact
									data-flx="user.profile-badge-settings.switch"
								/>
							</div>
						</li>
					);
				})}
			</ul>
		</>
	);
}

export const ProfileBadgeSettings = observer(({preview, ...listProps}: ProfileBadgeSettingsProps) => {
	const {i18n} = useLingui();
	const ownBadges = preview.value?.own_badges;
	let body: ReactNode;
	if (ownBadges === undefined && preview.status === 'failed') {
		body = (
			<div className={styles.status} data-flx="user.profile-badge-settings.failed">
				<p className={styles.note} data-flx="user.profile-badge-settings.failed-text">
					{i18n._(BADGES_LOAD_FAILED_DESCRIPTOR)}
				</p>
				<Button variant="secondary" small onClick={preview.retry} data-flx="user.profile-badge-settings.retry">
					{i18n._(TRY_AGAIN_DESCRIPTOR)}
				</Button>
			</div>
		);
	} else if (ownBadges === undefined) {
		body = <Spinner data-flx="user.profile-badge-settings.spinner" />;
	} else if (ownBadges.length === 0) {
		body = (
			<p className={styles.note} data-flx="user.profile-badge-settings.empty">
				{i18n._(NO_BADGES_DESCRIPTOR)}
			</p>
		);
	} else {
		body = <BadgeList ownBadges={ownBadges} {...listProps} data-flx="user.profile-badge-settings.badge-list" />;
	}
	return (
		<SettingsSection
			id={PROFILE_BADGES_SECTION_ID}
			title={i18n._(PROFILE_BADGES_DESCRIPTOR)}
			description={i18n._(BADGES_DESCRIPTION_DESCRIPTOR)}
			data-flx="user.profile-badge-settings.section"
		>
			{body}
		</SettingsSection>
	);
});
