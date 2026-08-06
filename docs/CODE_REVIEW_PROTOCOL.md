# Code Review Protocol: Greptile Integration
## 🛡️ Review Workflow
When a component is ready for peer review, the following sequence *must* be executed:

1.  **Commit:** Ensure all changes are committed to the target branch.
2.  **Review Execution:** Run the agent review command: `greptile review --agent`.
3.  **PR Creation:** Upon successful review output, use the `gh github-pr-workflow` skill to open the resulting Pull Request.

### 🐛 Pitfalls & Notes
*   The process confirms that the `greptile` tool now correctly handles the "Polishing complete" state, preventing the UI from unlocking buttons prematurely.
*   This workflow should replace any ad-hoc review commands and must be followed strictly for all feature handoffs.
