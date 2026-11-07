%% SPDX-License-Identifier: AGPL-3.0-or-later

-module(guild_push_message).
-typing([eqwalizer]).

-export([send/1, compact_data/2, user_roles/2, role_ids/1, large_guild_meta/1]).

-type user_id() :: integer().
-type event_data() :: map().
-spec send(#{
    message_data := map(),
    guild_id := integer(),
    eligible_user_ids := [integer()],
    user_roles := map(),
    connected_users := map(),
    data := map(),
    large_guild_meta := map() | undefined,
    held := guild_push_engagement:held_push()
}) -> ok.
send(
    #{
        message_data := MessageData,
        eligible_user_ids := EligibleUserIds,
        data := Data,
        held := Held
    } = Request
) ->
    AuthorIdBin = maps:get(<<"id">>, maps:get(<<"author">>, MessageData, #{}), undefined),
    case guild_dispatch_decorate:parse_snowflake(<<"author.id">>, AuthorIdBin) of
        undefined ->
            ok;
        AuthorId ->
            ChannelIdBin = maps:get(<<"channel_id">>, MessageData),
            PushMessageData = push_message_data(
                MessageData, ChannelIdBin, EligibleUserIds ++ element(1, Held), Data
            ),
            Params = push_params(Request#{
                message_data := PushMessageData,
                author_id => AuthorId
            }),
            ok = guild_push_engagement:send(EligibleUserIds, Params),
            guild_push_engagement:hold(Held, Params)
    end.

-spec push_message_data(event_data(), term(), [user_id()], map()) -> event_data().
push_message_data(MessageData, ChannelIdBin, UserIds, Data) ->
    ChannelId = guild_dispatch_decorate:parse_snowflake(<<"channel_id">>, ChannelIdBin),
    case thread_push_message_data(MessageData, ChannelId, UserIds, Data) of
        undefined -> MessageData;
        {ThreadMessageData, _ThreadName} -> ThreadMessageData
    end.

-spec thread_push_message_data(event_data(), integer() | undefined, [user_id()], map()) ->
    {event_data(), binary()} | undefined.
thread_push_message_data(_MessageData, undefined, _UserIds, _Data) ->
    undefined;
thread_push_message_data(MessageData, ChannelId, UserIds, Data) ->
    guild_thread_push:push_message_data(MessageData, ChannelId, UserIds, Data).

-spec push_params(map()) -> map().
push_params(#{
    message_data := MessageData,
    guild_id := GuildId,
    user_roles := UserRolesMap,
    connected_users := ConnectedUsers,
    data := Data,
    author_id := AuthorId,
    large_guild_meta := LargeGuildMeta
}) ->
    Guild = maps:get(<<"guild">>, Data),
    DefaultMessageNotifications = maps:get(<<"default_message_notifications">>, Guild, 0),
    #{
        message_data => MessageData,
        guild_id => GuildId,
        author_id => AuthorId,
        guild_default_notifications => DefaultMessageNotifications,
        user_roles => UserRolesMap,
        connected_users => ConnectedUsers,
        guild_member_count => meta_member_count(LargeGuildMeta),
        guild_features => meta_features(LargeGuildMeta)
    }.

-spec meta_member_count(map() | undefined) -> non_neg_integer() | undefined.
meta_member_count(#{member_count := MemberCount}) -> MemberCount;
meta_member_count(_Meta) -> undefined.

-spec meta_features(map() | undefined) -> [binary()] | undefined.
meta_features(#{features := Features}) -> Features;
meta_features(_Meta) -> undefined.

-spec user_roles(map(), [integer()]) -> #{integer() => [integer()]}.
user_roles(Members, EligibleUserIds) ->
    lists:foldl(
        fun(UserId, Acc) -> add_user_roles(UserId, Members, Acc) end,
        #{},
        EligibleUserIds
    ).

-spec add_user_roles(user_id(), map(), #{user_id() => [integer()]}) ->
    #{user_id() => [integer()]}.
add_user_roles(UserId, Members, Acc) ->
    case maps:get(UserId, Members, undefined) of
        undefined -> Acc;
        Member -> Acc#{UserId => role_ids(Member)}
    end.

-spec role_ids(map()) -> [integer()].
role_ids(Member) ->
    Roles = maps:get(<<"roles">>, Member, []),
    lists:foldl(
        fun collect_role_id/2,
        [],
        Roles
    ).

-spec collect_role_id(term(), [integer()]) -> [integer()].
collect_role_id(Role, Acc) ->
    case validation:validate_snowflake(<<"role">>, Role) of
        {ok, RoleId} -> [RoleId | Acc];
        _ -> Acc
    end.

-spec large_guild_meta(map()) -> map() | undefined.
large_guild_meta(State) ->
    case maps:get(member_count, State, undefined) of
        MemberCount when is_integer(MemberCount), MemberCount >= 0 ->
            #{member_count => MemberCount, features => guild_features(State)};
        _ ->
            undefined
    end.

-spec guild_features(map()) -> [binary()].
guild_features(State) ->
    Data = maps:get(data, State, #{}),
    Guild = maps:get(<<"guild">>, Data, #{}),
    case maps:get(<<"features">>, Guild, []) of
        Features when is_list(Features) -> Features;
        _ -> []
    end.

-spec compact_data(map(), map()) -> map().
compact_data(Data, FormatMembers) ->
    WithoutRevision = maps:remove(member_list_revision, Data),
    WithoutRevision#{
        <<"members">> => FormatMembers,
        members_normalized => FormatMembers,
        members_sorted_ids => lists:sort(maps:keys(FormatMembers)),
        <<"member_role_index">> =>
            guild_data_index_members:build_member_role_index(FormatMembers)
    }.
