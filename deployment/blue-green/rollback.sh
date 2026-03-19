#!/bin/bash

# Rollback script for Blue/Green deployment
set -e

SERVICE=${1:-service-a}
NAMESPACE="prism"

echo "🔙 Rolling back $SERVICE"

# Get current active version
CURRENT_VERSION=$(kubectl get svc $SERVICE -n $NAMESPACE -o jsonpath='{.spec.selector.version}')
echo "Current version: $CURRENT_VERSION"

# Determine previous version (assuming v1 -> v2 or v2 -> v1)
if [ "$CURRENT_VERSION" = "v1" ]; then
    PREV_VERSION="v2"
else
    PREV_VERSION="v1"
fi

echo "Rolling back to: $PREV_VERSION"

# Check if previous version exists
if ! kubectl get deployment ${SERVICE}-${PREV_VERSION} -n $NAMESPACE &>/dev/null; then
    echo "Previous version deployment not found!"
    exit 1
fi

# Scale up previous version if needed
kubectl scale deployment ${SERVICE}-${PREV_VERSION} -n $NAMESPACE --replicas=3

# Wait for it to be ready
echo "Waiting for $PREV_VERSION to be ready..."
kubectl wait --for=condition=available deployment/${SERVICE}-${PREV_VERSION} -n $NAMESPACE --timeout=60s

# Switch traffic
kubectl patch svc $SERVICE -n $NAMESPACE -p "{\"spec\":{\"selector\":{\"app\":\"$SERVICE\",\"version\":\"$PREV_VERSION\"}}}"

echo "✅ Rollback complete! Now running $PREV_VERSION"
