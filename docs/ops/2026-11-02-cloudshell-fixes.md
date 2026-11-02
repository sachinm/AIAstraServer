# CloudShell steps for the known bugs (2026-11-02)

Run these in AWS CloudShell, signed in to account 442728149528, region us-east-1. No agent here has the access.
Each block is safe to run on its own, and each prints what it changed. Paste the output back to the dev session.

Where things are:
- The API's allowed origins are the `CORS_ORIGINS` env var on Lambda `aiastra-server-api` (`server.ts:88`).
- vedic-astrology.app and www serve the Amplify `release-candidate-staging` build of app `d20sdo476h9w6c`. The old
  `production` branch is not what they serve.

## 1. Let vedic-astrology.app reach the API

`update-function-configuration --environment` replaces every variable, so this merges into the current set.

```bash
F=aiastra-server-api
aws lambda get-function-configuration --function-name $F --query 'Environment.Variables' > env-before.json
jq '.CORS_ORIGINS = ((.CORS_ORIGINS // "" | split(",") | map(gsub("^\\s+|\\s+$";"")) | map(select(length>0))) + ["https://vedic-astrology.app","https://www.vedic-astrology.app"] | unique | join(","))' env-before.json > env-after.json
aws lambda update-function-configuration --function-name $F --environment "$(jq -c '{Variables: .}' env-after.json)" --query 'LastUpdateStatus' --output text
aws lambda wait function-updated --function-name $F
jq -r '"CORS_ORIGINS=\(.CORS_ORIGINS)\nPLANS_ENABLED=\(.PLANS_ENABLED)\nPLAN_FREE_QUESTIONS=\(.PLAN_FREE_QUESTIONS)\nPLAN_PLUS_QUESTIONS=\(.PLAN_PLUS_QUESTIONS)\nTIMELINE_ENABLED=\(.TIMELINE_ENABLED)\nNODE_ENV=\(.NODE_ENV)"' env-after.json
curl -s -o /dev/null -D - -X OPTIONS https://dzsm2dbswvuqy.cloudfront.net/graphql -H 'Origin: https://vedic-astrology.app' -H 'Access-Control-Request-Method: POST' | grep -i '^access-control-allow-origin'
```

Done when the last line prints `access-control-allow-origin: https://vedic-astrology.app`. A cached preflight can take
a few minutes to clear.

## 2. Detect the visitor's country

```bash
P=e1684868-b4fe-43b2-94ca-ac52642bd67d
aws cloudfront get-origin-request-policy --id $P > orp.json
jq '.OriginRequestPolicy.OriginRequestPolicyConfig.HeadersConfig' orp.json
ETAG=$(jq -r .ETag orp.json)
jq '.OriginRequestPolicy.OriginRequestPolicyConfig
  | if .HeadersConfig.HeaderBehavior == "allViewer" then .HeadersConfig.HeaderBehavior = "allViewerAndWhitelistCloudFront" else . end
  | .HeadersConfig.Headers.Items = ((.HeadersConfig.Headers.Items // []) + ["CloudFront-Viewer-Country"] | unique)
  | .HeadersConfig.Headers.Quantity = (.HeadersConfig.Headers.Items | length)' orp.json > orp-new.json
aws cloudfront update-origin-request-policy --id $P --if-match "$ETAG" --origin-request-policy-config file://orp-new.json --query 'OriginRequestPolicy.OriginRequestPolicyConfig.HeadersConfig'
sleep 60; curl -s https://dzsm2dbswvuqy.cloudfront.net/api/billing/plans | jq '.country'
```

Done when the last line prints your country code, not `null`. If the update says the policy is AWS-managed and cannot
be changed, paste that output: the distribution then needs a custom policy.

## 3. Serve the prerendered pages, and send the security headers

Custom rules apply to the whole app. The old `production` branch has no such files, so those four paths would probably
return 404 there; `release-candidate-staging` and vedic-astrology.app are not affected.

```bash
A=d20sdo476h9w6c
aws amplify get-app --app-id $A --query '{rules:app.customRules,headers:app.customHeaders}' > amplify-before.json
cat > rules.json <<'EOF'
[
  { "source": "/pricing", "target": "/pricing/index.html", "status": "200" },
  { "source": "/terms", "target": "/terms/index.html", "status": "200" },
  { "source": "/privacy", "target": "/privacy/index.html", "status": "200" },
  { "source": "/refunds", "target": "/refunds/index.html", "status": "200" },
  { "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>", "target": "/index.html", "status": "200" }
]
EOF
cat > headers.yml <<'EOF'
customHeaders:
  - pattern: '/signin'
    headers:
      - key: 'X-Robots-Tag'
        value: 'noindex, nofollow'
  - pattern: '/signin/*'
    headers:
      - key: 'X-Robots-Tag'
        value: 'noindex, nofollow'
  - pattern: '/signup'
    headers:
      - key: 'X-Robots-Tag'
        value: 'noindex, nofollow'
  - pattern: '/signup/*'
    headers:
      - key: 'X-Robots-Tag'
        value: 'noindex, nofollow'
  - pattern: '/dashboard'
    headers:
      - key: 'X-Robots-Tag'
        value: 'noindex, nofollow'
  - pattern: '/dashboard/*'
    headers:
      - key: 'X-Robots-Tag'
        value: 'noindex, nofollow'
  - pattern: '/profile'
    headers:
      - key: 'X-Robots-Tag'
        value: 'noindex, nofollow'
  - pattern: '/profile/*'
    headers:
      - key: 'X-Robots-Tag'
        value: 'noindex, nofollow'
  - pattern: '**/*'
    headers:
      - key: 'X-Content-Type-Options'
        value: 'nosniff'
      - key: 'Referrer-Policy'
        value: 'strict-origin-when-cross-origin'
EOF
aws amplify update-app --app-id $A --custom-rules file://rules.json --custom-headers "$(cat headers.yml)" --query 'app.customRules[].source'
curl -sI https://vedic-astrology.app/ | grep -iE '^(x-content-type-options|referrer-policy)'
curl -s https://vedic-astrology.app/pricing | grep -o '<title>[^<]*</title>'
```

