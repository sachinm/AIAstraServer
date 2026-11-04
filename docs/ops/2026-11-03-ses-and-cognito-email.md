# Sign-up email from vedic-astrology.app (2026-11-03)

Moves the user pool `aiastra-users-staging` (`us-east-1_x8CrXCth3`) off Cognito's 50-a-day sender onto Amazon SES, sending from
`no-reply@vedic-astrology.app`. Replaces step 4 of `2026-11-02-cloudshell-fixes.md`, which had two faults: its production-access
command lacked `--production-access-enabled`, so it would not have asked for production access, and it left the pool change
until a later read. This file does both.

Run in **AWS CloudShell, signed in to account 442728149528, region us-east-1**. No agent here can reach that account: the
`aiastra-ops` key is invalid, and the only other route is the `OrganizationAccountAccessRole` path through `amplifyv2`, which
`docs/TODOS.md` says needs Sachin's own OK. Cloudflare's DNS also needs a token only Sachin can make.

Cloudflare cannot send mail. It hosts the DNS records that prove to receivers that SES may send for the domain.

## 0. A Cloudflare token (2 minutes, once)

Cloudflare dashboard, My Profile, API Tokens, Create Token, "Edit zone DNS" template. Permissions: Zone, DNS, Edit. Zone
Resources: only `vedic-astrology.app`. Create it, then in CloudShell:

```bash
read -s -p "Cloudflare token: " CF_API_TOKEN; export CF_API_TOKEN; echo
```

Never paste the token into chat. Delete the token in Cloudflare when step 1 has run.

## 1. Identity, production access and DNS, in one run

Safe to run twice: it reuses what exists and changes only the three DKIM records, the SPF record and one DMARC record. If the
domain already has an SPF record, it adds `include:amazonses.com` to it, because a domain may have only one.

