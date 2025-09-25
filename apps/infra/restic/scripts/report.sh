#!/bin/bash
set -e

# Tumbaland Backup Report Generator
# Generates comprehensive backup status reports

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/.."
REPORT_DIR="$BACKUP_DIR/reports"

# Load environment variables
if [ -f "$BACKUP_DIR/.env" ]; then
  set -a
  source "$BACKUP_DIR/.env"
  set +a
fi

# Set defaults
RESTIC_REPOSITORY=${RESTIC_REPOSITORY:-"$BACKUP_DIR/data/restic-repo"}
export RESTIC_REPOSITORY
export RESTIC_PASSWORD

# Create reports directory
mkdir -p "$REPORT_DIR"

# Report timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/backup_report_$TIMESTAMP.html"

# Function to get metric value
get_metric() {
  local metric_name="$1"
  curl -s "http://localhost:9094/metrics" 2>/dev/null | grep "^$metric_name" | head -1 | awk '{print $2}' || echo "N/A"
}

# Generate HTML report
cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Tumbaland Backup Report - $(date)</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background-color: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: #f8f9fa; border-radius: 5px; min-width: 200px; }
        .metric.good { border-left: 4px solid #28a745; }
        .metric.warning { border-left: 4px solid #ffc107; }
        .metric.error { border-left: 4px solid #dc3545; }
        .metric-value { font-size: 24px; font-weight: bold; }
        .metric-label { color: #666; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .status-good { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-error { color: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ Tumbaland Backup Report</h1>
        <p>Generated on: $(date)</p>
        <p>Report ID: $TIMESTAMP</p>
    </div>

    <div class="section">
        <h2>📊 Backup Overview</h2>
        <div class="metric $([ "$(get_metric 'backup_recent_success')" = "1" ] && echo "good" || echo "error")">
            <div class="metric-value">$(get_metric 'backup_recent_success')</div>
            <div class="metric-label">Recent Backup Success (24h)</div>
        </div>
        <div class="metric $([ "$(get_metric 'backup_repository_health')" = "1" ] && echo "good" || echo "error")">
            <div class="metric-value">$(get_metric 'backup_repository_health')</div>
            <div class="metric-label">Repository Health</div>
        </div>
        <div class="metric $([ "$(echo "$(get_metric 'backup_age_hours') < 24" | bc -l 2>/dev/null)" = "1" ] && echo "good" || ([ "$(echo "$(get_metric 'backup_age_hours') < 48" | bc -l 2>/dev/null)" = "1" ] && echo "warning" || echo "error"))">
            <div class="metric-value">$(get_metric 'backup_age_hours')</div>
            <div class="metric-label">Hours Since Last Backup</div>
        </div>
        <div class="metric good">
            <div class="metric-value">$(numfmt --to=iec-i --suffix=B $(get_metric 'backup_repository_size_bytes') 2>/dev/null || echo "N/A")</div>
            <div class="metric-label">Repository Size</div>
        </div>
    </div>

    <div class="section">
        <h2>📈 Snapshot Statistics</h2>
        <table>
            <tr><th>Service</th><th>Snapshots</th><th>Status</th></tr>
EOF

# Add service snapshot data
for service in mongodb minio redis vault consul; do
  snapshots=$(get_metric "backup_snapshots_total{service=\"$service\"}")
  status_class=$([ "$snapshots" -gt 0 ] 2>/dev/null && echo "status-good" || echo "status-error")
  status_text=$([ "$snapshots" -gt 0 ] 2>/dev/null && echo "OK" || echo "No snapshots")

  cat >> "$REPORT_FILE" << EOF
            <tr><td>$service</td><td>$snapshots</td><td class="$status_class">$status_text</td></tr>
EOF
done

cat >> "$REPORT_FILE" << EOF
        </table>
    </div>

    <div class="section">
        <h2>💾 Storage Status</h2>
        <div class="metric $([ "$(echo "$(get_metric 'backup_disk_usage_percent') < 70" | bc -l 2>/dev/null)" = "1" ] && echo "good" || ([ "$(echo "$(get_metric 'backup_disk_usage_percent') < 90" | bc -l 2>/dev/null)" = "1" ] && echo "warning" || echo "error"))">
            <div class="metric-value">$(get_metric 'backup_disk_usage_percent')%</div>
            <div class="metric-label">Disk Usage</div>
        </div>
    </div>

    <div class="section">
        <h2>📋 Recent Snapshots</h2>
        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">
$(restic snapshots --json 2>/dev/null | jq -r '.[-5:] | .[] | "\(.time) - \(.id) - Tags: \(.tags | join(", "))"' 2>/dev/null || echo "No snapshots found")
        </pre>
    </div>

    <div class="section">
        <h2>🔍 Validation Results</h2>
        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">
$(bash "$SCRIPT_DIR/validate.sh" 2>&1 | tail -20 || echo "Validation failed to run")
        </pre>
    </div>

    <div class="section">
        <h2>⚙️ System Information</h2>
        <ul>
            <li><strong>Backup Directory:</strong> $BACKUP_DIR</li>
            <li><strong>Repository:</strong> $RESTIC_REPOSITORY</li>
            <li><strong>Report Generated:</strong> $(date)</li>
            <li><strong>System:</strong> $(uname -a)</li>
        </ul>
    </div>
</body>
</html>
EOF

echo "Backup report generated: $REPORT_FILE"

# Also generate a simple text summary
SUMMARY_FILE="$REPORT_DIR/backup_summary_$TIMESTAMP.txt"
cat > "$SUMMARY_FILE" << EOF
TUMBALAND BACKUP SUMMARY
========================
Generated: $(date)
Report ID: $TIMESTAMP

BACKUP STATUS
-------------
Recent Success (24h): $(get_metric 'backup_recent_success')
Repository Health: $(get_metric 'backup_repository_health')
Hours Since Last Backup: $(get_metric 'backup_age_hours')
Repository Size: $(numfmt --to=iec-i --suffix=B $(get_metric 'backup_repository_size_bytes') 2>/dev/null || echo "N/A")
Total Snapshots: $(get_metric 'backup_snapshots_total')
Disk Usage: $(get_metric 'backup_disk_usage_percent')%

SERVICE SNAPSHOTS
-----------------
$(for service in mongodb minio redis vault consul; do
  echo "$service: $(get_metric "backup_snapshots_total{service=\"$service\"}")"
done)

RECENT SNAPSHOTS
----------------
$(restic snapshots --json 2>/dev/null | jq -r '.[-3:] | .[] | "\(.time) - Tags: \(.tags | join(", "))"' 2>/dev/null || echo "No snapshots found")

VALIDATION STATUS
-----------------
$(bash "$SCRIPT_DIR/validate.sh" 2>&1 | grep -E "(✓|✗|passed|failed)" | tail -5 || echo "Validation check failed")

For detailed HTML report, see: $REPORT_FILE
EOF

echo "Backup summary generated: $SUMMARY_FILE"

# Clean up old reports (keep last 30)
find "$REPORT_DIR" -name "backup_report_*.html" -mtime +30 -delete 2>/dev/null || true
find "$REPORT_DIR" -name "backup_summary_*.txt" -mtime +30 -delete 2>/dev/null || true

echo "Old reports cleaned up"