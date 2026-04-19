#!/usr/bin/env bash
# Package the space-app chart as three versions (1.0.0/v1, 2.0.0/v2, 3.0.0/v3)
# and push each to the public OCI registry on ghcr.io.
#
# Prerequisites:
#   - helm CLI installed
#   - already logged in:  echo $PAT | helm registry login ghcr.io -u StefanDima14 --password-stdin
#
# Usage: ./package.sh              (all three versions, package + push)
#        ./package.sh 2            (only version 2.x.0 / appVersion v2)
#        ./package.sh --no-push    (package all, skip push)
set -e

cd "$(dirname "$0")"

REGISTRY="oci://ghcr.io/stefandima14/charts"
CHART_DIR="./space-app"

PUSH=1
ONLY=""
for arg in "$@"; do
  case "$arg" in
    --no-push) PUSH=0 ;;
    1|2|3)     ONLY="$arg" ;;
    *) echo "unknown arg: $arg"; exit 1 ;;
  esac
done

RELEASES="1 2 3"
[ -n "$ONLY" ] && RELEASES="$ONLY"

for N in $RELEASES; do
  CHART_VERSION="${N}.0.0"
  APP_VERSION="v${N}"
  echo "=== Packaging space-app chart ${CHART_VERSION} (appVersion=${APP_VERSION}) ==="
  helm package "$CHART_DIR" \
    --version "$CHART_VERSION" \
    --app-version "$APP_VERSION" \
    --destination .

  if [ "$PUSH" -eq 1 ]; then
    echo "=== Pushing space-app-${CHART_VERSION}.tgz to $REGISTRY ==="
    helm push "space-app-${CHART_VERSION}.tgz" "$REGISTRY"
  fi
done

echo "Done."
ls -1 space-app-*.tgz 2>/dev/null || true
