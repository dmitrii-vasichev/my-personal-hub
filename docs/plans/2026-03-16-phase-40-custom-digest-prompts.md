# Phase 40: Custom Digest Prompts

## Overview
Move digest prompts from hardcoded constants to user-editable settings with a dedicated UI page.

## Tasks

### Backend

1. **Add prompt columns to PulseSettings model**
   - Add `prompt_news`, `prompt_jobs`, `prompt_learning` (Text, nullable) to `PulseSettings` in `backend/app/models/telegram.py`
   - Create Alembic migration

2. **Update PulseSettings schemas**
   - Add 3 prompt fields to `PulseSettingsResponse` in `backend/app/schemas/pulse_settings.py`
   - Add 3 prompt fields to `PulseSettingsUpdate`

3. **Add defaults API endpoint**
   - New endpoint `GET /api/pulse/prompts/defaults` returning hardcoded default prompts
   - Move default prompt constants to a shared location (e.g., `backend/app/services/pulse_digest.py` keeps them, endpoint imports from there)

4. **Update digest generation to use custom prompts**
   - In `pulse_digest.py:generate_digest()`, load user's PulseSettings
   - Use custom prompt if set, fall back to hardcoded default
   - PulseSettings is already loaded in `pulse_scheduler.py`, pass it through

5. **Update `_to_response()` in API**
   - Add prompt fields to `_to_response()` dict in `backend/app/api/pulse_settings.py`

6. **Backend tests**
   - Test: custom prompt used when set
   - Test: default prompt used when custom is NULL
   - Test: defaults endpoint returns all 3 prompts
   - Test: prompt validation (max 5000 chars)

### Frontend

7. **Update TypeScript types**
   - Add `prompt_news`, `prompt_jobs`, `prompt_learning` to `PulseSettings` interface in `frontend/src/types/pulse-settings.ts`
   - Add same to `PulseSettingsUpdate`

8. **Add prompts hook**
   - New hook `usePulsePromptDefaults()` in `frontend/src/hooks/use-pulse-settings.ts` to fetch defaults

9. **Create Prompts page**
   - New page `frontend/src/app/(dashboard)/pulse/prompts/page.tsx`
   - Header: "Digest Prompts" with description
   - Category tabs: News / Jobs / Learning

10. **Create PromptEditor component**
    - New component `frontend/src/components/pulse/prompt-editor.tsx`
    - Sub-tabs: "Custom" / "Default"
    - Custom tab: textarea (full-width, resizable), Save button, character count (X / 5000)
    - Default tab: readonly code block with default prompt text
    - "Copy default to custom" button
    - "Reset to default" button (clears custom → NULL)
    - Badge on category tabs showing "Custom" / "Default" status

11. **Add navigation link**
    - Add "Prompts" link on `/pulse` page next to "Sources" link
    - Icon: `MessageSquareText` or `FileText`

12. **Frontend tests**
    - Test: PromptEditor renders with defaults
    - Test: save custom prompt
    - Test: reset to default
    - Test: character limit validation

## Dependencies
- Existing PulseSettings CRUD (no new tables)
- Existing category tabs pattern from Pulse page

## Risks
- Large Text fields in settings table (mitigated: max 5000 chars)
- Custom prompt might break digest quality (mitigated: easy reset to default)
