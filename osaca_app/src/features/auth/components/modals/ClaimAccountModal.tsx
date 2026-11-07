// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import {useFormSubmit} from '@app/features/app/hooks/useFormSubmit';
import {
	CLAIM_ACCOUNT_DESCRIPTOR,
	PASSWORD_DESCRIPTOR,
	USERNAME_DESCRIPTOR,
} from '@app/features/i18n/utils/CommonMessageDescriptors';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import {Form} from '@app/features/ui/components/form/Form';
import {Input} from '@app/features/ui/components/form/FormInput';
import ModalState from '@app/features/ui/state/Modal';
import {createRecoveryKitWithPasswordAndOpen} from '@app/features/user/commands/RecoveryKitCommands';
import * as UserCommands from '@app/features/user/commands/UserCommands';
import Users from '@app/features/user/state/Users';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {LocalCredentialKinds} from '@osaca/constants/src/AccountTierConstants';
import {observer} from 'mobx-react-lite';
import {useForm} from 'react-hook-form';

const ACCOUNT_CLAIMED_SUCCESSFULLY_DESCRIPTOR = msg({
	message: 'Account claimed successfully',
	comment: 'Short label in the authentication claim account modal. Keep the tone plain and specific.',
});
const CLAIM_YOUR_ACCOUNT_DESCRIPTOR = msg({
	message: 'Claim your account',
	comment: 'Short label in the authentication claim account modal. Keep the tone plain and specific.',
});
const CONFIRM_PASSWORD_DESCRIPTOR = msg({
	message: 'Confirm password',
	comment: 'Label for the password confirmation field in the claim account modal.',
});
const PASSWORDS_DO_NOT_MATCH_DESCRIPTOR = msg({
	message: 'Passwords do not match',
	comment: 'Claim account modal error when the password and its confirmation differ.',
});

const CLAIM_ACCOUNT_MODAL_KEY = 'claim-account-modal';

interface UsernameClaimInputs {
	username: string;
	newPassword: string;
	confirmPassword: string;
}

const USERNAME_CLAIM_PATH_MAP = {new_password: 'newPassword'} as const;

interface ClaimFlowOptions {
	readonly onComplete?: () => void;
	readonly onDismiss?: () => void;
	readonly reason?: string | null;
}

function hasRegisteredPasskey(): boolean {
	const credential = Users.currentUser?.localCredential;
	return credential === LocalCredentialKinds.PASSKEY || credential === LocalCredentialKinds.PASSWORD_AND_PASSKEY;
}

const UsernameClaimAccountModal = observer(({onComplete, onDismiss, reason}: ClaimFlowOptions) => {
	const {i18n} = useLingui();
	const dismiss = () => {
		ModalCommands.popWithKey(CLAIM_ACCOUNT_MODAL_KEY);
		onDismiss?.();
	};
	const form = useForm<UsernameClaimInputs>({
		defaultValues: {username: Users.currentUser?.username ?? '', newPassword: '', confirmPassword: ''},
	});
	const hasPasskey = hasRegisteredPasskey();
	const handleClaim = async (data: UsernameClaimInputs) => {
		if (data.newPassword !== data.confirmPassword) {
			form.setError('confirmPassword', {type: 'validate', message: i18n._(PASSWORDS_DO_NOT_MATCH_DESCRIPTOR)});
			return;
		}
		const username = data.username.trim();
		const updated = await UserCommands.update(
			data.newPassword === '' ? {username} : {username, new_password: data.newPassword},
		);
		ModalCommands.popWithKey(CLAIM_ACCOUNT_MODAL_KEY);
		ToastCommands.createToast({type: 'success', children: i18n._(ACCOUNT_CLAIMED_SUCCESSFULLY_DESCRIPTOR)});
		onComplete?.();
		if (data.newPassword === '') return;
		void createRecoveryKitWithPasswordAndOpen({
			userId: updated.id,
			password: data.newPassword,
			username: updated.username,
			discriminator: updated.discriminator,
		});
	};
	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit: handleClaim,
		defaultErrorField: 'username',
		pathMap: USERNAME_CLAIM_PATH_MAP,
	});
	return (
		<Modal.Root size="small" centered onClose={dismiss} data-flx="auth.claim-account-modal.username.modal-root">
			<Modal.Header
				title={i18n._(CLAIM_YOUR_ACCOUNT_DESCRIPTOR)}
				data-flx="auth.claim-account-modal.username.modal-header"
			/>
			<Form form={form} onSubmit={handleSubmit} data-flx="auth.claim-account-modal.username.form.submit">
				<Modal.Content data-flx="auth.claim-account-modal.username.modal-content">
					<Modal.ContentLayout data-flx="auth.claim-account-modal.username.modal-content-layout">
						{reason == null ? null : (
							<Modal.Description dir="auto" data-flx="auth.claim-account-modal.username.reason">
								{reason}
							</Modal.Description>
						)}
						<Modal.Description data-flx="auth.claim-account-modal.username.modal-description">
							<Trans>
								Claim your account by choosing a username and password. You sign in with them, so pick ones you will
								remember.
							</Trans>
						</Modal.Description>
						<Modal.InputGroup data-flx="auth.claim-account-modal.username.modal-input-group">
							<Input
								data-flx="auth.claim-account-modal.username.input.username"
								{...form.register('username')}
								autoCapitalize="none"
								autoComplete="username"
								autoCorrect="off"
								autoFocus={true}
								error={form.formState.errors.username?.message}
								label={i18n._(USERNAME_DESCRIPTOR)}
								maxLength={32}
								minLength={1}
								required={true}
								spellCheck={false}
							/>
							<Input
								data-flx="auth.claim-account-modal.username.input.password"
								{...form.register('newPassword')}
								autoComplete="new-password"
								error={form.formState.errors.newPassword?.message}
								label={i18n._(PASSWORD_DESCRIPTOR)}
								maxLength={128}
								minLength={8}
								placeholder={'•'.repeat(32)}
								required={!hasPasskey}
								type="password"
							/>
							<Input
								data-flx="auth.claim-account-modal.username.input.confirm-password"
								{...form.register('confirmPassword')}
								autoComplete="new-password"
								error={form.formState.errors.confirmPassword?.message}
								label={i18n._(CONFIRM_PASSWORD_DESCRIPTOR)}
								maxLength={128}
								minLength={8}
								placeholder={'•'.repeat(32)}
								required={!hasPasskey}
								type="password"
							/>
						</Modal.InputGroup>
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer data-flx="auth.claim-account-modal.username.footer">
					<Button
						onClick={dismiss}
						variant="secondary"
						type="button"
						data-flx="auth.claim-account-modal.username.button.pop"
					>
						<Trans>Cancel</Trans>
					</Button>
					<Button type="submit" submitting={isSubmitting} data-flx="auth.claim-account-modal.username.button.submit">
						{i18n._(CLAIM_ACCOUNT_DESCRIPTOR)}
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});

export const openClaimAccountModal = ({onComplete, onDismiss, reason}: ClaimFlowOptions = {}): void => {
	if (ModalState.hasModal(CLAIM_ACCOUNT_MODAL_KEY)) {
		return;
	}
	ModalCommands.pushWithKey(
		modal(() => (
			<UsernameClaimAccountModal
				onComplete={onComplete}
				onDismiss={onDismiss}
				reason={reason}
				data-flx="auth.claim-account-modal.open-claim-account-modal.username-claim-account-modal"
			/>
		)),
		CLAIM_ACCOUNT_MODAL_KEY,
	);
};
