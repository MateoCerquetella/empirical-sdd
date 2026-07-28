# Configuration

`ai/empirical.toml` is repository policy. Defaults favor a fast workflow with strong
evidence and no delivery side effects.

```toml
schema_version = 2
profile = "quick"

[loop_policy]
auto_continue = true
max_repair_attempts = 2

[evidence]
require_per_criterion = true
tests = true
code_review = true
independent_code_review = true
browser = "required_for_ui"
screenshots_for_ui = true
screenshot_review_for_ui = true

[delivery]
commit = false
push = false
pull_request = false
paths = []
commit_message = "feat: complete {spec}"
remote = "origin"
draft_pull_request = true
```

Browser policy is `disabled`, `when_available`, `required_for_ui`, or
`required`. A UI screenshot requirement is separate from browser policy so a
team may accept screenshots produced outside an automated browser while still
requiring visual review.

Delivery settings are intent, not authority. Enabling them cannot cause a
command to run until a caller also supplies the corresponding `--allow-*`
flags. `pull_request = true` requires `push = true`. Committing requires one or
more explicit relative `paths`; root, traversal, and pre-staged paths outside
those scopes are rejected.

See [adapters](adapters.md) for per-phase command configuration and
[config.schema.json](../schemas/config.schema.json) for the full logical shape.
