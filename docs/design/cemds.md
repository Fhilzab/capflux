# docs/design/cemds.md

# CAPFLUX Enterprise Minimalism Design System (CEMDS)

**Version:** 1.0

**Status:** Living Standard

**Product:** CAPFLUX Fee-First

**Company:** FHILZAB NIG LTD

---

# 1. Purpose

The CAPFLUX Enterprise Minimalism Design System (CEMDS) defines the visual language, interaction principles, component standards, and accessibility rules for every CAPFLUX product.

It ensures every screen feels as though it was designed by one team at one point in time.

This document is the single source of truth for UI and UX.

---

# 2. Design Philosophy

## Our Mission

Design software that helps people make financial decisions with confidence.

We are not designing beautiful interfaces.

We are designing trustworthy financial tools.

Every pixel must reduce uncertainty.

---

# 3. Core Principles

## Clarity over Aesthetic

Information should always be easier to understand than it is to admire.

---

## Confidence over Color

Color supports information.

Color never replaces information.

---

## Structure over Decoration

Typography

Spacing

Hierarchy

Layout

Alignment

should communicate more than decoration.

---

## Motion with Purpose

Animation exists to explain.

Never entertain.

Never distract.

Every movement should reinforce:

Trust

Money Flow

Synchronization

Success

---

## Finance Before Features

Every interface should answer

"What financial decision does this help the user make?"

If none,

the feature probably shouldn't exist.

---

# 4. Product Identity

CAPFLUX is NOT

❌ School Management Software

❌ ERP

❌ LMS

❌ Attendance System

❌ Payroll

CAPFLUX IS

✓ Financial Operating System

✓ Fee Collection Platform

✓ Payment Infrastructure

✓ Financial Intelligence Platform

---

# 5. Design Personality

Professional

Minimal

Calm

Confident

Precise

Structured

Reliable

Fast

Readable

Trustworthy

---

# 6. Color Philosophy

We intentionally use fewer colors.

Financial software should reduce cognitive load.

---

## Brand Accent

Emerald

Represents

Money

Success

Growth

Completion

Trust

---

## Light Theme

Background

White

Surface

Neutral 50

Card

White

Primary Text

Neutral 950

Secondary Text

Neutral 600

Border

Neutral 200

Accent

Emerald 600

Danger

Red 700

Warning

Amber 600

Info

Blue 600

Success

Emerald 600

---

## Dark Theme

Background

Slate 950

Surface

Slate 900

Card

Slate 900

Primary Text

White

Secondary Text

Slate 300

Border

Slate 800

Accent

Emerald 500

---

# 7. Never Use

❌ Random gradients

❌ Glassmorphism

❌ Neumorphism

❌ Heavy shadows

❌ Decorative textures

❌ Multiple accent colors

❌ Pastel interfaces

❌ Rainbow dashboards

---

# 8. Typography

Typography carries hierarchy.

Not color.

---

Display

56–72px

Bold

---

Heading 1

40px

Bold

---

Heading 2

32px

Bold

---

Heading 3

24px

Semibold

---

Heading 4

20px

Semibold

---

Body Large

18px

---

Body

16px

---

Caption

14px

---

Small Label

12px

Uppercase

Medium Weight

---

Financial Data

Always

font-mono

Examples

DVA

Ledger IDs

Amounts

Transaction IDs

Reference Numbers

---

Student Lists

Surname

Always

Uppercase

Bold

Example

JOHNSON

Michael

---

# 9. Grid

Desktop

12 Columns

---

Tablet

8 Columns

---

Mobile

4 Columns

---

Maximum Width

1440px

---

Content Width

1280px

---

# 10. Spacing

Use the 8-point system.

4

8

16

24

32

40

48

64

80

96

Never invent spacing.

---

# 11. Radius

Buttons

10px

Cards

12px

Modal

16px

Drawer

16px

Tables

12px

---

# 12. Elevation

Prefer borders over shadows.

When needed

Small

Medium

Large

Never floating UI.

---

# 13. Icons

Use one icon family only.

Lucide

or

Heroicons

24px

20px

16px

Never mix icon libraries.

---

# 14. Components

Official Components

CmButton

CmInput

CmSelect

CmCard

CmBadge

CmStatusChip

CmModal

CmDrawer

CmToast

CmAlert

CmPagination

CmTabs

CmTable

CmLoading

Never recreate these.

Reuse them.

---

# 15. Tables

Financial tables are core.

Requirements

Sticky Header

Hover State

Monospaced Numbers

Sortable Columns

Column Filters

Pagination

Status Chips

No zebra stripes.

---

# 16. Forms

Visible borders.

Clear labels.

Large click targets.

Validation below input.

Never placeholder-only forms.

---

# 17. Buttons

Primary

Emerald

Secondary

White / Slate

Danger

Red

Ghost

Transparent

Loading State

Mandatory.

---

# 18. Navigation

Sidebar

Minimal

Grouped

Icons aligned

Consistent spacing

---

Top Navigation

Greeting

Search

Sync Status

Notifications

Profile

Nothing else.

---

# 19. Dashboard Rules

Every dashboard must answer

"What requires my attention?"

within five seconds.

Priority

Today's Collection

Outstanding Fees

Pending Verification

Sync Health

System Health

Alerts

Everything else is secondary.

---

# 20. Offline-First UX

Offline

Visible Badge

Queue Status

Sync Indicator

Reconnect Status

Payment disabled

Everything else works.

---

# 21. Loading

Skeletons

Not spinners.

Only use spinners for

Buttons

Small async operations

---

# 22. Empty States

Every empty state must

Explain

Guide

Offer next action

Never leave blank screens.

---

# 23. Accessibility

WCAG AA

Keyboard navigation

Visible focus

ARIA labels

Reduced motion

High contrast

---

# 24. Motion

Animations explain.

Never decorate.

Maximum

300ms

Use

Opacity

Transform

Scale

Translate

Avoid expensive properties.

---

# 25. Performance

60 FPS

Lazy Loading

SVG Icons

Optimized Images

Minimal JS

Excellent Lighthouse Score

---

# 26. Responsive Philosophy

Desktop First

Tablet

Mobile

Graceful degradation

Never hide critical information.

---

# 27. Engineering Rules

Every touched page

must

Use CEMDS.

No exceptions.

Legacy UI

must be upgraded.

Never introduce new legacy components.

---

# 28. Offline-First Principle

Everything

Offline First

Except

Payment Processing

Payment Verification

Gateway Communication

Webhook Handling

Settlement

Bank APIs

These require internet.

Everything else should function locally.

---

# 29. Design Checklist

Before merging:

✓ Uses semantic tokens

✓ Uses shared components

✓ Supports Light Theme

✓ Supports Dark Theme

✓ Accessible

✓ Responsive

✓ Offline-first compliant

✓ No hardcoded colors

✓ No duplicated components

✓ No legacy UI

✓ No inconsistent spacing

✓ No visual regressions

---

# 30. Final Philosophy

We don't design software that looks expensive.

We design software that makes financial operations feel reliable.

Every screen should communicate one thing:

"I can trust this system with my school's money."

---

## CAPFLUX Design Manifesto

Clarity over Aesthetic.

Confidence over Color.

Structure over Decoration.

Finance before