import {MlsDeliveryController} from '@app/api/mls/MlsDeliveryController';
// SPDX-License-Identifier: AGPL-3.0-or-later

import {AdminDownloadController} from '@app/api/admin/AdminDownloadController';
import {registerAdminControllers} from '@app/api/admin/controllers/index';
import {AttachmentController} from '@app/api/attachment/AttachmentController';
import {AccountEntryController} from '@app/api/auth/AccountEntryController';
import {AuthController} from '@app/api/auth/AuthController';
import {OriginHandoffController} from '@app/api/auth/OriginHandoffController';
import {PasskeyBridgeController} from '@app/api/auth/PasskeyBridgeController';
import {BlueskyOAuthController} from '@app/api/bluesky/BlueskyOAuthController';
import {registerChannelControllers} from '@app/api/channel/controllers/index';
import type {APIConfig} from '@app/api/config/APIConfig';
import {ConnectionController} from '@app/api/connection/ConnectionController';
import {DownloadController} from '@app/api/download/DownloadController';
import {ExperimentController} from '@app/api/experiment/ExperimentController';
import {FavoriteMemeController} from '@app/api/favorite_meme/FavoriteMemeController';
import {GatewayController} from '@app/api/gateway/GatewayController';
import {GuildController} from '@app/api/guild/controllers/index';
import {InstanceController} from '@app/api/instance/InstanceController';
import {InviteController} from '@app/api/invite/InviteController';
import {OAuth2ApplicationsController} from '@app/api/oauth/OAuth2ApplicationsController';
import {OAuth2Controller} from '@app/api/oauth/OAuth2Controller';
import {OpenAPIController} from '@app/api/openapi/OpenAPIController';
import {ReadStateController} from '@app/api/read_state/ReadStateController';
import {ReportController} from '@app/api/report/ReportController';
import {InternalRpcController} from '@app/api/rpc/InternalRpcController';
import {SearchController} from '@app/api/search/controllers/SearchController';
import {TestHarnessController} from '@app/api/test/TestHarnessController';
import {ThemeController} from '@app/api/theme/ThemeController';
import type {HonoApp} from '@app/api/types/HonoEnv';
import {UserController} from '@app/api/user/controllers/UserController';
import {VoiceNodeController} from '@app/api/voice/VoiceNodeController';
import {VoiceP2pConnectionReportController} from '@app/api/voice/VoiceP2pConnectionReportController';
import {WebhookController} from '@app/api/webhook/WebhookController';

export function registerControllers(routes: HonoApp, config: APIConfig): void {
	InternalRpcController(routes);
	GatewayController(routes);
	registerAdminControllers(routes);
	AdminDownloadController(routes);
	AuthController(routes);
	AccountEntryController(routes);
	OriginHandoffController(routes);
	PasskeyBridgeController(routes);
	AttachmentController(routes);
	registerChannelControllers(routes);
	ConnectionController(routes);
	BlueskyOAuthController(routes);
	InstanceController(routes);
	OpenAPIController(routes);
	DownloadController(routes);
	ExperimentController(routes);
	FavoriteMemeController(routes);
	InviteController(routes);
	ReadStateController(routes);
	ReportController(routes);
	GuildController(routes);
	SearchController(routes);
	ThemeController(routes);
	if (config.dev.testModeEnabled || config.nodeEnv === 'development') {
		TestHarnessController(routes);
	}
	UserController(routes);
	VoiceP2pConnectionReportController(routes);
	VoiceNodeController(routes);
	WebhookController(routes);
	OAuth2Controller(routes);
	OAuth2ApplicationsController(routes);
	MlsDeliveryController(routes);
}
