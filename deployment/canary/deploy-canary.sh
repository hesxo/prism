#!/bin/bash

# Canary deployment script
set -e

echo "🦜 Deploying Canary for Service A"

# Deploy canary version
kubectl apply -f deployment/canary/service-a-canary.yaml

# Wait for canary to be ready
kubectl wait --for=condition=available deployment/service-a-canary -n prism --timeout=60s

# If using Istio, apply traffic splitting
if kubectl get crd virtualservices.networking.istio.io &>/dev/null; then
    echo "Istio detected, applying traffic split (90/10)"
    kubectl apply -f deployment/canary/istio-canary.yaml
else
    echo "No service mesh detected, using manual header-based routing"
fi

echo "✅ Canary deployed!"
echo ""
echo "To test canary:"
echo "  curl -H \"x-canary: true\" http://prism.local/api/v1/"
echo ""
echo "To monitor:"
echo "  kubectl logs -f -l track=canary -n prism"
echo ""
echo "To promote:"
echo "  kubectl set image deployment/service-a service-a=prism-service-a:stable"
echo "  kubectl delete deployment service-a-canary"
echo ""
echo "To rollback:"
echo "  kubectl delete deployment service-a-canary"
