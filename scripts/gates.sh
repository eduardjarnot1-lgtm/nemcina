#!/usr/bin/env bash
#
# The gates, in one place, run the same way here and in CI.
#
# They used to be a list of steps written out in the workflow file, which meant
# "I ran the checks" locally and "the checks ran" in CI were two different
# claims about two different lists. They drifted the first time it mattered: a
# builder was added to the CI list that exits non-zero with no arguments, and
# the local rehearsal that was supposed to have caught it had checked whether a
# rebuild left a diff — not whether the builder had run at all.
#
# So: one script. CI calls it. Run it before you push and you have run exactly
# what CI will run, including the exit codes.
#
#   ./scripts/gates.sh
#
# It does not build the app or run the browser smoke test; those need an export
# and belong after this, not inside it.

set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# app/data/*.json is generated and committed, so the app can be built without
# Python. Committed output drifts: an annotation changes, the rebuild is
# forgotten, and the app ships the previous data while every other check here
# passes on it. Rebuilding and diffing closes that, and it is also the only
# thing that runs the builders' own guards — the ones that reject a word-order
# mark that does not occur in its sentence, an annotation matching no example,
# an unknown word class, a one-slot formula.
step "Rebuild the data and check nothing drifted"
python3 app/tools/build_vocabulary.py
python3 app/tools/build_grammar.py
if ! git diff --quiet -- app/data/vocabulary.json app/data/grammar.json; then
  echo "ERROR: app/data does not match what the sources build." >&2
  echo "Run build_vocabulary.py and build_grammar.py in app/tools and commit the result." >&2
  git diff --stat -- app/data >&2
  exit 1
fi

# frequency.json is built from the hermitdave/FrequencyWords list, which is not
# in the repository, so it cannot be regenerated here. It was therefore the one
# piece of app/data nothing ever looked at. --check does what can be done
# without the source: re-derive the ranks from the counts the file carries and
# require it to match, and re-count the meta block.
step "Check the frequency list is internally consistent"
python3 app/tools/build_frequency.py --check

# The licensing gate and the content gate.
step "Validate content"
python3 app/tools/validate_content.py

# The validator is the last thing between a bad card and the published app.
# These are its own rules, on fixtures.
step "Check the validator still enforces its rules"
python3 -m unittest discover -s app/tools -p "test_*.py"

step "Typecheck"
npm run --silent typecheck

# The engine and server tests. The mobile workspace's own test is the browser
# smoke run, which needs an export; CI sets CI=1 so it skips there.
step "Engine and server tests"
npm test --workspaces --if-present

printf '\n\033[1;32mAll gates passed.\033[0m\n'
