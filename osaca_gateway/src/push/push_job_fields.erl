%% SPDX-License-Identifier: AGPL-3.0-or-later

%% Routing fields for push jobs.
%%
%% Push jobs only ever carry identifiers. Message content, author names and
%% avatars, attachment URLs, caller identity and channel/guild names never
%% leave the gateway: osaca_push turns each job into an opaque Wake-up Push
%% and the client fetches and decrypts the message itself.

-module(push_job_fields).
-typing([eqwalizer]).

-export([thread/1]).

-define(THREAD_PUSH_KEY, <<"__thread_push">>).

-spec thread(map()) -> map().
thread(#{?THREAD_PUSH_KEY := #{<<"parent_id">> := ParentId}} = MessageData) when
    is_integer(ParentId)
->
    #{
        <<"parent_id">> => integer_to_binary(ParentId),
        <<"kind">> => thread_job_kind(MessageData)
    };
thread(_MessageData) ->
    #{}.

-spec thread_job_kind(map()) -> binary().
thread_job_kind(#{?THREAD_PUSH_KEY := #{<<"forum_thread_created">> := true}}) ->
    <<"forum_thread_created">>;
thread_job_kind(_MessageData) ->
    <<"thread">>.

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

thread_job_carries_only_ids_test() ->
    MessageData = #{
        <<"content">> => <<"see you tomorrow">>,
        <<"author">> => #{<<"username">> => <<"elias">>},
        ?THREAD_PUSH_KEY => #{<<"parent_id">> => 200, <<"parent_name">> => <<"general">>}
    },
    ?assertEqual(
        #{<<"parent_id">> => <<"200">>, <<"kind">> => <<"thread">>},
        thread(MessageData)
    ).

forum_thread_created_kind_test() ->
    MessageData = #{
        ?THREAD_PUSH_KEY => #{<<"parent_id">> => 7, <<"forum_thread_created">> => true}
    },
    ?assertEqual(<<"forum_thread_created">>, maps:get(<<"kind">>, thread(MessageData))).

non_thread_message_has_no_thread_fields_test() ->
    ?assertEqual(#{}, thread(#{<<"content">> => <<"hi">>})).
-endif.