```bash
cat > ses-a.sh <<'EOF'
set -euo pipefail
export AWS_DEFAULT_REGION=us-east-1
D=vedic-astrology.app
ACC=$(aws sts get-caller-identity --query Account --output text)
[ "$ACC" = "442728149528" ] || { echo "STOP: signed in to $ACC, not 442728149528"; exit 1; }
: "${CF_API_TOKEN:?run step 0 first}"

echo "== SES identity"
aws sesv2 get-email-identity --email-identity $D >/dev/null 2>&1 || aws sesv2 create-email-identity --email-identity $D >/dev/null
TOKENS=$(aws sesv2 get-email-identity --email-identity $D --query 'DkimAttributes.Tokens' --output text)

echo "== Production access"
if [ "$(aws sesv2 get-account --query ProductionAccessEnabled --output text)" != "True" ]; then
  aws sesv2 put-account-details --production-access-enabled --mail-type TRANSACTIONAL --website-url "https://$D" \
    --use-case-description "One-time sign-up and sign-in codes for AI AdAstra, a Vedic astrology service. Sent only to the person who asked for the code, through Amazon Cognito, from no-reply@vedic-astrology.app. No marketing mail. Volume is a few hundred a day at most. Bounces and complaints are monitored in SES." \
    --additional-contact-email-addresses "send.sachin@yahoo.com" --contact-language EN || echo "(AWS did not accept the request just now; read the message above)"
fi

echo "== Cloudflare DNS"
CF=https://api.cloudflare.com/client/v4
H=(-H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")
ZONE=$(curl -s "${H[@]}" "$CF/zones?name=$D" | jq -r '.result[0].id // empty')
[ -n "$ZONE" ] || { echo "STOP: no zone $D visible to this token"; exit 1; }

# put TYPE NAME CONTENT [EXISTING_ID]: creates the record, or replaces the one with that id
put() {
  local body; body=$(jq -n --arg t "$1" --arg n "$2" --arg c "$3" '{type:$t,name:$n,content:$c,ttl:1,proxied:false}')
  if [ -n "${4:-}" ]; then
    curl -s -X PUT "${H[@]}" "$CF/zones/$ZONE/dns_records/$4" -d "$body" | jq -r '"  updated \(.result.type) \(.result.name) ok=\(.success)"'
  else
    curl -s -X POST "${H[@]}" "$CF/zones/$ZONE/dns_records" -d "$body" | jq -r '"  created \(.result.type // "?") \(.result.name // "?") ok=\(.success) \(.errors[0].message // "")"'
  fi
}
# find TYPE NAME: id of the first record there
find() { curl -s "${H[@]}" "$CF/zones/$ZONE/dns_records?type=$1&name=$2" | jq -r '.result[0].id // empty'; }

for T in $TOKENS; do put CNAME "${T}._domainkey.$D" "${T}.dkim.amazonses.com" "$(find CNAME "${T}._domainkey.$D")"; done

TXT=$(curl -s "${H[@]}" "$CF/zones/$ZONE/dns_records?type=TXT&name=$D")
SPF_ID=$(echo "$TXT" | jq -r '[.result[]|select(.content|test("^\"?v=spf1"))][0].id // empty')
SPF_OLD=$(echo "$TXT" | jq -r '[.result[]|select(.content|test("^\"?v=spf1"))][0].content // empty' | tr -d '"')
if [ -z "$SPF_OLD" ]; then SPF_NEW="v=spf1 include:amazonses.com ~all"
elif echo "$SPF_OLD" | grep -q amazonses.com; then SPF_NEW="$SPF_OLD"
else
  SPF_NEW=$(echo "$SPF_OLD" | sed -E 's/ ([~?+-]?all)$/ include:amazonses.com \1/')
  echo "$SPF_NEW" | grep -q amazonses.com || SPF_NEW="$SPF_OLD include:amazonses.com"
fi
echo "  SPF was: ${SPF_OLD:-none}"; echo "  SPF now: $SPF_NEW"
put TXT "$D" "$SPF_NEW" "$SPF_ID"

RUA=${DMARC_RUA:-dmarc@$D}
DM_ID=$(find TXT "_dmarc.$D")
if [ -z "$DM_ID" ]; then put TXT "_dmarc.$D" "v=DMARC1; p=none; rua=mailto:$RUA; fo=1" ""; else echo "  _dmarc already exists, left alone"; fi

echo "== Status (read again until both are true)"
aws sesv2 get-email-identity --email-identity $D --query '{verified:VerifiedForSendingStatus,dkim:DkimAttributes.Status}' --output json
aws sesv2 get-account --query '{production:ProductionAccessEnabled,review:Details.ReviewDetails.Status}' --output json
EOF
bash ses-a.sh
```

Done when the last two blocks print `verified: true`, `dkim: SUCCESS` and `production: true`. Verification usually takes
minutes after the records exist. AWS reviews production access by hand: often within a day, sometimes asks a question by
email to `send.sachin@yahoo.com`. Re-read any time with:

```bash
aws sesv2 get-email-identity --email-identity vedic-astrology.app --query '{verified:VerifiedForSendingStatus,dkim:DkimAttributes.Status}'
aws sesv2 get-account --query '{production:ProductionAccessEnabled,review:Details.ReviewDetails.Status}'
```

DMARC reports go to `dmarc@vedic-astrology.app`, which does not exist yet. To receive them, turn on Cloudflare Email Routing for
that one address and forward it to Yahoo. A DMARC report address on another domain is ignored unless that domain agrees.

## 2. Switch the pool, once step 1 shows verified and production

`update-user-pool` resets every setting left out of the call. This takes the pool's own full settings, changes only
`EmailConfiguration`, shows you the change, asks you to type `yes`, and writes a rollback file first.

