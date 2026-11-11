// SPDX-License-Identifier: AGPL-3.0-or-later

import OsacaLogoAsset from '@app/media/images/osaca-logo-color.svg?react';
import {msg} from '@lingui/core/macro';
import type React from 'react';

export const APPLICATION_ICON_DESCRIPTOR = msg({
	message: '{productName} application icon',
	comment: 'Accessible label for the OSACA application icon.',
});

/** The approved OSACA logo, used when the Instance has no icon of its own. */
export const OsacaIconMark = (props: React.SVGProps<SVGSVGElement>) => (
	<OsacaLogoAsset role="img" data-flx="ui.icons.osaca-icon.img" {...props} />
);
