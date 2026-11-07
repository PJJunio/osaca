// SPDX-License-Identifier: AGPL-3.0-or-later

import {type ChannelID, createAttachmentID, type UserID} from '@app/api/BrandedTypes';
import {Config} from '@app/api/Config';
import type {AttachmentToProcess} from '@app/api/channel/AttachmentDTOs';
import type {AttachmentUploadTraceRepository} from '@app/api/channel/repositories/message/AttachmentUploadTraceRepository';
import {makeAttachmentCdnKey, validateAttachmentIds} from '@app/api/channel/services/message/MessageHelpers';
import type {MessageAttachment} from '@app/api/database/types/MessageTypes';
import type {IMediaService, MediaProxyNsfwMode} from '@app/api/infrastructure/IMediaService';
import type {ISnowflakeService} from '@app/api/infrastructure/ISnowflakeService';
import type {IStorageService} from '@app/api/infrastructure/IStorageService';
import {Logger} from '@app/api/Logger';
import type {Channel} from '@app/api/models/Channel';
import type {Message} from '@app/api/models/Message';
import {mapWithConcurrency} from '@app/api/utils/ConcurrencyUtils';
import {MessageAttachmentFlags} from '@osaca/constants/src/ChannelConstants';
import {ValidationErrorCodes} from '@osaca/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@osaca/errors/src/domains/core/InputValidationError';
import type {GuildMemberResponse} from '@osaca/schema/src/domains/guild/GuildMemberSchemas';
import type {GuildResponse} from '@osaca/schema/src/domains/guild/GuildResponseSchemas';
import {getContentTypeFromFilename} from '@pkgs/mime_utils/src/ContentTypeUtils';
import type {IVirusScanService} from '@pkgs/virus_scan/src/IVirusScanService';

const ATTACHMENT_PROCESSING_CONCURRENCY = 2;

interface ProcessAttachmentParams {
	message: Message;
	attachment: AttachmentToProcess;
	index: number;
	uploadUserId: UserID;
	uploadChannelId?: ChannelID;
	channel?: Channel;
	guild?: GuildResponse | null;
	member?: GuildMemberResponse | null;
	nsfwMode: MediaProxyNsfwMode;
}

interface AttachmentCopyOperation {
	sourceBucket: string;
	sourceKey: string;
	destinationBucket: string;
	destinationKey: string;
	newContentType: string;
}

interface ProcessedAttachment {
	attachment: MessageAttachment;
	copyOperation: AttachmentCopyOperation;
}

export class AttachmentProcessingService {
	constructor(
		private storageService: IStorageService,
		private attachmentUploadTraceRepository: AttachmentUploadTraceRepository,
		_mediaService: IMediaService,
		_virusScanService: IVirusScanService,
		private snowflakeService: ISnowflakeService,
	) {}

	async computeAttachments(params: {
		message: Message;
		attachments: Array<AttachmentToProcess>;
		uploadUserId: UserID;
		uploadChannelId?: ChannelID;
		channel?: Channel;
		guild?: GuildResponse | null;
		member?: GuildMemberResponse | null;
		nsfwMode: MediaProxyNsfwMode;
	}): Promise<{
		attachments: Array<MessageAttachment>;
		hasVirusDetected: boolean;
	}> {
		validateAttachmentIds(params.attachments.map((a) => ({id: BigInt(a.id)})));
		const results = await mapWithConcurrency(
			params.attachments,
			ATTACHMENT_PROCESSING_CONCURRENCY,
			(attachment, index) =>
				this.processAttachment({
					message: params.message,
					attachment,
					index,
					uploadUserId: params.uploadUserId,
					uploadChannelId: params.uploadChannelId,
					channel: params.channel,
					guild: params.guild,
					member: params.member,
					nsfwMode: params.nsfwMode,
				}),
		);
		await mapWithConcurrency(results, ATTACHMENT_PROCESSING_CONCURRENCY, (result) =>
			this.storeAttachmentObject(result.copyOperation),
		);
		const bindingResults = await Promise.all(
			results.map(async (result, index) => ({
				index,
				result,
				bound: await this.attachmentUploadTraceRepository.bindAttachment(
					result.copyOperation.sourceKey,
					result.attachment.attachment_id,
				),
			})),
		);
		for (const result of results) {
			void this.deleteUploadObject(result.copyOperation.sourceBucket, result.copyOperation.sourceKey);
		}
		const unboundResult = bindingResults.find(({bound}) => bound === null);
		if (unboundResult) {
			for (const result of results) {
				this.deleteUploadObject(result.copyOperation.destinationBucket, result.copyOperation.destinationKey);
			}
			throw InputValidationError.fromCode(
				`attachments.${unboundResult.index}.upload_filename`,
				ValidationErrorCodes.UPLOADED_ATTACHMENT_NOT_FOUND,
				{filename: unboundResult.result.attachment.filename},
			);
		}
		return {
			attachments: results.map((result) => result.attachment),
			hasVirusDetected: false,
		};
	}

