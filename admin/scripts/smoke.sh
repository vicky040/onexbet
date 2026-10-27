#!/usr/bin/env bash
#
# End-to-end smoke test of the v1 (agent) and admin APIs, plus a render check
# of every panel page.
#
#   npm run smoke                 # against http://localhost:3000
#   BASE=http://localhost:3001 npm run smoke
#
# It reseeds the database first (so the assertions have known values) and
# uses a per-run UTR suffix, so it can be run as often as you like.
#
# Requires the dev server to already be running.
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
JAR="$(mktemp -t onexbet-smoke-cookies.XXXXXX)"
RUN="$(date +%s)"
trap 'rm -f "$JAR"' EXIT

echo "Reseeding the database so the expected values are known…"
npm run --silent db:seed > /dev/null || { echo "Seed failed. Is Postgres running?"; exit 1; }
echo "Testing $BASE"
echo
pass=0; fail=0

j() { node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  try { const o=JSON.parse(s); const p='$1'.split('.').filter(Boolean);
    let v=o; for (const k of p) v = v?.[Array.isArray(v)?Number(k):k];
    console.log(typeof v==='object'?JSON.stringify(v):String(v));
  } catch(e){ console.log('PARSE_ERROR'); }
});"; }

check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "  PASS  $1"; pass=$((pass+1));
  else echo "  FAIL  $1 — expected [$2] got [$3]"; fail=$((fail+1)); fi
}

echo "=== health ==="
check "health ok" "ok" "$(curl -s $BASE/api/v1/health | j data.status)"

echo "=== agent auth ==="
check "login rejects bad password" "invalid_credentials" \
  "$(curl -s -X POST $BASE/api/v1/auth/login -H 'content-type: application/json' \
     -d '{"mobile":"9876543210","password":"wrongpass"}' | j error.code)"
check "login rejects bad mobile format" "validation_failed" \
  "$(curl -s -X POST $BASE/api/v1/auth/login -H 'content-type: application/json' \
     -d '{"mobile":"12345","password":"secret1"}' | j error.code)"

LOGIN=$(curl -s -X POST $BASE/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"mobile":"9876543210","password":"secret1"}')
TOKEN=$(echo "$LOGIN" | j data.accessToken)
REFRESH=$(echo "$LOGIN" | j data.refreshToken)
check "login returns a user" "Sam Tester" "$(echo "$LOGIN" | j data.user.name)"
check "login returns a token" "yes" "$([ ${#TOKEN} -gt 40 ] && echo yes || echo no)"

check "protected route needs a token" "unauthorized" \
  "$(curl -s $BASE/api/v1/wallet/summary | j error.code)"
check "garbage token is refused" "unauthorized" \
  "$(curl -s $BASE/api/v1/wallet/summary -H 'authorization: Bearer nonsense' | j error.code)"

AUTH="authorization: Bearer $TOKEN"

echo "=== agent reads ==="
check "summary balance" "724452.5" "$(curl -s $BASE/api/v1/wallet/summary -H "$AUTH" | j data.totalBalance)"
check "me returns mobile" "9876543210" "$(curl -s $BASE/api/v1/auth/me -H "$AUTH" | j data.user.mobile)"
check "banks count" "5" "$(curl -s $BASE/api/v1/banks -H "$AUTH" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.length))")"
check "bank order is stable" "State Bank of India" "$(curl -s $BASE/api/v1/banks -H "$AUTH" | j data.0.bankName)"
check "bank exposes limit key (Dart model)" "40000" "$(curl -s $BASE/api/v1/banks -H "$AUTH" | j data.0.limit)"
check "payins count" "6" "$(curl -s $BASE/api/v1/payins -H "$AUTH" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.length))")"
check "payin has commission" "302.5" "$(curl -s $BASE/api/v1/payins -H "$AUTH" | j data.0.commission)"
check "earnings has 8 weeks" "8" "$(curl -s $BASE/api/v1/wallet/earnings -H "$AUTH" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.length))")"
check "earnings masked field" "yes" "$(curl -s $BASE/api/v1/wallet/earnings -H "$AUTH" | j data.0.maskedTransactions | grep -q '[0-9*]' && echo yes || echo no)"
check "open payouts" "2" "$(curl -s $BASE/api/v1/payouts/open -H "$AUTH" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.length))")"
check "payments status label" "Payment Received" "$(curl -s "$BASE/api/v1/payouts/payments?status=PAYMENT_RECEIVED" -H "$AUTH" | j data.0.statusLabel)"
check "deposits list" "4" "$(curl -s $BASE/api/v1/deposits -H "$AUTH" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).data.length))")"
check "notifications unread meta" "yes" "$(curl -s $BASE/api/v1/notifications -H "$AUTH" | j meta.unread | grep -qE '^[0-9]+$' && echo yes || echo no)"
check "support messages" "yes" "$(curl -s $BASE/api/v1/support/messages -H "$AUTH" | j data.0.fromUser | grep -qE 'true|false' && echo yes || echo no)"

