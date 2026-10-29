#!/usr/bin/env bash
# Deploys the whole app (Django API + built React app) as one AWS Lambda with a public Function URL.
# Re-run to ship a new version. Usage: AWS_PROFILE=<profile> ./deploy/aws-lambda.sh
set -euo pipefail

FUNCTION="${FUNCTION:-weather-aware-truck-routing}"
REGION="${AWS_REGION:-us-east-1}"
ROLE="${FUNCTION}-role"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT
export AWS_REGION="$REGION" AWS_PAGER=""
# needs a modern pip; the backend venv has one, macOS's system python3 does not
PYTHON="${PYTHON:-$( [ -x "$ROOT/backend/.venv/bin/python" ] && echo "$ROOT/backend/.venv/bin/python" || echo python3 )}"

echo "→ account: $(aws sts get-caller-identity --query Account --output text), region: $REGION"

echo "→ building frontend"
(
  cd "$ROOT/frontend"
  [ -d node_modules ] || pnpm install --frozen-lockfile --silent
  pnpm build >/dev/null
)

echo "→ packaging"
"$PYTHON" -m pip install -q --disable-pip-version-check -r "$ROOT/backend/requirements.txt" -t "$BUILD/pkg" \
  --platform manylinux2014_aarch64 --python-version 3.12 --implementation cp --only-binary=:all:
cp -R "$ROOT/backend/config" "$ROOT/backend/routing" "$BUILD/pkg/"
cp -R "$ROOT/frontend/dist" "$BUILD/pkg/frontend_dist"
mkdir -p "$BUILD/pkg/staticfiles"
find "$BUILD/pkg" -name "__pycache__" -prune -exec rm -rf {} +
(cd "$BUILD/pkg" && zip -qr "$BUILD/function.zip" .)

if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  echo "→ creating execution role"
  aws iam create-role --role-name "$ROLE" >/dev/null --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  aws iam attach-role-policy --role-name "$ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  sleep 10 # role propagation
fi
ROLE_ARN="$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)"

if aws lambda get-function --function-name "$FUNCTION" >/dev/null 2>&1; then
  echo "→ updating code"
  aws lambda update-function-code --function-name "$FUNCTION" --zip-file "fileb://$BUILD/function.zip" >/dev/null
else
  echo "→ creating function"
  SECRET="$("$PYTHON" -c 'import secrets; print(secrets.token_urlsafe(50))')"
  aws lambda create-function --function-name "$FUNCTION" >/dev/null \
    --runtime python3.12 --architectures arm64 --handler config.lambda_handler.handler \
    --role "$ROLE_ARN" --zip-file "fileb://$BUILD/function.zip" --memory-size 1024 --timeout 60 \
    --environment "Variables={DJANGO_SECRET_KEY=$SECRET,DJANGO_DEBUG=false,DJANGO_ALLOWED_HOSTS=.on.aws,FRONTEND_DIST=/var/task/frontend_dist}"
fi
aws lambda wait function-updated-v2 --function-name "$FUNCTION"

if ! aws lambda get-function-url-config --function-name "$FUNCTION" >/dev/null 2>&1; then
  echo "→ creating public URL"
  aws lambda create-function-url-config --function-name "$FUNCTION" --auth-type NONE >/dev/null
  aws lambda add-permission --function-name "$FUNCTION" --statement-id public-url >/dev/null \
    --action lambda:InvokeFunctionUrl --principal "*" --function-url-auth-type NONE
  # newer accounts also require this; older CLIs lack the flag, so treat it as best-effort
  aws lambda add-permission --function-name "$FUNCTION" --statement-id public-invoke >/dev/null 2>&1 \
    --action lambda:InvokeFunction --principal "*" --invoked-via-function-url \
    || echo "  (skipped InvokeFunction permission: upgrade the AWS CLI if the URL returns 403)"
fi

URL="$(aws lambda get-function-url-config --function-name "$FUNCTION" --query FunctionUrl --output text)"
echo "→ health: $(curl -s "${URL}api/health")"
echo "✓ live at $URL"
