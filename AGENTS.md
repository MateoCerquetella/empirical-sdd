<!-- empirical-sdd:start -->
## Empirical SDD

Automatically use Empirical when the user asks to build, add, implement, change,
fix, refactor, remove, migrate, upgrade, update tests, or continue repository
work. The user does not need to mention Empirical.

1. Use the current agent; never launch another AI runtime.
2. For genuinely vague work, retrieve repository and living-spec context with empirical_explore or empirical explore "<problem>", then conduct the original five Socratic passes in the current conversation: problem/user, observable outcome, boundaries/non-goals, failure/risk, and verification. Ask one question at a time, add only a material follow-up, show the complete refined contract, and wait for explicit human approval before starting Fast or Complex. Do not merely repeat the packet's generic questions.
3. For concrete new work, choose Fast only when it is explicit, tiny, localized,
   reversible, low-risk, and non-UI. Choose Complex for everything else.
4. Start through `empirical_fast` or `empirical_complex`. Without MCP, run
   `empirical fast "<the user's request>"` or
   `empirical complex "<the user's request>"`.
5. Resume active work through `empirical_loop` or `empirical loop`; loop
   takes no request or profile.
6. Preserve the packet workstream; use a different named workstream for unrelated
   active work. Execute the action and complete its exact revision with all required
   evidence. Each completion response is already the next action; do not call
   status, next, or loop redundantly.
7. When Review returns Archive, apply its validated capability deltas with the
   returned archive operation. Continue until Done, Blocked, or genuinely awaiting
   human input. For Fast, trust the criterion in the returned packet, inspect only relevant project
   files, combine the focused test and diff review, and use the returned
   completion command. Do not reread Empirical internals or add redundant checks.

Quick exists only for legacy compatibility. Do not select it for new work or
add profile/JSON controls to the normal workflow.

Do not invent workflow state or weaken verification evidence. The committed
`.empirical/` directory is the source of truth.
<!-- empirical-sdd:end -->