echo "=== agent writes ==="
NEWDEP=$(curl -s -X POST $BASE/api/v1/deposits -H "$AUTH" -H 'content-type: application/json' \
  -d '{"amount":12345.67,"utr":"SMOKE'"$RUN"'A"}')
DEPREF=$(echo "$NEWDEP" | j data.reference)
check "create deposit is pending" "PENDING" "$(echo "$NEWDEP" | j data.status)"
check "duplicate UTR refused" "conflict" \
  "$(curl -s -X POST $BASE/api/v1/deposits -H "$AUTH" -H 'content-type: application/json' \
     -d '{"amount":500,"utr":"SMOKE'"$RUN"'A"}' | j error.code)"
check "below minimum refused" "bad_request" \
  "$(curl -s -X POST $BASE/api/v1/deposits -H "$AUTH" -H 'content-type: application/json' \
     -d '{"amount":5,"utr":"SMOKE'"$RUN"'B"}' | j error.code)"

NEWBANK=$(curl -s -X POST $BASE/api/v1/banks -H "$AUTH" -H 'content-type: application/json' \
  -d '{"bankName":"Kotak","accountHolder":"Sam Tester","accountNumber":"9'"$RUN"'","ifsc":"KKBK0000123","upiId":"sam.kotak@okhdfcbank","limit":50000,"amountLimit":50000,"txnLimit":50000}')
BANKID=$(echo "$NEWBANK" | j data.id)
check "create bank" "Kotak" "$(echo "$NEWBANK" | j data.bankName)"
check "bad IFSC refused" "validation_failed" \
  "$(curl -s -X POST $BASE/api/v1/banks -H "$AUTH" -H 'content-type: application/json' \
     -d '{"bankName":"X","accountHolder":"Y","accountNumber":"9'"$RUN"'","ifsc":"BAD","upiId":"a@b","amountLimit":1,"txnLimit":1}' | j error.code)"
check "toggle bank active" "true" \
  "$(curl -s -X PATCH $BASE/api/v1/banks/$BANKID/active -H "$AUTH" -H 'content-type: application/json' \
     -d '{"isActive":true}' | j data.isActive)"
check "delete bank" "true" \
  "$(curl -s -X DELETE $BASE/api/v1/banks/$BANKID -H "$AUTH" | j data.deleted)"

OPENREF=$(curl -s $BASE/api/v1/payouts/open -H "$AUTH" | j data.0.reference)
check "accept an open payout" "ACCEPTED" \
  "$(curl -s -X POST $BASE/api/v1/payouts/$OPENREF/accept -H "$AUTH" | j data.payoutStatus)"
check "accepting twice is refused" "conflict" \
  "$(curl -s -X POST $BASE/api/v1/payouts/$OPENREF/accept -H "$AUTH" | j error.code)"
check "mark payout paid" "PAYMENT_RECEIVED" \
  "$(curl -s -X POST $BASE/api/v1/payouts/$OPENREF/paid -H "$AUTH" -H 'content-type: application/json' \
     -d '{"note":"sent via upi"}' | j data.payoutStatus)"

check "mark all notifications read" "yes" \
  "$(curl -s -X POST $BASE/api/v1/notifications/read-all -H "$AUTH" | j data.markedRead | grep -qE '^[0-9]+$' && echo yes || echo no)"
check "send support message" "yes" \
  "$(curl -s -X POST $BASE/api/v1/support/messages -H "$AUTH" -H 'content-type: application/json' \
     -d '{"text":"smoke test message"}' | j data.0.id | grep -q . && echo yes || echo no)"