	private async processAttachment(params: ProcessAttachmentParams): Promise<ProcessedAttachment> {
		const {message, attachment, index} = params;
		const pendingUpload = await this.attachmentUploadTraceRepository.getPendingUpload({
			uploadKey: attachment.upload_filename,
			userId: params.uploadUserId,
			channelId: params.uploadChannelId ?? message.channelId,
		});
		if (!pendingUpload) {
			throw InputValidationError.fromCode(
				`attachments.${index}.upload_filename`,
				ValidationErrorCodes.UPLOADED_ATTACHMENT_NOT_FOUND,
				{filename: attachment.filename},
			);
		}
		const uploadedFile = await this.storageService.getObjectMetadata(
			Config.s3.buckets.uploads,
			attachment.upload_filename,
		);
		if (!uploadedFile) {
			throw InputValidationError.fromCode(`attachments.${index}.upload_filename`, ValidationErrorCodes.FILE_NOT_FOUND);
		}
		const attachmentId = createAttachmentID(await this.snowflakeService.generate());
		const cdnKey = makeAttachmentCdnKey(message.channelId, attachmentId, attachment.filename);
		const contentType = pendingUpload.content_type ?? getContentTypeFromFilename(attachment.filename);
		const size = BigInt(uploadedFile.contentLength);
		const flags =
			(attachment.flags ?? 0) & (MessageAttachmentFlags.IS_SPOILER | MessageAttachmentFlags.CONTAINS_EXPLICIT_MEDIA);
		const clientDuration: number | null = attachment.duration ?? null;
		const waveform: string | null = attachment.waveform ?? null;
		const isAudio = contentType.startsWith('audio/');
		if (waveform && !isAudio) {
			throw InputValidationError.fromCode(
				`attachments.${index}.upload_filename`,
				ValidationErrorCodes.VOICE_MESSAGES_ATTACHMENT_MUST_BE_AUDIO,
			);
		}
		return {
			attachment: {
				attachment_id: attachmentId,
				filename: attachment.filename,
				size,
				title: attachment.title ?? null,
				description: attachment.description ?? null,
				height: null,
				width: null,
				content_type: contentType,
				content_hash: null,
				placeholder: null,
				flags,
				duration: clientDuration,
				nsfw: null,
				waveform,
			},
			copyOperation: {
				sourceBucket: Config.s3.buckets.uploads,
				sourceKey: attachment.upload_filename,
				destinationBucket: Config.s3.buckets.cdn,
				destinationKey: cdnKey,
				newContentType: contentType,
			},
		};
	}

	private async storeAttachmentObject(operation: AttachmentCopyOperation): Promise<void> {
		const {sourceBucket, sourceKey, destinationBucket, destinationKey, newContentType} = operation;
		await this.storageService.copyObject({
			sourceBucket,
			sourceKey,
			destinationBucket,
			destinationKey,
			newContentType,
		});
	}

	private deleteUploadObject(bucket: string, key: string): void {
		void this.storageService.deleteObject(bucket, key).catch((error) => {
			Logger.warn({bucket, key, error}, 'Failed to delete temporary upload object');
		});
	}
}
