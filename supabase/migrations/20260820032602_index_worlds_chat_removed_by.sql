-- Cover the optional moderation-actor foreign key for account deletion and review lookups.
create index worlds_chat_messages_removed_by_idx
  on public.worlds_chat_messages (removed_by);