Rollback: `amplify-before.json` holds the previous rules and headers. Done when both headers print and `/pricing` has
its own title. The prerender session checks the live paths after this.

## 4. Sign-up email: move Cognito off the 50-a-day sender

Sender domain: `vedic-astrology.app`, which is on Cloudflare. This is two stages, because DNS and AWS's approval come
between them.

Stage 1 creates the identity, asks AWS for production access and prints three DNS records. AWS reviews that request.

```bash
D=vedic-astrology.app
aws sesv2 create-email-identity --email-identity $D --query 'DkimAttributes.Tokens' --output text | tr '\t' '\n' | while read T; do echo "CNAME  ${T}._domainkey.$D  ->  ${T}.dkim.amazonses.com  (DNS only, not proxied)"; done
aws sesv2 put-account-details --mail-type TRANSACTIONAL --website-url "https://$D" --use-case-description "One-time sign-up and sign-in codes for AI AdAstra, sent only to the person who asked for them through Amazon Cognito." --additional-contact-email-addresses "send.sachin@yahoo.com" --contact-language EN
```

Add those three CNAME records in Cloudflare, set to DNS only. Stage 2, once
`aws sesv2 get-email-identity --email-identity vedic-astrology.app --query VerifiedForSendingStatus` prints `true` and
AWS has approved production access:

```bash
D=vedic-astrology.app; POOL=us-east-1_x8CrXCth3; ACC=442728149528
ARN=arn:aws:ses:us-east-1:$ACC:identity/$D
aws sesv2 put-email-identity-policy --email-identity $D --policy-name cognito --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"cognito-idp.amazonaws.com\"},\"Action\":[\"ses:SendEmail\",\"ses:SendRawEmail\"],\"Resource\":\"$ARN\",\"Condition\":{\"StringEquals\":{\"aws:SourceAccount\":\"$ACC\"}}}]}"
aws cognito-idp describe-user-pool --user-pool-id $POOL --query 'UserPool.EmailConfiguration' > email-before.json
```

Paste `email-before.json` back before changing the pool. `update-user-pool` resets every setting left out of the call,
so the dev session will write that one command from a full read of the pool.

## 5. Give the deployer back its access

The `aiastra-ops` key is invalid, and the deployer cannot read or change the settings above. This makes a new key and
a scoped policy. Never paste the secret into chat: run `aws configure --profile aiastra-ops` on your own machine.

```bash
ACC=442728149528
cat > deployer-read.json <<EOF
{"Version":"2012-10-17","Statement":[
 {"Effect":"Allow","Action":["lambda:GetFunctionConfiguration","lambda:GetFunctionUrlConfig","lambda:GetFunction"],"Resource":"arn:aws:lambda:us-east-1:$ACC:function:aiastra-server-api"},
 {"Effect":"Allow","Action":["cloudfront:GetDistribution","cloudfront:GetDistributionConfig","cloudfront:GetOriginRequestPolicy","cloudfront:GetResponseHeadersPolicy"],"Resource":"*"},
 {"Effect":"Allow","Action":["amplify:GetApp","amplify:ListBranches","amplify:GetBranch"],"Resource":"arn:aws:amplify:us-east-1:$ACC:apps/d20sdo476h9w6c*"},
 {"Effect":"Allow","Action":["logs:DescribeLogGroups","logs:FilterLogEvents","logs:GetLogEvents"],"Resource":"*"},
 {"Effect":"Allow","Action":["cognito-idp:DescribeUserPool"],"Resource":"arn:aws:cognito-idp:us-east-1:$ACC:userpool/us-east-1_x8CrXCth3"}
]}
EOF
ARN=$(aws iam create-policy --policy-name aiastra-deployer-read --policy-document file://deployer-read.json --query Policy.Arn --output text)
aws iam attach-user-policy --user-name aiastra-ops-deployer --policy-arn "$ARN"
aws iam list-access-keys --user-name aiastra-ops-deployer --query 'AccessKeyMetadata[].{id:AccessKeyId,status:Status,created:CreateDate}'
aws iam create-access-key --user-name aiastra-ops-deployer --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text
```

This policy is read-only. Changing settings stays with you in CloudShell. If `create-access-key` says the user already
has two keys, delete the old invalid one first with `aws iam delete-access-key`.

## 6. After the deploy: turn on the life reading

Run this only after the server with the interview's plan check is deployed, because the interview is open to every
signed-in user until then.

```bash
F=aiastra-server-api
aws lambda get-function-configuration --function-name $F --query 'Environment.Variables' > env-now.json
aws lambda update-function-configuration --function-name $F --environment "$(jq -c '{Variables: (. + {TIMELINE_ENABLED:"1"})}' env-now.json)" --query 'LastUpdateStatus' --output text
```

## Optional: a daily guard on Unlimited

`PLAN_UNLIMITED_DAILY_GUARD` is built and off. To set it, use the same merge as step 6 with
`PLAN_UNLIMITED_DAILY_GUARD:"100"`. At $0.07 a reading, 100 questions a day is about $210 a month if used every day.
The Terms and the pricing page must say so before it is on, since the plan is sold as Unlimited.
