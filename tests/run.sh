#!/bin/bash
# Builds the portal and runs every browser check against local stand-ins. Nothing real is touched.
set -e
cd "$(dirname "$0")/.."
PY=${PY:-/home/claude/propulse/.venv/bin/python}
pkill -f "tests/seed.py" 2>/dev/null || true; pkill -f "tests/fakes.mjs" 2>/dev/null || true; pkill -f "next start" 2>/dev/null || true; pkill -f "next-server" 2>/dev/null || true
pg_isready -q 2>/dev/null || { service postgresql start > /dev/null 2>&1; sleep 4; }
sleep 1
node tests/fakes.mjs 54500 > /tmp/fakes.log 2>&1 &
KEY=$(node -e "const {generateKeyPairSync}=require('crypto');const k=generateKeyPairSync('rsa',{modulusLength:2048});console.log(JSON.stringify({client_email:'robot@example.iam',private_key:k.privateKey.export({type:'pkcs8',format:'pem'})}))")
export PROPULSE_SUPABASE_URL=http://127.0.0.1:54400 PROPULSE_PUBLISHABLE_KEY=pk PROPULSE_INSECURE_COOKIE=1
export SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")
export GEMINI_API_KEY=test-gemini-key PROPULSE_GEMINI_URL=http://127.0.0.1:54500/gemini
export GOOGLE_SERVICE_ACCOUNT="$KEY" PROPULSE_GOOGLE_TOKEN_URL=http://127.0.0.1:54500/google/token
export PROPULSE_DRIVE_API=http://127.0.0.1:54500/drive PROPULSE_DRIVE_UPLOAD=http://127.0.0.1:54500/upload
export BREVO_API_KEY=test-brevo-key PROPULSE_BREVO_URL=http://127.0.0.1:54500/brevo
[ "$SKIP_BUILD" = "1" ] || npx next build > /tmp/build.log 2>&1 || { tail -30 /tmp/build.log; exit 1; }
seed() { pkill -f "tests/seed.py" 2>/dev/null || true; sleep 1; $PY tests/seed.py > /tmp/seed.log 2>&1 & for i in $(seq 1 40); do grep -q READY /tmp/seed.log 2>/dev/null && break; sleep 1; done; }
npx next start -p 3100 > /tmp/next.log 2>&1 &
PROPULSE_TEST_TOKEN_SECONDS=30 npx next start -p 3101 > /tmp/next2.log 2>&1 &
sleep 4
FAIL=0
for t in ${TESTS:-e2e e2e2 renewal}; do
  : > /tmp/seed.log; seed
  echo "== $t"
  node tests/$t.mjs > /tmp/$t.log 2>&1 || FAIL=1
  grep -v "^  ok" /tmp/$t.log | tail -${TAIL:-14}
done
[ "$KEEP" = "1" ] || { pkill -f "tests/seed.py"; pkill -f "tests/fakes.mjs"; pkill -f "next start"; pkill -f "next-server"; } 2>/dev/null || true
exit $FAIL
