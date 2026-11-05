// SPDX-License-Identifier: AGPL-3.0-or-later

import {ConfirmModal} from '@app/features/app/components/dialogs/ConfirmModal';
import * as Modal from '@app/features/app/components/dialogs/Modal';
import {EXAMPLE_OSACA_TAG} from '@app/features/app/config/I18nDisplayConstants';
import {useFormSubmit} from '@app/features/app/hooks/useFormSubmit';
import RuntimeConfig from '@app/features/app/state/RuntimeConfig';
import {LimitResolver} from '@app/features/app/utils/LimitResolverAdapter';
import {isLimitToggleEnabled} from '@app/features/app/utils/LimitUtils';
import {
	CANCEL_DESCRIPTOR,
	CONTINUE_DESCRIPTOR,
	USERNAME_DESCRIPTOR,
} from '@app/features/i18n/utils/CommonMessageDescriptors';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import * as ToastCommands from '@app/features/ui/commands/ToastCommands';
import {Form} from '@app/features/ui/components/form/Form';
import {Input} from '@app/features/ui/components/form/FormInput';
import {UsernameValidationRules} from '@app/features/ui/components/form/UsernameValidationRules';
import {Tooltip} from '@app/features/ui/tooltip/Tooltip';
import * as UserCommands from '@app/features/user/commands/UserCommands';
import styles from '@app/features/user/components/modals/OsacaTagChangeModal.module.css';
import type {User} from '@app/features/user/models/User';
import {CHANGE_YOUR_USERNAME_DESCRIPTOR, TAG_DESCRIPTOR} from '@app/features/user/utils/UserMessageDescriptors';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {type ReactNode, useCallback, useEffect, useRef} from 'react';
import {Controller, useForm} from 'react-hook-form';

const USERNAME_ALREADY_TAKEN_DESCRIPTOR = msg({
	message: 'Username already taken',
	comment: 'Short label in the OsacaTag change modal. Keep it concise.',
});
const USERNAME_UPDATED_DESCRIPTOR = msg({
	message: 'Username updated',
	comment: 'Short label in the OsacaTag change modal. Keep it concise.',
});
const CHANGE_USERNAME_FORM_DESCRIPTOR = msg({
	message: 'Change username form',
	comment: 'Short label in the OsacaTag change modal. Keep it concise.',
});

