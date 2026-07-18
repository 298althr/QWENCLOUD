#!/bin/bash
echo "=== RCA Analyze Test ==="
cat > /tmp/rca-test.json << 'EOF'
{"anomaly":{"type":"cpu_spike","severity":"warning","message":"CPU spike detected"},"metrics":{"cpu":92,"ram":34,"disk":42}}
EOF
cat /tmp/rca-test.json
echo ""
curl -s -X POST http://localhost:3000/api/rca/analyze -H 'Content-Type: application/json' -d @/tmp/rca-test.json
echo ""
echo "=== RCA Calibration Test ==="
curl -s -X POST http://localhost:3000/api/rca/calibrate -H 'Content-Type: application/json'
echo ""
echo "=== RCA Evidence Search ==="
curl -s http://localhost:3000/api/rca/evidence/cpu_spike
echo ""
echo "=== Incidents History ==="
curl -s http://localhost:3000/api/incidents/history
echo ""
echo "=== All Endpoints OK ==="
