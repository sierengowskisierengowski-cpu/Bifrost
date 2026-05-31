#!/bin/bash
echo "security.py: $(sha256sum ../../bifrost/bifrost/security.py | cut -d' ' -f1)"
echo "reasoner.py: $(sha256sum ../../bifrost/bifrost/reasoner.py | cut -d' ' -f1)"