```bash
cat > ses-b.sh <<'EOF'
set -euo pipefail
export AWS_DEFAULT_REGION=us-east-1
D=vedic-astrology.app; POOL=us-east-1_x8CrXCth3
ACC=$(aws sts get-caller-identity --query Account --output text)
[ "$ACC" = "442728149528" ] || { echo "STOP: signed in to $ACC"; exit 1; }
[ "$(aws sesv2 get-email-identity --email-identity $D --query VerifiedForSendingStatus --output text)" = "True" ] || { echo "STOP: domain not verified yet"; exit 1; }
[ "$(aws sesv2 get-account --query ProductionAccessEnabled --output text)" = "True" ] || { echo "STOP: SES still in sandbox"; exit 1; }
ARN=arn:aws:ses:us-east-1:$ACC:identity/$D

echo "== Let Cognito send as the domain"
aws sesv2 create-email-identity-policy --email-identity $D --policy-name cognito --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":{\"Service\":\"cognito-idp.amazonaws.com\"},\"Action\":[\"ses:SendEmail\",\"ses:SendRawEmail\"],\"Resource\":\"$ARN\",\"Condition\":{\"StringEquals\":{\"aws:SourceAccount\":\"$ACC\"}}}]}"

echo "== Test email to yourself, outside Cognito"
aws sesv2 send-email --from-email-address "AI AdAstra <no-reply@$D>" --destination ToAddresses=send.sachin@yahoo.com \
  --content '{"Simple":{"Subject":{"Data":"AI AdAstra mail test"},"Body":{"Text":{"Data":"If this is in your inbox and Show original says dkim=pass, spf=pass and dmarc=pass, the domain is set up."}}}}' --query MessageId --output text

aws cognito-idp describe-user-pool --user-pool-id $POOL > pool-before.json
KEEP='"Policies","DeletionProtection","LambdaConfig","AutoVerifiedAttributes","SmsAuthenticationMessage","MfaConfiguration","DeviceConfiguration","SmsConfiguration","UserPoolTags","AdminCreateUserConfig","UserPoolAddOns","AccountRecoverySetting","UserPoolTier","UserAttributeUpdateSettings","VerificationMessageTemplate"'
jq "(.UserPool | {UserPoolId:.Id} + with_entries(select(.key|IN($KEEP))) + {EmailConfiguration: .EmailConfiguration})" pool-before.json > rollback.json
jq --arg arn "$ARN" --arg from "AI AdAstra <no-reply@$D>" '.EmailConfiguration = ((.EmailConfiguration // {}) + {EmailSendingAccount:"DEVELOPER",SourceArn:$arn,From:$from})' rollback.json > update.json

echo "== Email settings, before and after"
jq -S .EmailConfiguration rollback.json; jq -S .EmailConfiguration update.json
read -r -p "Type yes to apply: " OK; [ "$OK" = "yes" ] || { echo "Nothing changed."; exit 0; }
aws cognito-idp update-user-pool --cli-input-json file://update.json
aws cognito-idp describe-user-pool --user-pool-id $POOL > pool-after.json
echo "== Everything that changed (only EmailConfiguration and the modified date should appear)"
diff <(jq -S .UserPool pool-before.json) <(jq -S .UserPool pool-after.json) || true
echo "Rollback: aws cognito-idp update-user-pool --cli-input-json file://rollback.json"
EOF
bash ses-b.sh
```

If the `diff` shows anything other than `EmailConfiguration` and `LastModifiedDate`, run the rollback line it prints and paste
the diff back. Do not leave it.

## 3. Test the whole path

1. Open the test email in Gmail, More, Show original: `dkim=pass`, `spf=pass` and `dmarc=pass` should all appear.
2. Sign up on https://vedic-astrology.app with a real address. The code should arrive from `AI AdAstra <no-reply@vedic-astrology.app>`
   within a minute, not in spam. Check Show original again.
3. The web's "today's limit, try tomorrow" message should no longer appear.
4. Then close the TODO in `docs/TODOS.md` ("Registration refused: Cognito's default email sender...").

Sandbox note: until AWS approves production access, SES sends only to verified addresses, so a sign-up from anyone else fails
even though the pool is switched. Do step 2 only once `production: true`.

## Later, optional

- A `CustomMessage` Lambda trigger to put the AI AdAstra wording and layout on the code email.
- A `CustomEmailSender` trigger only if mail must go through another provider such as Resend.
- Tighten DMARC from `p=none` to `p=quarantine` after two clean weeks of reports.
- The server's own Resend path (`src/services/emailService.ts`) sends from `onboarding@resend.dev` until that domain is verified
  in Resend too.
