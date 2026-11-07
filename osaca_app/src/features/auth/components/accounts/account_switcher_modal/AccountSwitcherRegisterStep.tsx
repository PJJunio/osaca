// SPDX-License-Identifier: AGPL-3.0-or-later

import type {RuntimeConfigSnapshot} from '@app/features/app/state/InstanceSnapshotStore';
import type * as AuthenticationCommands from '@app/features/auth/commands/AuthenticationCommands';
import authStyles from '@app/features/auth/components/accounts/account_switcher_modal/AccountSwitcherAuthFlow.module.css';
import pageStyles from '@app/features/auth/flow/AuthPageStyles.module.css';
import {AuthRegisterFormCore} from '@app/features/auth/flow/AuthRegisterFormCore';
import {credentialRegisterFields} from '@app/features/auth/flow/RegisterFormFields';
import {type StepTitleChangeHandler, useReportStepTitle} from '@app/features/auth/flow/useReportStepTitle';
import ThemeProfile from '@app/features/theme/state/ThemeProfile';
import {flxElementClassName} from '@app/lib/react';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

const CREATE_AN_ACCOUNT_DESCRIPTOR = msg({
	message: 'Create an account',
	comment: 'Title of the registration step in the account switcher, used to add another saved account.',
});

interface AccountSwitcherRegisterStepProps {
	readonly runtimeSnapshot: RuntimeConfigSnapshot;
	readonly onStepTitleChange: StepTitleChangeHandler | null;
	readonly onRegister: (response: AuthenticationCommands.TokenResponse) => Promise<void>;
}

export const AccountSwitcherRegisterStep = observer(function AccountSwitcherRegisterStep({
	runtimeSnapshot,
	onStepTitleChange,
	onRegister,
}: AccountSwitcherRegisterStepProps): React.ReactElement {
	const {i18n} = useLingui();
	useReportStepTitle(onStepTitleChange, i18n._(CREATE_AN_ACCOUNT_DESCRIPTOR));
	const showTitle = onStepTitleChange == null;
	return (
		<>
			{showTitle ? (
				<h1
					className={pageStyles.title}
					data-flx="auth.accounts.account-switcher-modal.account-switcher-register-step.title"
				>
					{i18n._(CREATE_AN_ACCOUNT_DESCRIPTOR)}
				</h1>
			) : null}
			<flx-auth-account-switcher-register-step
				className={flxElementClassName(authStyles.inlineRegisterContainer, !showTitle && authStyles.untitled)}
				data-flx="auth.accounts.account-switcher-modal.account-switcher-register-step.container"
			>
				<AuthRegisterFormCore
					fields={credentialRegisterFields()}
					submitLabel={<Trans>Create account</Trans>}
					redirectPath=""
					offerRecoveryKit
					runtimeSnapshot={runtimeSnapshot}
					onRegister={onRegister}
					showLegalConsent
					theme={ThemeProfile.themePreference}
					data-flx="auth.accounts.account-switcher-modal.account-switcher-register-step.auth-register-form-core"
				/>
			</flx-auth-account-switcher-register-step>
		</>
	);
});
