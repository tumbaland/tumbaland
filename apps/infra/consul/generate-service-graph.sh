#!/bin/bash
# Generate visual service graph from Consul service definitions
# Creates a GraphViz DOT file for visualization

set -e

SERVICES_DIR="$(dirname "$0")/services"
OUTPUT_FILE="service-architecture.dot"
PNG_OUTPUT="service-architecture.png"

echo "🔍 Generating service architecture graph..."

# Check if services directory exists
if [ ! -d "$SERVICES_DIR" ]; then
    echo "❌ Error: Services directory not found: $SERVICES_DIR"
    exit 1
fi

# Start GraphViz DOT file
cat > "$OUTPUT_FILE" << 'EOF'
digraph ServiceArchitecture {
    rankdir=TB;
    node [shape=box, style=filled, fontname="Arial"];

    // Define colors for different service types
    node [fillcolor="#E8F4FD"]; // Backend - light blue
    node [fillcolor="#FFF2CC"]; // Frontend - light yellow
    node [fillcolor="#D5E8D4"]; // Infrastructure - light green

    // Legend
    subgraph cluster_legend {
        label="Legend";
        style=filled;
        fillcolor="#F5F5F5";

        Backend [fillcolor="#E8F4FD", label="Backend Services"];
        Frontend [fillcolor="#FFF2CC", label="Frontend Services"];
        Infrastructure [fillcolor="#D5E8D4", label="Infrastructure"];
    }

EOF

# Process each service JSON file
for service_file in "$SERVICES_DIR"/*.json; do
    if [ ! -f "$service_file" ]; then
        continue
    fi

    service_name=$(basename "$service_file" .json)

    # Extract service information using jq
    name=$(jq -r '.service.name' "$service_file" 2>/dev/null || echo "$service_name")
    port=$(jq -r '.service.port' "$service_file" 2>/dev/null || echo "N/A")
    address=$(jq -r '.service.address' "$service_file" 2>/dev/null || echo "N/A")

    # Determine service type and color
    if [[ "$name" == *"-front" ]]; then
        color="#FFF2CC"  # Frontend - yellow
        type="Frontend"
    elif [[ "$name" == *"-service" ]]; then
        color="#E8F4FD"  # Backend - blue
        type="Backend"
    else
        color="#D5E8D4"  # Infrastructure - green
        type="Infrastructure"
    fi

    # Create node with service info
    cat >> "$OUTPUT_FILE" << EOF
    "$name" [fillcolor="$color", label="$name\\nPort: $port\\nAddr: $address"];

EOF
done

# Add relationships (simplified - you can expand this)
cat >> "$OUTPUT_FILE" << 'EOF'
    // Service relationships (simplified)
    // Frontend services typically depend on backend services
    "auth-front" -> "auth-service";
    "album-front" -> "album-service";
    "album-front" -> "file-service";
    "account-front" -> "auth-service";
    "finance-front" -> "finance-service";
    "group-front" -> "group-service";
    "payment-front" -> "payment-service";
    "relationship-front" -> "relationship-service";

    // Backend service dependencies
    "album-service" -> "file-service";
    "album-service" -> "auth-service";
    "finance-service" -> "auth-service";
    "group-service" -> "auth-service";
    "payment-service" -> "auth-service";
    "relationship-service" -> "auth-service";

    // All services depend on infrastructure
    "auth-service" -> "tumbaland-proxy" [style=dashed, color=gray];
    "album-service" -> "tumbaland-proxy" [style=dashed, color=gray];
    "file-service" -> "tumbaland-proxy" [style=dashed, color=gray];
    "finance-service" -> "tumbaland-proxy" [style=dashed, color=gray];
    "group-service" -> "tumbaland-proxy" [style=dashed, color=gray];
    "payment-service" -> "tumbaland-proxy" [style=dashed, color=gray];
    "public-service" -> "tumbaland-proxy" [style=dashed, color=gray];
    "relationship-service" -> "tumbaland-proxy" [style=dashed, color=gray];

    // Frontend services connect through proxy
    "shell-front" -> "tumbaland-proxy" [style=dashed, color=gray];
    "auth-front" -> "tumbaland-proxy" [style=dashed, color=gray];
    "album-front" -> "tumbaland-proxy" [style=dashed, color=gray];
    "account-front" -> "tumbaland-proxy" [style=dashed, color=gray];
    "finance-front" -> "tumbaland-proxy" [style=dashed, color=gray];
    "group-front" -> "tumbaland-proxy" [style=dashed, color=gray];
    "payment-front" -> "tumbaland-proxy" [style=dashed, color=gray];
    "relationship-front" -> "tumbaland-proxy" [style=dashed, color=gray];

    // Group services by type
    {rank=same; "auth-service"; "album-service"; "file-service"; "finance-service"; "group-service"; "payment-service"; "public-service"; "relationship-service"}
    {rank=same; "shell-front"; "auth-front"; "album-front"; "account-front"; "finance-front"; "group-front"; "payment-front"; "relationship-front"}
    {rank=same; "tumbaland-proxy"}
}
EOF

echo "✅ Generated GraphViz DOT file: $OUTPUT_FILE"

# Check if dot (GraphViz) is available
if command -v dot &> /dev/null; then
    echo "🔄 Generating PNG visualization..."
    dot -Tpng "$OUTPUT_FILE" -o "$PNG_OUTPUT"
    echo "✅ Generated PNG file: $PNG_OUTPUT"
    echo ""
    echo "📊 To view the graph:"
    echo "   - Open $PNG_OUTPUT in an image viewer"
    echo "   - Or use: xdg-open $PNG_OUTPUT"
else
    echo "⚠️  GraphViz not installed. To generate PNG:"
    echo "   Ubuntu/Debian: sudo apt-get install graphviz"
    echo "   macOS: brew install graphviz"
    echo "   Then run: dot -Tpng $OUTPUT_FILE -o $PNG_OUTPUT"
fi

echo ""
echo "📝 To modify the graph:"
echo "   - Edit $OUTPUT_FILE (GraphViz DOT format)"
echo "   - Add more relationships or styling as needed"
echo "   - Regenerate PNG with: dot -Tpng $OUTPUT_FILE -o $PNG_OUTPUT"