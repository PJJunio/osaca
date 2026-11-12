import {createNamedLiteral, createStringType, SnowflakeStringType} from '@osaca/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

// Only users are archived (before deletion); guild archives were removed with the Operator's data access.
export const ArchiveSubjectTypeSchema = createNamedLiteral('user', 'user', 'User data archive');
export type ArchiveSubjectType = z.infer<typeof ArchiveSubjectTypeSchema>;

export const AdminArchiveResponseSchema = z.object({
	archive_id: SnowflakeStringType,
	subject_type: ArchiveSubjectTypeSchema,
	subject_id: SnowflakeStringType,
	requested_by: SnowflakeStringType,
	requested_at: z.string(),
	started_at: z.string().nullable(),
	completed_at: z.string().nullable(),
	failed_at: z.string().nullable(),
	file_size: createStringType(1, 64).nullable(),
	progress_percent: z.number(),
	progress_step: createStringType(1, 256).nullable(),
	error_message: createStringType(1, 4000).nullable(),
	download_url_expires_at: z.string().nullable(),
	expires_at: z.string().nullable(),
});
export type AdminArchiveResponse = z.infer<typeof AdminArchiveResponseSchema>;
