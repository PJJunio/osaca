// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import {useFormSubmit} from '@app/features/app/hooks/useFormSubmit';
import {
	CONFIRM_NEW_PASSWORD_DESCRIPTOR,
	NEW_PASSWORD_DESCRIPTOR,
	PASSWORDS_DO_NOT_MATCH_DESCRIPTOR,
} from '@app/features/i18n/utils/CommonMessageDescriptors';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import {Form} from '@app/features/ui/components/form/Form';
import {Input} from '@app/features/ui/components/form/FormInput';
import * as RecoveryKitCommands from '@app/features/user/commands/RecoveryKitCommands';
import * as UserCommands from '@app/features/user/commands/UserCommands';
import RecoveryKitStatus from '@app/features/user/state/RecoveryKitStatus';
import Users from '@app/features/user/state/Users';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';
import {useForm} from 'react-hook-form';

const UPDATE_YOUR_PASSWORD_DESCRIPTOR = msg({
	message: 'Update your password',
	comment: 'Short label in the password change modal. Keep it concise. Keep the tone plain and specific.',
});
const SET_A_PASSWORD_DESCRIPTOR = msg({
	message: 'Set a password',
	comment: 'Title of the dialog that adds a password to an account that has none yet.',
});
const CHANGE_PASSWORD_FORM_DESCRIPTOR = msg({
	message: 'Change password form',
	comment: 'Short label in the password change modal. Keep it concise. Keep the tone plain and specific.',
});

interface PasswordForm {
	new_password: string;
	confirm_password: string;
}

export const PasswordChangeModal = observer(() => {
	const {i18n} = useLingui();
	const passwordForm = useForm<PasswordForm>();
	const settingPassword = Users.currentUser?.hasPassword === false;
	const onPasswordSubmit = useCallback(
		async (data: PasswordForm) => {
			if (data.new_password !== data.confirm_password) {
				passwordForm.setError('confirm_password', {message: i18n._(PASSWORDS_DO_NOT_MATCH_DESCRIPTOR)});
				return;
			}
			const currentUserId = Users.currentUserId;
			const hadRecoveryKit = currentUserId ? RecoveryKitStatus.get(currentUserId)?.hasRecoveryKit : undefined;
			await UserCommands.updatePasswordWithSudo(data.new_password);
			ModalCommands.popByType(PasswordChangeModal);
			if (hadRecoveryKit !== false) {
				void RecoveryKitCommands.replaceRecoveryKitAfterPasswordChange(data.new_password);
			}
			ToastCommands.createToast({
				type: 'success',
				children: settingPassword ? <Trans>Password set</Trans> : <Trans>Password changed</Trans>,
			});
		},
		[passwordForm, i18n, settingPassword],
	);
	const {handleSubmit: handlePasswordSubmit, isSubmitting: isPasswordSubmitting} = useFormSubmit({
		form: passwordForm,
		onSubmit: onPasswordSubmit,
		defaultErrorField: 'new_password',
	});
	const passwordFields = (
		<Form
			form={passwordForm}
			onSubmit={handlePasswordSubmit}
			aria-label={i18n._(CHANGE_PASSWORD_FORM_DESCRIPTOR)}
			data-flx="user.password-change-modal.form.password-submit"
		>
			<Modal.Description data-flx="user.password-change-modal.modal-description--3">
				<Trans>Choose a new password.</Trans>
			</Modal.Description>
			<Modal.InputGroup data-flx="user.password-change-modal.modal-input-group--2">
				<Input
					data-flx="user.password-change-modal.input.password"
					{...passwordForm.register('new_password')}
					autoComplete="new-password"
					autoFocus={true}
					error={passwordForm.formState.errors.new_password?.message}
					label={i18n._(NEW_PASSWORD_DESCRIPTOR)}
					maxLength={128}
					minLength={8}
					placeholder={'•'.repeat(32)}
					required={true}
					type="password"
				/>
				<Input
					data-flx="user.password-change-modal.input.password--2"
					{...passwordForm.register('confirm_password')}
					autoComplete="new-password"
					error={passwordForm.formState.errors.confirm_password?.message}
					label={i18n._(CONFIRM_NEW_PASSWORD_DESCRIPTOR)}
					maxLength={128}
					minLength={8}
					placeholder={'•'.repeat(32)}
					required={true}
					type="password"
				/>
			</Modal.InputGroup>
		</Form>
	);
	return (
		<Modal.Root size="small" centered data-flx="user.password-change-modal.modal-root">
			<Modal.Header
				title={i18n._(settingPassword ? SET_A_PASSWORD_DESCRIPTOR : UPDATE_YOUR_PASSWORD_DESCRIPTOR)}
				data-flx="user.password-change-modal.modal-header"
			/>
			<Modal.Content data-flx="user.password-change-modal.modal-content">
				<Modal.ContentLayout data-flx="user.password-change-modal.modal-content-layout">
					{passwordFields}
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.Footer data-flx="user.password-change-modal.footer">
				<Button onClick={ModalCommands.pop} variant="secondary" data-flx="user.password-change-modal.button.pop--3">
					<Trans>Cancel</Trans>
				</Button>
				<Button
					onClick={handlePasswordSubmit}
					submitting={isPasswordSubmitting}
					data-flx="user.password-change-modal.button.submit"
				>
					{settingPassword ? <Trans>Set password</Trans> : <Trans>Change password</Trans>}
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
