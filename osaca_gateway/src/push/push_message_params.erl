%% SPDX-License-Identifier: AGPL-3.0-or-later

-module(push_message_params).
-typing([eqwalizer]).

-export([context/1, owner_key/1, suppresses_notifications/1]).

-export_type([context/0]).

-define(MAX_GUILD_FEATURES, 64).
-define(MESSAGE_TYPE_DEFAULT, 0).
-define(MESSAGE_TYPE_REPLY, 19).
-define(PUSHABLE_MESSAGE_TYPES, [?MESSAGE_TYPE_DEFAULT, ?MESSAGE_TYPE_REPLY]).
-define(MESSAGE_FLAG_SUPPRESS_NOTIFICATIONS, 4096).

-type context() :: #{
    message_data := map(),
    user_ids := [pos_integer()],
    guild_id := non_neg_integer(),
    author_id := pos_integer(),
    channel_id := pos_integer(),
    message_id := pos_integer(),
    guild_default_notifications := integer(),
    user_roles := map(),
    connected_users := map(),
    large_guild_metadata := map() | undefined
}.

-spec context(map()) -> {ok, context()} | {error, term()}.
context(Params) ->
    case maps:get(message_data, Params, #{}) of
        MessageData when is_map(MessageData) -> context_from_message_data(Params, MessageData);
        _ -> {error, invalid_message_data}
    end.

-spec context_from_message_data(map(), map()) -> {ok, context()} | {error, term()}.
context_from_message_data(Params, MessageData) ->
    UserIds = user_ids(maps:get(user_ids, Params, [])),
    GuildId = guild_id(maps:get(guild_id, Params, undefined)),
    AuthorId = snowflake_id:parse_maybe(maps:get(author_id, Params, undefined)),
    ChannelId = snowflake_id:parse_maybe(
        maps:get(<<"channel_id">>, MessageData, undefined)
    ),
    MessageId = snowflake_id:parse_maybe(maps:get(<<"id">>, MessageData, undefined)),
    Notifications = push_normalize:notification_level(
        maps:get(guild_default_notifications, Params, undefined)
    ),
    validate(#{
        message_data => MessageData,
        user_ids => UserIds,
        guild_id => GuildId,
        author_id => AuthorId,
        channel_id => ChannelId,
        message_id => MessageId,
        guild_default_notifications => Notifications,
        user_roles => maps:get(user_roles, Params, #{}),
        connected_users => maps:get(connected_users, Params, #{}),
        large_guild_metadata => large_guild_metadata(Params)
    }).

-spec large_guild_metadata(map()) -> map() | undefined.
large_guild_metadata(Params) ->
    MemberCount = maps:get(guild_member_count, Params, undefined),
    Features = maps:get(guild_features, Params, undefined),
    build_large_guild_metadata(MemberCount, Features).

-spec build_large_guild_metadata(term(), term()) -> map() | undefined.
build_large_guild_metadata(MemberCount, Features) when
    is_integer(MemberCount), MemberCount >= 0, is_list(Features)
->
    #{member_count => MemberCount, features => bounded_features(Features, [], 0)};
build_large_guild_metadata(_MemberCount, _Features) ->
    undefined.

-spec bounded_features(term(), [binary()], non_neg_integer()) -> [binary()].
bounded_features(_Features, Acc, ?MAX_GUILD_FEATURES) ->
    lists:reverse(Acc);
bounded_features([Feature | Rest], Acc, Count) when is_binary(Feature) ->
    bounded_features(Rest, [Feature | Acc], Count + 1);
bounded_features([_Feature | Rest], Acc, Count) ->
    bounded_features(Rest, Acc, Count);
bounded_features(_Features, Acc, _Count) ->
    lists:reverse(Acc).

-spec owner_key(map()) -> term().
owner_key(Params) ->
    case user_ids(maps:get(user_ids, Params, [])) of
        [UserId | _] -> UserId;
        [] -> owner_fallback_key(Params)
    end.

-spec validate(map()) -> {ok, context()} | {error, term()}.
validate(#{user_ids := []}) ->
    {error, no_valid_users};
validate(#{guild_id := invalid}) ->
    {error, invalid_guild_id};
validate(#{author_id := undefined}) ->
    {error, invalid_author_id};
validate(#{channel_id := undefined}) ->
    {error, invalid_channel_id};
validate(#{message_id := undefined}) ->
    {error, invalid_message_id};
validate(#{guild_default_notifications := undefined}) ->
    {error, invalid_guild_default_notifications};
validate(Context) ->
    validate_message_type(message_type(Context), Context).

-spec validate_message_type(integer(), context()) -> {ok, context()} | {error, term()}.
validate_message_type(Type, Context) ->
    case lists:member(Type, ?PUSHABLE_MESSAGE_TYPES) of
        true -> validate_notifications(Context);
        false -> {error, {unpushable_message_type, Type}}
    end.

-spec validate_notifications(context()) -> {ok, context()} | {error, term()}.
validate_notifications(#{message_data := MessageData} = Context) ->
    case suppresses_notifications(MessageData) of
        true -> {error, suppressed_notifications};
        false -> {ok, Context}
    end.

-spec suppresses_notifications(map()) -> boolean().
suppresses_notifications(#{<<"flags">> := Flags}) when is_integer(Flags) ->
    Flags band ?MESSAGE_FLAG_SUPPRESS_NOTIFICATIONS =/= 0;
suppresses_notifications(_MessageData) ->
    false.

-spec message_type(context()) -> integer().
message_type(#{message_data := MessageData}) ->
    normalize_message_type(maps:get(<<"type">>, MessageData, ?MESSAGE_TYPE_DEFAULT)).

-spec normalize_message_type(term()) -> integer().
normalize_message_type(Type) when is_integer(Type) ->
    Type;
normalize_message_type(_Type) ->
    ?MESSAGE_TYPE_DEFAULT.

-spec owner_fallback_key(map()) -> term().
owner_fallback_key(Params) ->
    case snowflake_id:parse_maybe(maps:get(author_id, Params, undefined)) of
        undefined -> snowflake_id:parse_maybe(maps:get(guild_id, Params, undefined));
        AuthorId -> AuthorId
    end.

-spec guild_id(term()) -> non_neg_integer() | invalid.
guild_id(undefined) ->
    invalid;
guild_id(null) ->
    invalid;
guild_id(0) ->
    0;
guild_id(<<"0">>) ->
    0;
guild_id(Value) ->
    case snowflake_id:parse_maybe(Value) of
        undefined -> invalid;
        GuildId -> GuildId
    end.

-spec user_ids(term()) -> [pos_integer()].
user_ids(Values) when is_list(Values) ->
    lists:filtermap(fun snowflake_id:filter/1, Values);
user_ids(_) ->
    [].
