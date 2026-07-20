#!/bin/bash
# Security test for human verification anti-bot layer
set -e

API="http://localhost:3000/api"

echo "=== TEST 1: API without token (expect 403) ==="
CODE=$(curl -s -o /dev/null -w '%{http_code}' $API/docker/containers)
echo "Status: $CODE"
[ "$CODE" = "403" ] && echo "PASS" || echo "FAIL"

echo ""
echo "=== TEST 2: API with fake token (expect 403) ==="
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "x-human-token: fake:token:123:bad" $API/docker/containers)
echo "Status: $CODE"
[ "$CODE" = "403" ] && echo "PASS" || echo "FAIL"

echo ""
echo "=== TEST 3: API with tampered token (expect 403) ==="
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "x-human-token: abc:def:999:xyz" $API/docker/containers)
echo "Status: $CODE"
[ "$CODE" = "403" ] && echo "PASS" || echo "FAIL"

echo ""
echo "=== TEST 4: Bot gesture - too fast (expect fail) ==="
CHALL=$(curl -s $API/human/challenge | python3 -c "import sys,json; print(json.load(sys.stdin)['challenge'])")
RESULT=$(curl -s -X POST $API/human/verify \
  -H "Content-Type: application/json" \
  -d "{\"challenge\":\"$CHALL\",\"nonce\":\"0\",\"gestureData\":{\"startTime\":1,\"endTime\":2,\"points\":[{\"x\":0,\"y\":0,\"t\":1},{\"x\":100,\"y\":0,\"t\":2}]}}")
echo "Response: $RESULT"
echo "$RESULT" | grep -q "too fast" && echo "PASS (blocked bot)" || echo "CHECK"

echo ""
echo "=== TEST 5: Bot gesture - perfect linear movement (expect fail) ==="
CHALL2=$(curl -s $API/human/challenge | python3 -c "import sys,json; print(json.load(sys.stdin)['challenge'])")
RESULT2=$(curl -s -X POST $API/human/verify \
  -H "Content-Type: application/json" \
  -d "{\"challenge\":\"$CHALL2\",\"nonce\":\"0\",\"gestureData\":{\"startTime\":1000,\"endTime\":2000,\"points\":[{\"x\":0,\"y\":0,\"t\":1000},{\"x\":10,\"y\":0,\"t\":1100},{\"x\":20,\"y\":0,\"t\":1200},{\"x\":30,\"y\":0,\"t\":1300},{\"x\":40,\"y\":0,\"t\":1400},{\"x\":50,\"y\":0,\"t\":1500},{\"x\":60,\"y\":0,\"t\":1600},{\"x\":70,\"y\":0,\"t\":1700},{\"x\":80,\"y\":0,\"t\":1800},{\"x\":90,\"y\":0,\"t\":1900},{\"x\":100,\"y\":0,\"t\":2000}]}}")
echo "Response: $RESULT2"
echo "$RESULT2" | grep -q "too perfect" && echo "PASS (blocked bot)" || echo "CHECK"

echo ""
echo "=== TEST 6: Bot gesture - constant velocity (expect fail) ==="
CHALL3=$(curl -s $API/human/challenge | python3 -c "import sys,json; print(json.load(sys.stdin)['challenge'])")
# 6 points, all moving exactly 10px in 100ms = constant velocity
RESULT3=$(curl -s -X POST $API/human/verify \
  -H "Content-Type: application/json" \
  -d "{\"challenge\":\"$CHALL3\",\"nonce\":\"0\",\"gestureData\":{\"startTime\":1000,\"endTime\":1600,\"points\":[{\"x\":0,\"y\":5,\"t\":1000},{\"x\":10,\"y\":5,\"t\":1100},{\"x\":20,\"y\":5,\"t\":1200},{\"x\":30,\"y\":5,\"t\":1300},{\"x\":40,\"y\":5,\"t\":1400},{\"x\":50,\"y\":5,\"t\":1500}]}}")
echo "Response: $RESULT3"
echo "$RESULT3" | grep -q "too uniform" && echo "PASS (blocked bot)" || echo "CHECK"

echo ""
echo "=== TEST 7: Challenge replay (expect fail) ==="
CHALL4=$(curl -s $API/human/challenge | python3 -c "import sys,json; print(json.load(sys.stdin)['challenge'])")
# First attempt with no gesture (will fail PoW but consume challenge? No - PoW fails first, challenge NOT consumed)
# Actually challenge is only consumed on success. So let's test with a bad nonce first, then try again
RESULT4a=$(curl -s -X POST $API/human/verify \
  -H "Content-Type: application/json" \
  -d "{\"challenge\":\"$CHALL4\",\"nonce\":\"0\"}")
echo "First attempt (bad nonce): $RESULT4a"
# Challenge should still exist since PoW failed. But let's try with same challenge again
RESULT4b=$(curl -s -X POST $API/human/verify \
  -H "Content-Type: application/json" \
  -d "{\"challenge\":\"$CHALL4\",\"nonce\":\"0\"}")
echo "Replay attempt: $RESULT4b"

echo ""
echo "=== TEST 8: Rate limiting (expect some 429s) ==="
HIT_429=0
for i in $(seq 1 15); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' $API/human/challenge)
  echo -n "Req $i: $CODE "
  [ "$CODE" = "429" ] && HIT_429=$((HIT_429+1))
done
echo ""
echo "Got $HIT_429 rate-limited responses out of 15"
[ $HIT_429 -gt 0 ] && echo "PASS (rate limiter active)" || echo "CHECK"

echo ""
echo "=== TEST 9: Frontend verify page loads (expect 200) ==="
CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/verify)
echo "Status: $CODE"
[ "$CODE" = "200" ] && echo "PASS" || echo "FAIL"

echo ""
echo "=== ALL TESTS COMPLETE ==="
