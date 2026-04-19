#!/usr/bin/env bash
# Build all image versions and push to GitHub Container Registry (ghcr.io).
# Usage: ./build.sh                  (builds & pushes all versions)
#        ./build.sh v2               (builds & pushes only v2)
#        ./build.sh --no-push        (builds all, skips push)
#        ./build.sh v2 --no-push     (builds v2, skips push)
set -e

REGISTRY="ghcr.io/stefandima14"

PUSH=1
VERSIONS=""
for arg in "$@"; do
  case "$arg" in
    --no-push) PUSH=0 ;;
    *) VERSIONS="$VERSIONS $arg" ;;
  esac
done
VERSIONS=${VERSIONS:-"v1 v2 v3"}

for V in $VERSIONS; do
  BACKEND_IMG="$REGISTRY/space-backend:$V"
  FRONTEND_IMG="$REGISTRY/space-frontend:$V"

  echo "=== Building backend $V ==="
  docker build -t "$BACKEND_IMG" ./backend/$V
  echo "=== Building frontend $V ==="
  docker build -t "$FRONTEND_IMG" ./frontend/$V

  if [ "$PUSH" -eq 1 ]; then
    echo "=== Pushing $BACKEND_IMG ==="
    docker push "$BACKEND_IMG"
    echo "=== Pushing $FRONTEND_IMG ==="
    docker push "$FRONTEND_IMG"
  fi
done

echo "Done."
docker images | grep "$REGISTRY/space-" || true
