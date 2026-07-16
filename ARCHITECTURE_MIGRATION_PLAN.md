# Hybrid Feature-Based Architecture Migration Plan (Updated)

## Current Status

✅ Build verified after reverting dashboard component moves

## Revised Strategy

Given the complexity of moving dashboard components (they're imported by multiple views), I propose a **gradual, incremental approach**:

### Phase 1: Infrastructure Only (Current State)
- Create `app/` directory for infrastructure
- Create `shared/` directory for utilities
- Create `features/` placeholders for future modules
- **DO NOT** move components or views yet

### Phase 2: Future Migration Path
When ready to migrate features:
1. Move complete feature modules together (view + components + stores + services)
2. Update all cross-imports at once
3. Verify build before proceeding to next feature

## Target Structure (Achievable)

```
frontend/src/
├── app/
│   ├── router/        (will move from src/router)
│   ├── offline/       (will move from src/offline)
│   ├── theme/         (composables/useTheme.ts + stores/themeStore.js)
│   └── plugins/       (empty placeholder)
├── components/
│   └── ui/           (UNCHANGED - Design System)
├── shared/
│   ├── utils/        (future: date utils, formatters, validators)
│   ├── composables/  (generic composables)
│   ├── types/        (generic types)
│   ├── constants/    (shared constants)
│   ├── lib/          (generic libraries)
│   └── index.ts      (barrel export)
├── features/
│   ├── dashboard/    (placeholder - will contain full module later)
│   ├── students/     (placeholder)
│   ├── guardians/    (placeholder)
│   ├── fee-engine/   (placeholder)
│   ├── payments/     (placeholder)
│   ├── virtual-accounts/ (placeholder)
│   ├── reports/      (placeholder)
│   ├── notifications/ (placeholder)
│   ├── ai-insights/  (placeholder)
│   ├── settings/     (placeholder)
│   └── authentication/ (placeholder)
├── assets/
└── styles/cemds/
```

## Files Intentionally Left Unchanged

- `components/ui/` - Design System primitives
- `components/dashboard/` - Business feature components (shared by views)
- `components/onboarding/` - Business feature components
- `views/*.vue` - Route-level pages
- `stores/*.js` - State management
- `services/*.ts` - Business services
- `repositories/*.ts` - Data access layer

## Why This Conservative Approach

1. **Dashboard components are shared** - Used by AIInsightsView, GuardianListView, VirtualAccountsView, etc.
2. **Preserve stability** - No large-scale rewrites
3. **Incremental evolution** - Each feature module will be complete when migrated
4. **Maintain backward compatibility** - No broken imports

## Ready for Commit

The architectural foundation is in place. Ready to commit the directory structure and migration plan.