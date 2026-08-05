# Joplin Dictate Plugin: Core Functionality Test Plan

**Project:** joplin-dictate-plugin  
**Version:** 1.0.3 (Resilience pass)  
**Objective:** Test the full note-creation lifecycle, including mandatory raw-transcript fallback when LLM polish fails.

**Instructions:**

1. Fill in the **Actual Result** column for manual scenarios.
2. Run automated tests: `cd ~/Projects/joplin-dictate-plugin && npm ci && npm test`
3. Record Pass/Fail and notes.

---

## Test Suite: Core Note Creation and State Management

### Test Case 1: Basic Note Creation (Minimal Input)

**Function tested:** `processNoteCreation` (base functionality)  
**Pre-conditions:** Plugin enabled; Joplin running; polish disabled.  
**Scenario:** Transcribe a short phrase and save without polish.  
**Expected result:**

- Status shows "Creating note…"
- Note created in selected notebook with transcript as body

**Actual result:** __________________________________________________

---

### Test Case 2: Full Dictation and Basic Save

**Function tested:** `processNoteCreation` (normal path)  
**Pre-conditions:** Polish disabled; hands-free mic selected as input.  
**Scenario:** Dictate e.g. "Meeting notes about the Q3 roadmap."  
**Expected result:**

- Status: "Creating note…"
- Note title/content matches transcript

**Actual result:** __________________________________________________

---

### Test Case 3: Polishing Transcript (LLM Success)

**Function tested:** `processNoteCreation` + `polishTranscript`  
**Pre-conditions:** Polish enabled; LLM server reachable.  
**Scenario:** Dictate e.g. "can u meet next week?"  
**Expected result:**

- Status: "Polishing transcript…" then "Polishing complete. Saving note…"
- Note body reflects polished LLM output

**Actual result:** __________________________________________________

---

### Test Case 4 (HIGH PRIORITY): Mandatory Raw Save Fallback Test

**Function tested:** `processNoteCreation` error handling — zero data loss  
**Pre-conditions:** Polish enabled; LLM unreachable (e.g. URL `http://127.0.0.1:9`)  
**Scenario:** Dictate a phrase; stop recording; allow polish to fail.  
**Expected result:**

- Status: "Polishing transcript…" then "Polish failed — saving raw transcript…"
- Note is still created
- Note body is the **original raw transcript** (not empty, not polished)
- Toast/status includes "(raw transcript — polish failed)"

**Automated coverage:** `npm test` — describe block **Mandatory Raw Save Fallback Test** (API error + timeout mocks).

**Actual result:** __________________________________________________

---

## Test Suite: Advanced Features and Edge Cases

### Test Case 5: Multi-Status Tracking (Lifecycle)

**Function tested:** `onNoteCreationStatus` callback  
**Pre-conditions:** Polish enabled; LLM working.  
**Scenario:** Monitor status sequence during polish path.  
**Expected result:** "Polishing transcript…" → "Polishing complete. Saving note…"  
**Actual result:** __________________________________________________

---

### Test Case 6: Large Transcripts

**Function tested:** Pipeline scalability  
**Pre-conditions:** Long recording or WAV file.  
**Scenario:** Transcribe and save a long transcript.  
**Expected result:** Completes without crash; note saved.  
**Actual result:** __________________________________________________

---

### Test Case 7: Automated Test Suite (Vitest)

**Function tested:** `src/__tests__/notes.test.ts`  
**Pre-conditions:** `npm ci` run from project root (installs vitest in `node_modules`).  
**Scenario:** `npm test`  
**Expected result:** All tests pass, including Mandatory Raw Save Fallback Test.  
**Actual result:** __________________________________________________

---

**End of test plan.**
