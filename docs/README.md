# Test plan files (Joplin Dictate plugin)

| File | Audience | Notes |
|------|----------|-------|
| `joplin_plugin_test_plan.md` | **Hermes / Cursor** | Source of truth — always use `read_file` on this |
| `joplin_plugin_test_plan.docx` | Word / LibreOffice | Real OOXML (LibreOffice export). Hermes can extract text if needed |
| `joplin_plugin_test_plan.odt` | LibreOffice (human) | ODF format; Hermes cannot `read_file` — use `.md` instead |
| `joplin_plugin_test_plan.odf` | Same as `.odt` | Copy for naming convention only |

See drop box: `20260803_SYSTEM_PROTOCOL_hermes-read-file-office-formats.md`
