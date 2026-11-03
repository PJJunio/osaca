// SPDX-License-Identifier: AGPL-3.0-or-later

import {resolveAppShellBranding} from '@app/features/app/state/AppShellBranding';
import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import {getDataFlx, getImageSizingProps} from '@app/features/ui/components/icons/BrandImageUtils';
import {APPLICATION_ICON_DESCRIPTOR, OsacaIconMark} from '@app/features/ui/components/icons/OsacaIconMark';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const OsacaIcon = observer((props: React.SVGProps<SVGSVGElement>) => {
	const {i18n} = useLingui();
	const branding = resolveAppShellBranding(RuntimeConfig.getSnapshotOrNull());
	const ariaLabel = i18n._(APPLICATION_ICON_DESCRIPTOR, {productName: branding.productName});
	if (branding.iconUrl !== null) {
		return (
			<img
				{...getImageSizingProps(props)}
				src={branding.iconUrl}
				alt={ariaLabel}
				data-flx={getDataFlx(props, 'ui.icons.osaca-icon.img')}
			/>
		);
	}
	return <OsacaIconMark aria-label={ariaLabel} data-flx="ui.icons.osaca-icon.img" {...props} />;
});
