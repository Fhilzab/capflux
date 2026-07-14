// ============================================================================
// Fee-First Billing & Payment Architecture Refactor - Implementation Progress
// ============================================================================

## Core Deliverables Checklist

- [ ] 1. Update ER diagram (docs/database/ER_DIAGRAM.md)
- [ ] 2. Create SQL migration: 202607100012_tuition_and_fees.sql
- [ ] 3. Create SQL migration: 202607100013_student_schema_update.sql
- [ ] 4. Create SQL migration: 202607100014_registration_flow.sql
- [ ] 5. Create SQL migration: 202607100015_data_migration.sql
- [ ] 6. Create SQL migration: 202607100016_rls.sql
- [ ] 7. Create TypeScript types file (frontend/src/types/billing.ts)
- [ ] 8. Update Dexie schema (frontend/src/offline/localDb.ts)
- [ ] 9. Create TuitionConfigurationRepository
- [ ] 10. Create FeeRuleRepository
- [ ] 11. Create PaymentAccountRepository
- [ ] 12. Update StudentRepository (strict types, remove dva fields)
- [ ] 13. Update GuardianRepository (strict types)
- [ ] 14. Create TuitionConfigurationService
- [ ] 15. Create FeeRuleService
- [ ] 16. Update BillingService
- [ ] 17. Update StudentService (full registration flow)
- [ ] 18. Update PaymentService
- [ ] 19. Update PaymentGateway interface (backend)
- [ ] 20. Update MonnifyGateway implementation
- [ ] 21. Update LedgerService (platform fee creation)
- [ ] 22. Update WebhookVerifier
- [ ] 23. Update webhook route
- [ ] 24. Update syncEngine
- [ ] 25. Create migration report (docs/database/MIGRATION_REPORT.md)
- [ ] 26. Build verification (TypeScript check)