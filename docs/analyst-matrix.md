# Analyst Matrix

## Purpose

Analyst Matrix is Bifrost’s local AI analysis panel. It powers incident reasoning in the Linux EDR desktop experience using local Ollama inference by default.

## Implementation

- Module path: `bifrost/analyst_matrix.py`
- Model resolver: `get_active_ollama_model()`
- Inference entrypoint: `execute_gpu_analyst_inference(compacted_log_payload)`
- Maps outputs into structured severity, MITRE mapping, attribution, confidence, and recommendation fields

## Model Selection Behavior

Default model selection by available RAM:

- `< 6 GB`: `qwen2.5:1.5b-instruct`
- `6–10 GB`: `qwen2.5:7b-instruct`
- `> 10 GB`: `qwen2.5:32b`

## Notes

- Integrated through the Guardian backend pipeline.
- Local AI defaults to Ollama with `qwen2.5:1.5b-instruct` for CPU-safe operation.
- Results are surfaced in desktop incident and live-monitor analysis views.
