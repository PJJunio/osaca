// SPDX-License-Identifier: AGPL-3.0-or-later

import applicationProcessDeletion from '@app/api/worker/tasks/ApplicationProcessDeletion';
import bulkAddGuildMembers from '@app/api/worker/tasks/admin_bulk/BulkAddGuildMembers';
import bulkBanFileShas from '@app/api/worker/tasks/admin_bulk/BulkBanFileShas';
import bulkDeleteMessagesForUsers from '@app/api/worker/tasks/admin_bulk/BulkDeleteMessagesForUsers';
import bulkScheduleUserDeletion from '@app/api/worker/tasks/admin_bulk/BulkScheduleUserDeletion';
import bulkUpdateGuildFeatures from '@app/api/worker/tasks/admin_bulk/BulkUpdateGuildFeatures';
import bulkUpdateUserFlags from '@app/api/worker/tasks/admin_bulk/BulkUpdateUserFlags';
import backfillDeletedUsers from '@app/api/worker/tasks/BackfillDeletedUsers';
import backfillHiddenProfileBadges from '@app/api/worker/tasks/BackfillHiddenProfileBadges';
import backfillPasskeyTrait from '@app/api/worker/tasks/BackfillPasskeyTrait';
import backfillUserAclIndex from '@app/api/worker/tasks/BackfillUserAclIndex';
import batchGuildAuditLogMessageDeletes from '@app/api/worker/tasks/BatchGuildAuditLogMessageDeletes';
import bulkDeleteSelfMessagesImmediate from '@app/api/worker/tasks/BulkDeleteSelfMessagesImmediate';
import bulkDeleteUserMessages from '@app/api/worker/tasks/BulkDeleteUserMessages';
import crosspostMessage from '@app/api/worker/tasks/CrosspostMessage';
import crosspostMessageChunk from '@app/api/worker/tasks/CrosspostMessageChunk';
import deleteUserMessagesInGuildByTime from '@app/api/worker/tasks/DeleteUserMessagesInGuildByTime';
import drainActivitySpool from '@app/api/worker/tasks/DrainActivitySpool';
import expireAttachments from '@app/api/worker/tasks/ExpireAttachments';
import expireReportSnapshots from '@app/api/worker/tasks/ExpireReportSnapshots';
import expireStaleJobs from '@app/api/worker/tasks/ExpireStaleJobs';
import extractEmbeds from '@app/api/worker/tasks/ExtractEmbeds';
import flushUserActivityBuffer from '@app/api/worker/tasks/FlushUserActivityBuffer';
import guildProcessDeletion from '@app/api/worker/tasks/GuildProcessDeletion';
import {
	endGuildVisitsForCodeTask,
	endUnassignedGuildVisitsTask,
	pruneGuildVisitsTask,
} from '@app/api/worker/tasks/GuildVisitTasks';
import handleMentionChunk from '@app/api/worker/tasks/HandleMentionChunk';
import handleMentions from '@app/api/worker/tasks/HandleMentions';
import harvestGuildData from '@app/api/worker/tasks/HarvestGuildData';
import harvestUserData from '@app/api/worker/tasks/HarvestUserData';
import indexChannelMessages from '@app/api/worker/tasks/IndexChannelMessages';
import indexGuildMembers from '@app/api/worker/tasks/IndexGuildMembers';
import joinSingleCommunityMembers from '@app/api/worker/tasks/JoinSingleCommunityMembers';
import liftExpiredGuildInvitePauses from '@app/api/worker/tasks/LiftExpiredGuildInvitePauses';
import messageShred from '@app/api/worker/tasks/MessageShred';
import notifyRegistrationApprovers from '@app/api/worker/tasks/NotifyRegistrationApprovers';
import processAssetDeletionQueue from '@app/api/worker/tasks/ProcessAssetDeletionQueue';
import processCachePurgeQueue from '@app/api/worker/tasks/ProcessCachePurgeQueue';
import processInactivityDeletions from '@app/api/worker/tasks/ProcessInactivityDeletions';
import processPendingBulkMessageDeletions from '@app/api/worker/tasks/ProcessPendingBulkMessageDeletions';
import prunePostgresKvTtl from '@app/api/worker/tasks/PrunePostgresKvTtl';
import reconcileAttachmentDecay from '@app/api/worker/tasks/ReconcileAttachmentDecay';
import refreshSearchIndex from '@app/api/worker/tasks/RefreshSearchIndex';
import removeChannelFollowers from '@app/api/worker/tasks/RemoveChannelFollowers';
import seedThreadPermissions from '@app/api/worker/tasks/SeedThreadPermissions';
import {sendSystemDm} from '@app/api/worker/tasks/SendSystemDm';
import syncCrosspostCopies from '@app/api/worker/tasks/SyncCrosspostCopies';
import syncCrosspostedMessage from '@app/api/worker/tasks/SyncCrosspostedMessage';
import syncDiscoveryIndex from '@app/api/worker/tasks/SyncDiscoveryIndex';
import syncFileShaBlocklists from '@app/api/worker/tasks/SyncFileShaBlocklists';
import syncUrlBlocklists from '@app/api/worker/tasks/SyncUrlBlocklists';
import {
	archiveInactiveThreads,
	deleteChannelThreads,
	removeThreadMembershipsForGuildMember,
	repairThreadIndexes,
} from '@app/api/worker/tasks/ThreadMaintenanceTasks';
import {backfillThreadSearch, syncThreadSearchDocument} from '@app/api/worker/tasks/ThreadSearchTasks';
import userProcessPendingDeletion from '@app/api/worker/tasks/UserProcessPendingDeletion';
import userProcessPendingDeletions from '@app/api/worker/tasks/UserProcessPendingDeletions';
import type {WorkerTaskName} from '@app/api/worker/WorkerLaneConfig';
import type {WorkerTaskHandler} from '@pkgs/worker/src/contracts/WorkerTask';

