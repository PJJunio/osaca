// SPDX-License-Identifier: AGPL-3.0-or-later

import type {LimitConfigSnapshot, LimitConfigWireFormat} from '@osaca/limits/src/LimitTypes';
import type {DomainMigrationDiscoveryResponse} from '@osaca/schema/src/domains/admin/DomainMigrationSchemas';
import type {
	InstanceAppPublic,
	InstancePushDeliveryMode,
	InstanceRegistration,
	WellKnownOsacaResponse,
} from '@osaca/schema/src/domains/instance/InstanceSchemas';

export type {
	InstanceAppPublic,
	InstanceBranding,
	InstanceBuiltInGuildBadgeImages,
	InstanceCaptcha,
	InstanceCommunity,
	InstanceEndpoints,
	InstanceFeatures,
	InstanceGuildBadge,
	InstanceHiddenBuiltInGuildBadges,
	InstanceNotice,
	InstancePush,
	InstanceRegistration,
	InstanceServices,
	InstanceSetup,
} from '@osaca/schema/src/domains/instance/InstanceSchemas';

export type InstanceLegal = InstanceAppPublic['legal'];
export type InstanceDomainMigration = DomainMigrationDiscoveryResponse;

export const CURRENT_INSTANCE_CODENAME = 'tungsten';

export const REGISTRATION_MODES = Object.freeze(['open', 'approval', 'closed'] as const) satisfies ReadonlyArray<
	InstanceRegistration['mode']
>;

export const PUSH_DELIVERY_MODES = Object.freeze(['direct'] as const) satisfies ReadonlyArray<InstancePushDeliveryMode>;

export interface InstanceDiscoveryResponse extends Omit<WellKnownOsacaResponse, 'limits'> {
	limits: LimitConfigSnapshot | LimitConfigWireFormat;
}
