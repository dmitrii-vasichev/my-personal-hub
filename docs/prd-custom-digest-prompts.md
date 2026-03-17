# PRD: Custom Digest Prompts

## Metadata
| Field | Value |
|-------|-------|
| Author | Dmitry Vasichev |
| Date | 2026-03-16 |
| Status | Approved |
| Priority | P1 |

## Problem Statement
Digest prompts are hardcoded in `backend/app/services/pulse_digest.py`. Users cannot customize how digests are structured, what language rules to follow, or what sections to include — without modifying source code. This makes the digest format rigid and requires a developer to change it.

## User Scenarios
### Scenario 1: Customize News Digest Format
**As an** admin, **I want to** edit the news digest prompt, **so that** I can control the structure, grouping, and language of generated digests.

### Scenario 2: View Default Prompt
**As an** admin, **I want to** see the default prompt for each category, **so that** I can use it as a starting point for customization or revert to it.

### Scenario 3: Reset Custom Prompt
**As an** admin, **I want to** reset a custom prompt back to the default, **so that** I can undo changes that produce poor results.

## Functional Requirements

### P0 (Must Have)
- [ ] FR-1: Add 3 nullable Text columns to `PulseSettings` model: `prompt_news`, `prompt_jobs`, `prompt_learning`
- [ ] FR-2: Alembic migration for the new columns
- [ ] FR-3: API endpoints to read and update custom prompts (part of existing PulseSettings CRUD)
- [ ] FR-4: Backend falls back to hardcoded defaults when custom prompt is NULL
- [ ] FR-5: Expose default prompts via API endpoint (`GET /api/pulse/prompts/defaults`)
- [ ] FR-6: New page `/pulse/prompts` with category tabs (News / Jobs / Learning)
- [ ] FR-7: Within each category tab: sub-tabs "Custom" and "Default"
- [ ] FR-8: "Custom" sub-tab: editable textarea (full-width, resizable) with Save button
- [ ] FR-9: "Default" sub-tab: readonly display of the hardcoded default prompt
- [ ] FR-10: "Copy default to custom" button — copies default text into the custom textarea
- [ ] FR-11: "Reset to default" button — clears custom prompt (sets to NULL), reverts to default
- [ ] FR-12: Navigation link "Prompts" on `/pulse` page (next to "Sources" link)
- [ ] FR-13: Validation: max 5000 characters per prompt (hardcoded limit)

### P1 (Should Have)
- [ ] FR-14: Visual indicator on category tabs showing which prompts are customized (e.g., dot badge)
- [ ] FR-15: Character count display near textarea (e.g., "1234 / 5000")
- [ ] FR-16: Unsaved changes warning when navigating away

## Non-Functional Requirements
- Performance: prompt loading should be instant (part of existing settings fetch)
- Security: only admin users can read/edit prompts (existing auth)

## Technical Design

### Storage
Add 3 columns to existing `PulseSettings` model (no new tables):
```python
prompt_news: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
prompt_jobs: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
prompt_learning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
```

### Prompt Resolution Logic
In `pulse_digest.py`, replace direct constant usage:
```python
# Before
system_prompt = CATEGORY_PROMPTS.get(category, NEWS_SYSTEM_PROMPT)

# After
custom = getattr(pulse_settings, f"prompt_{category}", None)
system_prompt = custom or CATEGORY_PROMPTS.get(category, NEWS_SYSTEM_PROMPT)
```

### API
- `GET /api/pulse/prompts/defaults` — returns `{news: str, jobs: str, learning: str}` with hardcoded defaults
- Existing `GET/PUT /api/pulse/settings` — extended with `prompt_news`, `prompt_jobs`, `prompt_learning` fields

### Frontend
- New page: `frontend/src/app/(dashboard)/pulse/prompts/page.tsx`
- New component: `frontend/src/components/pulse/prompt-editor.tsx`
- Layout: category tabs (News/Jobs/Learning) → sub-tabs (Custom/Default) → textarea + action buttons

## Out of Scope
- Configurable character limit (hardcoded at 5000)
- Diff view between custom and default
- Prompt versioning / history
- Per-source prompts (all sources in a category share one prompt)
- Prompt testing / preview with sample messages
