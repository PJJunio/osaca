// SPDX-License-Identifier: AGPL-3.0-or-later

import {getCachedNumberFormat} from '@app/features/i18n/utils/IntlCache';
import {CharacterCountAnnouncer} from '@app/features/ui/character_counter/CharacterCountAnnouncer';
import styles from '@app/features/ui/character_counter/CharacterCounter.module.css';
import {
	CHARACTERS_LEFT_DESCRIPTOR,
	MESSAGE_IS_TOO_LONG_DESCRIPTOR,
} from '@app/features/ui/character_counter/CharacterCountMessages';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';

interface CharacterCounterProps {
	currentLength: number;
	maxLength: number;
	className?: string;
}

export const CharacterCounter = observer(({currentLength, maxLength, className}: CharacterCounterProps) => {
	const {i18n} = useLingui();
	const remaining = maxLength - currentLength;
	const formattedRemaining = getCachedNumberFormat(i18n.locale).format(remaining);
	const isOverLimit = remaining < 0;
	const isNearingLimit = remaining < 50;
	const tooltipText = isOverLimit
		? i18n._(MESSAGE_IS_TOO_LONG_DESCRIPTOR)
		: i18n._(CHARACTERS_LEFT_DESCRIPTOR, {remaining});
	const colorClass = isOverLimit || isNearingLimit ? styles.textDanger : styles.textTertiary;
	return (
		<>
			<Tooltip text={tooltipText} data-flx="ui.character-counter.character-counter.tooltip--2">
				<span
					aria-hidden="true"
					data-flx="ui.character-counter.character-counter.counter-span"
					className={clsx(styles.counterSpan, colorClass, className)}
				>
					{formattedRemaining}
				</span>
			</Tooltip>
			<CharacterCountAnnouncer
				currentLength={currentLength}
				maxLength={maxLength}
				data-flx="ui.character-counter.character-counter.character-count-announcer"
			/>
		</>
	);
});
