# Analyst Matrix Module (v0.3.0)

## Purpose

Analyst Matrix provides local AI inference helpers with RAM-aware model selection.

## Current Implementation

- Module path: `bifrost/analyst_matrix.py`
- Model resolver: `get_active_ollama_model()`
- Inference entrypoint: `execute_gpu_analyst_inference(compacted_log_payload)`
- Maps outputs into structured severity, MITRE mapping, attribution, confidence, and recommendation fields

## Model Selection Behavior

Default selection by available RAM:

- `< 6 GB`: `qwen2.5:1.5b-instruct`
- `6–10 GB`: `qwen2.5:7b-instruct`
- `> 10 GB`: `qwen2.5:32b`

## Notes

- Integrated via Guardian orchestration helper.
- UI currently surfaces Analyst Matrix outcomes through incident/live analysis fields.