echo "=== token refresh ==="
REF=$(curl -s -X POST $BASE/api/v1/auth/refresh -H 'content-type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}")
check "refresh returns new token" "yes" "$([ ${#REF} -gt 100 ] && echo yes || echo no)"
check "old refresh token is dead" "unauthorized" \
  "$(curl -s -X POST $BASE/api/v1/auth/refresh -H 'content-type: application/json' \
     -d "{\"refreshToken\":\"$REFRESH\"}" | j error.code)"

echo "=== password reset ==="
RESET=$(curl -s -X POST $BASE/api/v1/auth/password-reset/request -H 'content-type: application/json' \
  -d '{"mobile":"9876543210"}')
RTOKEN=$(echo "$RESET" | j data.resetToken)
ROTP=$(echo "$RESET" | j data.devOtp)
check "reset request issues a token" "yes" "$([ ${#RTOKEN} -gt 20 ] && echo yes || echo no)"
check "wrong OTP refused" "invalid_credentials" \
  "$(curl -s -X POST $BASE/api/v1/auth/password-reset/confirm -H 'content-type: application/json' \
     -d "{\"resetToken\":\"$RTOKEN\",\"otp\":\"000000\",\"newPassword\":\"brandnew1\"}" | j error.code)"
check "unknown mobile looks identical" "yes" \
  "$(curl -s -X POST $BASE/api/v1/auth/password-reset/request -H 'content-type: application/json' \
     -d '{"mobile":"9000000001"}' | j data.resetToken | grep -q . && echo yes || echo no)"

echo "=== admin auth ==="
check "admin API needs a session" "unauthorized" "$(curl -s $BASE/api/admin/dashboard | j error.code)"
check "agent token cannot reach admin" "unauthorized" \
  "$(curl -s $BASE/api/admin/dashboard -H "$AUTH" | j error.code)"
check "admin login rejects bad password" "invalid_credentials" \
  "$(curl -s -X POST $BASE/api/admin/auth/login -H 'content-type: application/json' \
     -d '{"email":"admin@onexbet.app","password":"nope"}' | j error.code)"
check "admin login" "SUPER_ADMIN" \
  "$(curl -s -c "$JAR" -X POST $BASE/api/admin/auth/login -H 'content-type: application/json' \
     -d '{"email":"admin@onexbet.app","password":"admin12345"}' | j data.role)"

echo "=== admin reads ==="
check "dashboard agents total" "3" "$(curl -s -b "$JAR" $BASE/api/admin/dashboard | j data.overview.agents.total)"
check "agents list" "yes" "$(curl -s -b "$JAR" "$BASE/api/admin/agents?q=sam" | j data.0.name | grep -q 'Sam' && echo yes || echo no)"
check "deposits pending meta" "yes" "$(curl -s -b "$JAR" "$BASE/api/admin/deposits?status=PENDING" | j meta.pendingCount | grep -qE '^[0-9]+$' && echo yes || echo no)"
check "payins volume meta" "yes" "$(curl -s -b "$JAR" $BASE/api/admin/payins | j meta.volume | grep -qE '^[0-9.]+$' && echo yes || echo no)"
check "banks list" "yes" "$(curl -s -b "$JAR" $BASE/api/admin/banks | j meta.activeCount | grep -qE '^[0-9]+$' && echo yes || echo no)"
check "support threads" "yes" "$(curl -s -b "$JAR" $BASE/api/admin/support | j data.0.agent.name | grep -q . && echo yes || echo no)"
check "settings" "100" "$(curl -s -b "$JAR" $BASE/api/admin/settings | j data.minDepositAmount)"
check "audit log has entries" "yes" "$(curl -s -b "$JAR" $BASE/api/admin/audit | j data.0.action | grep -q '\.' && echo yes || echo no)"

echo "=== admin writes (the money path) ==="
BAL_BEFORE=$(curl -s $BASE/api/v1/wallet/summary -H "$AUTH" | j data.totalBalance)
DEPID=$(curl -s -b "$JAR" "$BASE/api/admin/deposits?q=SMOKE${RUN}A" | j data.0.id)
check "approve deposit" "COMPLETED" \
  "$(curl -s -b "$JAR" -X POST $BASE/api/admin/deposits/$DEPID/approve -H 'content-type: application/json' \
     -d '{"note":"smoke test"}' | j data.status)"
BAL_AFTER=$(curl -s $BASE/api/v1/wallet/summary -H "$AUTH" | j data.totalBalance)
check "balance grew by the deposit" "12345.67" \
  "$(node -e "console.log(($BAL_AFTER - $BAL_BEFORE).toFixed(2))")"
check "approving twice is refused" "conflict" \
  "$(curl -s -b "$JAR" -X POST $BASE/api/admin/deposits/$DEPID/approve | j error.code)"

AGENTID=$(curl -s -b "$JAR" "$BASE/api/admin/agents?q=9876543210" | j data.0.id)
check "record a payin" "yes" \
  "$(curl -s -b "$JAR" -X POST $BASE/api/admin/payins -H 'content-type: application/json' \
     -d "{\"agentId\":\"$AGENTID\",\"amount\":1000,\"txnRef\":\"SMOKEPAYIN${RUN}\"}" | j data.commission | grep -q '55' && echo yes || echo no)"
check "payin over the float is refused" "insufficient_balance" \
  "$(curl -s -b "$JAR" -X POST $BASE/api/admin/payins -H 'content-type: application/json' \
     -d "{\"agentId\":\"$AGENTID\",\"amount\":99000000,\"txnRef\":\"SMOKEPAYIN${RUN}X\"}" | j error.code)"

PAYOUTID=$(curl -s -b "$JAR" "$BASE/api/admin/payouts?status=PAYMENT_RECEIVED" | j data.0.id)
BAL2=$(curl -s $BASE/api/v1/wallet/summary -H "$AUTH" | j data.totalBalance)
SETTLED=$(curl -s -b "$JAR" -X POST $BASE/api/admin/payouts/$PAYOUTID/settle)
check "settle payout" "COMPLETED" "$(echo "$SETTLED" | j data.status)"
CREDIT=$(node -e "console.log(($(echo "$SETTLED" | j data.amount) + $(echo "$SETTLED" | j data.commission)).toFixed(2))")
BAL3=$(curl -s $BASE/api/v1/wallet/summary -H "$AUTH" | j data.totalBalance)
check "settling credited amount + commission" "$CREDIT" \
  "$(node -e "console.log(($BAL3 - $BAL2).toFixed(2))")"

check "create open payout" "OPEN" \
  "$(curl -s -b "$JAR" -X POST $BASE/api/admin/payouts -H 'content-type: application/json' \
     -d '{"amount":7500,"upiId":"smoke.player@okaxis"}' | j data.status)"
check "bad UPI refused" "validation_failed" \
  "$(curl -s -b "$JAR" -X POST $BASE/api/admin/payouts -H 'content-type: application/json' \
     -d '{"amount":100,"upiId":"not-a-upi"}' | j error.code)"

check "manual credit" "yes" \
  "$(curl -s -b "$JAR" -X POST $BASE/api/admin/agents/$AGENTID/balance -H 'content-type: application/json' \
     -d '{"amount":250,"reason":"smoke test credit"}' | j data.newBalance | grep -qE '^[0-9.]+$' && echo yes || echo no)"
check "debit below zero refused" "insufficient_balance" \
  "$(curl -s -b "$JAR" -X POST $BASE/api/admin/agents/$AGENTID/balance -H 'content-type: application/json' \
     -d '{"amount":-99000000,"reason":"smoke test overdraw"}' | j error.code)"

check "broadcast notification" "yes" \
  "$(curl -s -b "$JAR" -X POST $BASE/api/admin/notifications -H 'content-type: application/json' \
     -d '{"title":"Smoke test","body":"Hello agents","broadcast":true}' | j data.recipients | grep -qE '^[0-9]+$' && echo yes || echo no)"
check "notification needs a target" "validation_failed" \
  "$(curl -s -b "$JAR" -X POST $BASE/api/admin/notifications -H 'content-type: application/json' \
     -d '{"title":"x","body":"y"}' | j error.code)"
check "admin replies to support" "false" \
  "$(curl -s -b "$JAR" -X POST $BASE/api/admin/support/$AGENTID -H 'content-type: application/json' \
     -d '{"text":"Support reply from smoke test"}' | j data.fromAgent)"

echo "=== blocked agent cannot sign in ==="
check "block the agent" "BLOCKED" \
  "$(curl -s -b "$JAR" -X PATCH $BASE/api/admin/agents/$AGENTID -H 'content-type: application/json' \
     -d '{"status":"BLOCKED"}' | j data.status)"
check "blocked login refused" "forbidden" \
  "$(curl -s -X POST $BASE/api/v1/auth/login -H 'content-type: application/json' \
     -d '{"mobile":"9876543210","password":"secret1"}' | j error.code)"
check "blocked token refused" "forbidden" "$(curl -s $BASE/api/v1/wallet/summary -H "$AUTH" | j error.code)"
check "unblock" "ACTIVE" \
  "$(curl -s -b "$JAR" -X PATCH $BASE/api/admin/agents/$AGENTID -H 'content-type: application/json' \
     -d '{"status":"ACTIVE"}' | j data.status)"

echo "=== admin panel pages render ==="
for path in / /agents /deposits /payouts /payins /banks /notifications /support /settings /audit; do
  code=$(curl -s -b "$JAR" -o /dev/null -w '%{http_code}' "$BASE$path")
  check "GET $path" "200" "$code"
done
check "panel redirects when signed out" "307" \
  "$(curl -s -o /dev/null -w '%{http_code}' $BASE/agents)"
check "login page renders" "200" "$(curl -s -o /dev/null -w '%{http_code}' $BASE/login)"

echo
echo "=============================="
echo " passed: $pass   failed: $fail"
echo "=============================="
[ "$fail" -eq 0 ]
