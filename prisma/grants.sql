-- Brief 3.2.3. Run by scripts/db-reset.ts after migrations, as hub_owner.
GRANT USAGE ON SCHEMA public TO hub_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO hub_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hub_app;
GRANT DELETE ON "EntityAlias", "EntityBic", "VolumeTier", "NoteParticipant", "ActionItem" TO hub_app;
REVOKE UPDATE ON "AuditEntry" FROM hub_app;   -- SELECT and INSERT only (M16 AC3)
REVOKE UPDATE ON "IssueNote", "IssueCommunication", "IssueTimeCorrection" FROM hub_app;   -- append-only (M21 AC7, M22 AC8, time corrections)
