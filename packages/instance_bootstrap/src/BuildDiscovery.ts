// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
	InstanceAppPublic,
	InstanceCaptcha,
	InstanceCommunity,
	InstanceDiscoveryResponse,
	InstanceEndpoints,
	InstanceFeatures,
	InstancePush,
	InstanceRegistration,
	InstanceServices,
	InstanceSso,
} from '@osaca/instance_bootstrap/src/Types';
import type {LimitConfigSnapshot, LimitConfigWireFormat} from '@osaca/limits/src/LimitTypes';

export interface DiscoveryStaticInput {
	apiCodeVersion: number;
	endpoints: InstanceEndpoints;
	captcha: InstanceCaptcha;
	features: InstanceFeatures;
	push: InstancePush;
	appPublic: InstanceAppPublic;
}

export interface DiscoveryDynamicInput {
	sso: InstanceSso;
	registration: InstanceRegistration;
	community: InstanceCommunity;
	services: InstanceServices;
	limits: LimitConfigSnapshot | LimitConfigWireFormat;
}

export function buildDiscoveryResponse(
	staticInput: DiscoveryStaticInput,
	dynamicInput: DiscoveryDynamicInput,
): InstanceDiscoveryResponse {
	return {
		api_code_version: staticInput.apiCodeVersion,
		endpoints: staticInput.endpoints,
		captcha: staticInput.captcha,
		features: staticInput.features,
		sso: dynamicInput.sso,
		registration: dynamicInput.registration,
		community: dynamicInput.community,
		services: dynamicInput.services,
		limits: dynamicInput.limits,
		push: staticInput.push,
		app_public: staticInput.appPublic,
	};
}
