# Evaluation harness

This repository has no real-world quality benchmark. The sample set below is synthetic and only checks whether obvious facts survive extraction; it cannot establish that handoffs work reliably for real projects.

Run the app locally with an AI provider configured, then set `EVAL_URL` (default `http://localhost:3000`) and optionally `ACCESS_CODE` in the shell. Run `node evaluation/run.mjs`. Each case is sent to `/api/snapshot`; the script reports simple substring recall for expected fields. To use another dataset, set `EVAL_DATASET` to a JSON file with the same shape as `cases.json` (maximum 100 cases). Do not add private conversations to the sample set without consent and redaction.

Add cases that reflect real work only after removing secrets and personal data. Review misses manually; the score is not a substitute for a receiving-model handoff test. The harness currently evaluates extraction coverage, not whether another model successfully continues the work.
