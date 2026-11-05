# Sign-up email through Resend (2026-11-04)

Goal: Cognito's sign-up, resend and reset codes leave from `AdAstra AI <no-reply@vedic-astrology.app>` through Resend, with no
50-a-day cap and no wait for SES production access (DENIED, case 179367262200747). `vedic-astrology.app` is verified in Resend.

How it works: Cognito encrypts each code with our KMS key and calls the Lambda in `lambda/cognito-email-sender/`. The Lambda
decrypts the code, reads the Resend key from Secrets Manager (`aiastra/resend-api-key`) and posts to Resend. Account take-over
notices are not sent. Resend is a third-party processor of email addresses and codes: the Privacy Policy must name it.

Run in **AWS CloudShell, account 442728149528, us-east-1**, from a clone of this repo's `develop`.

## 1. Store the Resend key (never paste it into chat)

Resend, API Keys, Create, sending access only, domain `vedic-astrology.app`. Then:

```bash
read -s -p "Resend key: " K; echo
aws secretsmanager create-secret --name aiastra/resend-api-key --secret-string "$K" --query ARN --output text || \
aws secretsmanager put-secret-value --secret-id aiastra/resend-api-key --secret-string "$K" --query ARN --output text
unset K
```

## 2. Key, role, Lambda and pool, with a rollback file

```bash
cat > resend-sender.sh <<'XEOF'
set -euo pipefail
export AWS_DEFAULT_REGION=us-east-1
POOL=us-east-1_x8CrXCth3; FN=aiastra-cognito-email-sender; ROLE=$FN-role
ACC=$(aws sts get-caller-identity --query Account --output text)
[ "$ACC" = "442728149528" ] || { echo "STOP: signed in to $ACC"; exit 1; }
SECRET_ARN=$(aws secretsmanager describe-secret --secret-id aiastra/resend-api-key --query ARN --output text)

echo "== KMS key"
KEY_ARN=$(aws kms list-aliases --query "Aliases[?AliasName=='alias/aiastra-cognito-email'].TargetKeyId|[0]" --output text)
if [ "$KEY_ARN" = "None" ]; then
  KEY_ARN=$(aws kms create-key --description "Cognito email codes" --query KeyMetadata.Arn --output text)
  aws kms create-alias --alias-name alias/aiastra-cognito-email --target-key-id "$KEY_ARN"
else KEY_ARN=$(aws kms describe-key --key-id "$KEY_ARN" --query KeyMetadata.Arn --output text); fi

echo "== Role"
aws iam get-role --role-name $ROLE >/dev/null 2>&1 || aws iam create-role --role-name $ROLE --assume-role-policy-document \
 '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
aws iam attach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name $ROLE --policy-name send --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
 {\"Effect\":\"Allow\",\"Action\":\"kms:Decrypt\",\"Resource\":\"$KEY_ARN\"},
 {\"Effect\":\"Allow\",\"Action\":\"secretsmanager:GetSecretValue\",\"Resource\":\"$SECRET_ARN\"}]}"
ROLE_ARN=$(aws iam get-role --role-name $ROLE --query Role.Arn --output text)

echo "== Let Cognito encrypt with the key"
aws kms put-key-policy --key-id "$KEY_ARN" --policy-name default --policy "{\"Version\":\"2012-10-17\",\"Statement\":[
 {\"Sid\":\"Admin\",\"Effect\":\"Allow\",\"Principal\":{\"AWS\":\"arn:aws:iam::$ACC:root\"},\"Action\":\"kms:*\",\"Resource\":\"*\"},
 {\"Sid\":\"Cognito\",\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"cognito-idp.amazonaws.com\"},\"Action\":[\"kms:CreateGrant\",\"kms:Encrypt\",\"kms:GenerateDataKey*\"],\"Resource\":\"*\",\"Condition\":{\"StringEquals\":{\"aws:SourceAccount\":\"$ACC\"}}}]}"

echo "== Package and deploy the Lambda"
cd lambda/cognito-email-sender
[ -f package.json ] || echo '{"type":"module","dependencies":{"@aws-crypto/client-node":"^4"}}' > package.json
npm install --omit=dev --silent && zip -qr ../fn.zip . && cd ..
ENVV="Variables={KMS_KEY_ARN=$KEY_ARN,RESEND_SECRET_ID=aiastra/resend-api-key,MAIL_FROM=AdAstra AI <no-reply@vedic-astrology.app>}"
if aws lambda get-function --function-name $FN >/dev/null 2>&1; then
  aws lambda update-function-code --function-name $FN --zip-file fileb://fn.zip >/dev/null
else
  sleep 10 # a new role needs a moment before Lambda can use it
  aws lambda create-function --function-name $FN --runtime nodejs20.x --handler index.handler --timeout 15 --role "$ROLE_ARN" --zip-file fileb://fn.zip --environment "$ENVV" >/dev/null
fi
aws lambda wait function-active --function-name $FN
FN_ARN=$(aws lambda get-function --function-name $FN --query Configuration.FunctionArn --output text)
aws lambda add-permission --function-name $FN --statement-id cognito --action lambda:InvokeFunction --principal cognito-idp.amazonaws.com \
  --source-arn "arn:aws:cognito-idp:us-east-1:$ACC:userpool/$POOL" 2>/dev/null || true
cd ../..

echo "== Pool: only LambdaConfig and KMSKeyID change"
aws cognito-idp describe-user-pool --user-pool-id $POOL > pool-before.json
KEEP='"Policies","DeletionProtection","LambdaConfig","AutoVerifiedAttributes","SmsAuthenticationMessage","MfaConfiguration","DeviceConfiguration","SmsConfiguration","UserPoolTags","AdminCreateUserConfig","UserPoolAddOns","AccountRecoverySetting","UserPoolTier","UserAttributeUpdateSettings","VerificationMessageTemplate","EmailConfiguration"'
jq "(.UserPool | {UserPoolId:.Id} + with_entries(select(.key|IN($KEEP))))" pool-before.json > rollback.json
jq --arg fn "$FN_ARN" --arg k "$KEY_ARN" '.LambdaConfig = ((.LambdaConfig // {}) + {KMSKeyID:$k, CustomEmailSender:{LambdaVersion:"V1_0",LambdaArn:$fn}})' rollback.json > update.json
diff <(jq -S .LambdaConfig rollback.json) <(jq -S .LambdaConfig update.json) || true
read -r -p "Type yes to apply: " OK; [ "$OK" = "yes" ] || { echo "Nothing changed."; exit 0; }
aws cognito-idp update-user-pool --cli-input-json file://update.json
aws cognito-idp describe-user-pool --user-pool-id $POOL > pool-after.json
diff <(jq -S .UserPool pool-before.json) <(jq -S .UserPool pool-after.json) || true
echo "Rollback: aws cognito-idp update-user-pool --cli-input-json file://rollback.json"
XEOF
bash resend-sender.sh
```

If the final `diff` shows more than `LambdaConfig`, `KMSKeyId` and the modified date, run the rollback line and report it.

## 3. Test

Sign up on https://vedic-astrology.app with a real address that is not yours-only; the code must arrive from
`AdAstra AI <no-reply@vedic-astrology.app>` within a minute. If not: CloudWatch log group `/aws/lambda/aiastra-cognito-email-sender`
(status codes only, never codes). Then close the TODO "Registration refused: Cognito's default email sender..." in `docs/TODOS.md`.

Resend's free plan is 100 a day and 3,000 a month; a paid plan lifts it. Add Resend to the Privacy Policy as an email processor.
