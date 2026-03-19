#!/bin/bash

echo "🌀 Installing Chaos Mesh"
echo "========================"

# Install Chaos Mesh
curl -sSL https://mirrors.chaos-mesh.org/v2.6.1/install.sh | bash

# Wait for Chaos Mesh to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=chaos-mesh -n chaos-mesh --timeout=300s

# Create experiments directory
mkdir -p chaos/experiments

echo "✅ Chaos Mesh installed successfully!"
echo "Access Chaos Mesh Dashboard: kubectl port-forward -n chaos-mesh svc/chaos-dashboard 2333:2333"
