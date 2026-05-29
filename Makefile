.PHONY: demo-benign demo-portscan demo-spawn demo-mdrfckr test clean

demo-benign:
	python3 -m bifrost.demo --scenario examples/replay/benign_web_burst.jsonl

demo-portscan:
	python3 -m bifrost.demo --scenario examples/replay/port_scan.jsonl

demo-spawn:
	python3 -m bifrost.demo --scenario examples/replay/suspicious_process_spawn.jsonl

demo-mdrfckr:
	python3 -m bifrost.demo --scenario examples/replay/mdrfckr_botnet.jsonl

test:
	python3 -m pytest tests/ -v

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	rm -f logs/decision_audit.jsonl
