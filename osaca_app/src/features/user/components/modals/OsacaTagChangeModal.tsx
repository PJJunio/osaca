// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import {EXAMPLE_OSACA_TAG} from '@app/features/app/config/I18nDisplayConstants';
import {useFormSubmit} from '@app/features/app/hooks/useFormSubmit';
import {USERNAME_DESCRIPTOR} from '@app/features/i18n/utils/CommonMessageDescriptors';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import {Form} from '@app/features/ui/components/form/Form';
import {Input} from '@app/features/ui/components/form/FormInput';
import {UsernameValidationRules} from '@app/features/ui/components/form/UsernameValidationRules';
import * as UserCommands from '@app/features/user/commands/UserCommands';
import styles from '@app/features/user/components/modals/OsacaTagChangeModal.module.css';
import type {User} from '@app/features/user/models/User';
import {CHANGE_YOUR_USERNAME_DESCRIPTOR} from '@app/features/user/utils/UserMessageDescriptors';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useRef} from 'react';
import {Controller, useForm} from 'react-hook-form';

const USERNAME_UPDATED_DESCRIPTOR = msg({
	message: 'Username updated',
	comment: 'Short label in the OsacaTag change modal. Keep it concise.',
});
const CHANGE_USERNAME_FORM_DESCRIPTOR = msg({
	message: 'Change username form',
	comment: 'Short label in the OsacaTag change modal. Keep it concise.',
});

interface FormInputs {
	username: string;
	discriminator: string;
}

interface OsacaTagChangeModalProps {
	user: User;
}

export const OsacaTagChangeModal = observer(({user}: OsacaTagChangeModalProps) => {
	const {i18n} = useLingui();
	const usernameRef = useRef<HTMLInputElement>(null);
	const form = useForm<FormInputs>({
		defaultValues: {
			username: user.username,
			discriminator: user.discriminator,
		},
	});
	const onSubmit = useCallback(async (data: FormInputs) => {
		await UserCommands.update({username: data.username.trim()});
		ModalCommands.pop();
		ToastCommands.createToast({type: 'success', children: i18n._(USERNAME_UPDATED_DESCRIPTOR)});
	}, []);
	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'username',
	});
	const formLabel = i18n._(CHANGE_USERNAME_FORM_DESCRIPTOR);
	const header = (
		<Modal.Header title={i18n._(CHANGE_YOUR_USERNAME_DESCRIPTOR)} data-flx="user.osaca-tag-change-modal.modal-header" />
	);
	const usernameError = form.formState.errors.username && (
		<div className={styles.errorBox} role="alert" data-flx="user.osaca-tag-change-modal.error-box">
			{form.formState.errors.username.message}
		</div>
	);
	const usernameInput = (
		<div className={styles.usernameInput} data-flx="user.osaca-tag-change-modal.username-input">
			<Controller
				name="username"
				control={form.control}
				render={({field}) => (
					<Input
						data-flx="user.osaca-tag-change-modal.input.text"
						{...field}
						ref={usernameRef}
						autoComplete="username"
						aria-label={i18n._(USERNAME_DESCRIPTOR)}
						placeholder={EXAMPLE_OSACA_TAG}
						required={true}
						type="text"
					/>
				)}
				data-flx="user.osaca-tag-change-modal.controller"
			/>
		</div>
	);
	const usernameRules = (
		<UsernameValidationRules
			username={form.watch('username')}
			data-flx="user.osaca-tag-change-modal.username-validation-rules"
		/>
	);

	return (
		<Modal.Root size="small" centered initialFocusRef={usernameRef} data-flx="user.osaca-tag-change-modal.modal-root">
			<Form
				form={form}
				onSubmit={handleSubmit}
				aria-label={formLabel}
				data-flx="user.osaca-tag-change-modal.form.submit"
			>
				{header}
				<Modal.Content data-flx="user.osaca-tag-change-modal.modal-content">
					<Modal.ContentLayout data-flx="user.osaca-tag-change-modal.modal-content-layout">
						<Modal.Description data-flx="user.osaca-tag-change-modal.modal-description">
							<Trans>
								Usernames can only contain letters (a-z, A-Z), numbers (0-9), and underscores. Usernames are
								case-insensitive.
							</Trans>
						</Modal.Description>
						<div className={styles.osacaTagContainer} data-flx="user.osaca-tag-change-modal.osaca-tag-container">
							<span className={styles.osacaTagLabel} data-flx="user.osaca-tag-change-modal.osaca-tag-label">
								<Trans>Username</Trans>
							</span>
							{usernameError}
							<div className={styles.osacaTagInputRow} data-flx="user.osaca-tag-change-modal.osaca-tag-input-row">
								{usernameInput}
							</div>
							<div className={styles.validationBox} data-flx="user.osaca-tag-change-modal.validation-box">
								{usernameRules}
							</div>
						</div>
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer data-flx="user.osaca-tag-change-modal.modal-footer">
					<Button onClick={ModalCommands.pop} variant="secondary" data-flx="user.osaca-tag-change-modal.button.pop">
						<Trans>Cancel</Trans>
					</Button>
					<Button type="submit" submitting={isSubmitting} data-flx="user.osaca-tag-change-modal.button.submit">
						<Trans>Continue</Trans>
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
