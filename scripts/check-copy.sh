#!/usr/bin/env bash
# Copy discipline checks. Brief sections 0.2 and 14.6.
# 1. No em dashes or en dashes anywhere in the source.
# 2. No banned vocabulary in UI copy, prompts, or seed data.

set -u
fail=0

paths=(app components lib supabase scripts docs middleware.ts)
existing=()
for p in "${paths[@]}"; do
  [ -e "$p" ] && existing+=("$p")
done

echo "Checking for em and en dashes."
if grep -rP '\x{2014}|\x{2013}' --include='*.ts' --include='*.tsx' --include='*.css' --include='*.json' --include='*.sql' --include='*.md' --include='*.sh' "${existing[@]}" 2>/dev/null; then
  echo "FAIL: em or en dash found."
  fail=1
else
  echo "OK: no em or en dashes."
fi

echo "Checking for banned vocabulary."
banned='excited|thrilled|seamless|robust|journey|empower|revolutionary|cutting-edge|game-changer|deep dive|unpack|transformative|synergy|holistic|moreover|furthermore|best-in-class|mission-critical'
if grep -riE "\b($banned)\b" --include='*.ts' --include='*.tsx' --include='*.json' --include='*.md' app components lib supabase/seed docs 2>/dev/null; then
  echo "FAIL: banned vocabulary found."
  fail=1
else
  echo "OK: no banned vocabulary."
fi

exit $fail