const CUSTOM_DISCRIMINATORS_ARE_NOT_AVAILABLE_ON_THIS_INSTANCE_DESCRIPTOR = msg({
	message: 'Custom discriminators are not available on this instance',
	comment: 'Error message in the OsacaTag change modal.',
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
	const hasCustomDiscriminator = isLimitToggleEnabled(
		{feature_custom_discriminator: LimitResolver.resolve({key: 'feature_custom_discriminator', fallback: 0})},
		'feature_custom_discriminator',
	);
	const usernameOnly = RuntimeConfig.usesUniqueUsernames;
	const skipAvailabilityCheckRef = useRef(false);
	const resubmitHandlerRef = useRef<(() => Promise<void>) | null>(null);
	const confirmedRerollRef = useRef(false);
	const form = useForm<FormInputs>({
		defaultValues: {
			username: user.username,
			discriminator: user.discriminator,
		},
	});
	useEffect(() => {
		const subscription = form.watch((_, info) => {
			if (info?.name === 'username') {
				confirmedRerollRef.current = false;
			}
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [form]);
	const onSubmit = useCallback(
		async (data: FormInputs) => {
			const usernameValue = data.username.trim();
			if (usernameOnly) {
				await UserCommands.update({username: usernameValue});
				ModalCommands.pop();
				ToastCommands.createToast({type: 'success', children: i18n._(USERNAME_UPDATED_DESCRIPTOR)});
				return;
			}
			const normalizedDiscriminator = data.discriminator;
			const currentUsername = user.username.trim();
			const currentDiscriminator = user.discriminator;
			const isSameTag = usernameValue === currentUsername && normalizedDiscriminator === currentDiscriminator;
			if (!hasCustomDiscriminator && !skipAvailabilityCheckRef.current && !confirmedRerollRef.current) {
				const tagTaken = await UserCommands.checkOsacaTagAvailability({
					username: usernameValue,
					discriminator: normalizedDiscriminator,
				});
				if (tagTaken && !isSameTag) {
					const osacaTag = `${usernameValue}#${normalizedDiscriminator}`;
					ModalCommands.push(
						modal(() => (
							<ConfirmModal
								title={i18n._(USERNAME_ALREADY_TAKEN_DESCRIPTOR)}
								description={
									<div
										className={styles.confirmDescription}
										data-flx="user.osaca-tag-change-modal.on-submit.confirm-description"
									>
										<p data-flx="user.osaca-tag-change-modal.on-submit.p">
											<Trans>
												The username <strong data-flx="user.osaca-tag-change-modal.on-submit.strong">{osacaTag}</strong>{' '}
												is already taken. Continuing will reroll your tag automatically.
											</Trans>
										</p>
										<p
											className={styles.confirmSecondary}
											data-flx="user.osaca-tag-change-modal.on-submit.confirm-secondary"
										>
											<Trans>Cancel if you want to choose a different username instead.</Trans>
										</p>
									</div>
								}
								primaryText={i18n._(CONTINUE_DESCRIPTOR)}
								secondaryText={i18n._(CANCEL_DESCRIPTOR)}
								primaryVariant="primary"
								onPrimary={async () => {
									confirmedRerollRef.current = true;
									skipAvailabilityCheckRef.current = true;
									try {
										await resubmitHandlerRef.current?.();
									} finally {
										skipAvailabilityCheckRef.current = false;
									}
								}}
								data-flx="user.osaca-tag-change-modal.on-submit.confirm-modal"
							/>
						)),
					);
					return;
				}
			}
			await UserCommands.update({
				username: usernameValue,
				discriminator: normalizedDiscriminator,
			});
			if (skipAvailabilityCheckRef.current) {
				skipAvailabilityCheckRef.current = false;
			}
			ModalCommands.pop();
			ToastCommands.createToast({type: 'success', children: i18n._(USERNAME_UPDATED_DESCRIPTOR)});
		},
		[hasCustomDiscriminator, usernameOnly],
	);
	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'username',
	});
	resubmitHandlerRef.current = handleSubmit;
	const formLabel = i18n._(CHANGE_USERNAME_FORM_DESCRIPTOR);
	const header = (
		<Modal.Header title={i18n._(CHANGE_YOUR_USERNAME_DESCRIPTOR)} data-flx="user.osaca-tag-change-modal.modal-header" />
	);
	const usernameError = (form.formState.errors.username || form.formState.errors.discriminator) && (
		<div className={styles.errorBox} role="alert" data-flx="user.osaca-tag-change-modal.error-box">
			{form.formState.errors.username?.message || form.formState.errors.discriminator?.message}
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
	let discriminatorInput: ReactNode = null;
	if (!usernameOnly) {
		if (!hasCustomDiscriminator) {
			discriminatorInput = (
				<Tooltip
					text={i18n._(CUSTOM_DISCRIMINATORS_ARE_NOT_AVAILABLE_ON_THIS_INSTANCE_DESCRIPTOR)}
					data-flx="user.osaca-tag-change-modal.tooltip--2"
				>
					<div
						className={styles.discriminatorInputDisabled}
						data-flx="user.osaca-tag-change-modal.discriminator-input-disabled--2"
					>
						<Input
							data-flx="user.osaca-tag-change-modal.input.set-value.text--2"
							{...form.register('discriminator')}
							aria-label={i18n._(TAG_DESCRIPTOR)}
							maxLength={4}
							placeholder="0000"
							required={true}
							type="text"
							disabled={true}
							onChange={(e) => {
								const value = e.target.value.replace(/\D/g, '');
								form.setValue('discriminator', value);
							}}
						/>
					</div>
				</Tooltip>
			);
		} else {
			discriminatorInput = (
				<Input
					data-flx="user.osaca-tag-change-modal.input.set-value.text--3"
					{...form.register('discriminator')}
					aria-label={i18n._(TAG_DESCRIPTOR)}
					maxLength={4}
					placeholder="0000"
					required={true}
					type="text"
					disabled={false}
					onChange={(e) => {
						const value = e.target.value.replace(/\D/g, '');
						form.setValue('discriminator', value, {shouldValidate: true});
					}}
				/>
			);
		}
	}
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
								{!usernameOnly && (
									<span className={styles.separator} data-flx="user.osaca-tag-change-modal.separator">
										#
									</span>
								)}
								{!usernameOnly && (
									<div className={styles.discriminatorInput} data-flx="user.osaca-tag-change-modal.discriminator-input">
										{discriminatorInput}
									</div>
								)}
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
