import sys
from pathlib import Path

# Expose top-level modules (chunker, config, cc_runner, ...) to tests.
sys.path.insert(0, str(Path(__file__).parent))
