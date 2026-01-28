#!/bin/bash

# Build helper for Protocol Buffers
# Node.js version uses @grpc/proto-loader and loads api.proto at runtime,
# so no generated JS is required.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PROTO_FILE="$SCRIPT_DIR/api.proto"

echo "Node.js build: no code generation needed (dynamic proto loading)."
echo "Proto location: $PROTO_FILE"
echo "If you want static JS generation, install grpc-tools and run:"
echo "  grpc_tools_node_protoc --js_out=import_style=commonjs,binary:. --grpc_out=grpc_js:. api.proto"