export const workerTasks: Record<WorkerTaskName, WorkerTaskHandler> = {
	applicationProcessDeletion,
	archiveInactiveThreads,
	deleteChannelThreads,
	removeThreadMembershipsForGuildMember,
	repairThreadIndexes,
	syncThreadSearchDocument,
	backfillThreadSearch,
	backfillDeletedUsers,
	backfillHiddenProfileBadges,
	backfillPasskeyTrait,
	backfillUserAclIndex,
	batchGuildAuditLogMessageDeletes,
	bulkAddGuildMembers: bulkAddGuildMembers,
	bulkBanFileShas: bulkBanFileShas,
	bulkDeleteMessagesForUsers: bulkDeleteMessagesForUsers,
	bulkDeleteSelfMessagesImmediate,
	bulkDeleteUserMessages,
	bulkScheduleUserDeletion: bulkScheduleUserDeletion,
	bulkUpdateGuildFeatures: bulkUpdateGuildFeatures,
	bulkUpdateUserFlags: bulkUpdateUserFlags,
	crosspostMessage,
	crosspostMessageChunk,
	deleteUserMessagesInGuildByTime,
	drainActivitySpool,
	endGuildVisitsForCode: endGuildVisitsForCodeTask,
	endUnassignedGuildVisits: endUnassignedGuildVisitsTask,
	expireAttachments,
	expireReportSnapshots,
	expireStaleJobs,
	extractEmbeds,
	guildProcessDeletion,
	handleMentions,
	handleMentionChunk,
	harvestGuildData,
	harvestUserData,
	indexChannelMessages,
	indexGuildMembers,
	joinSingleCommunityMembers,
	liftExpiredGuildInvitePauses,
	messageShred,
	notifyRegistrationApprovers,
	processAssetDeletionQueue,
	processCachePurgeQueue,
	processInactivityDeletions,
	processPendingBulkMessageDeletions,
	reconcileAttachmentDecay,
	prunePostgresKvTtl,
	pruneGuildVisits: pruneGuildVisitsTask,
	refreshSearchIndex,
	seedThreadPermissions,
	removeChannelFollowers,
	sendSystemDm,
	syncFileShaBlocklists,
	syncUrlBlocklists,
	syncDiscoveryIndex,
	syncCrosspostCopies,
	syncCrosspostedMessage,
	flushUserActivityBuffer,
	userProcessPendingDeletion,
	userProcessPendingDeletions,
};
