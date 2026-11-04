import { buildClient, CommitmentPolicy, KmsKeyringNode } from '@aws-crypto/client-node';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { buildMessage } from './message.mjs';

const { decrypt } = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT);
const secrets = new SecretsManagerClient({});
let apiKey; // kept between invocations of a warm Lambda

async function resendKey() {
  if (!apiKey) {
    const r = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.RESEND_SECRET_ID }));
    apiKey = r.SecretString.trim();
  }
  return apiKey;
}

/** Cognito CustomEmailSender: decrypt the code Cognito encrypted with our key, then send it through Resend. */
export const handler = async (event) => {
  const to = event.request?.userAttributes?.email;
  const msg = buildMessage(event.triggerSource, null, event.userName);
  if (!msg || !to || !event.request?.code) return event; // nothing to send for this trigger

  const keyring = new KmsKeyringNode({ keyIds: [process.env.KMS_KEY_ARN] });
  const { plaintext } = await decrypt(keyring, Buffer.from(event.request.code, 'base64'));
  const full = buildMessage(event.triggerSource, plaintext.toString(), event.userName);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await resendKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject: full.subject, text: full.text, html: full.html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}`); // never log the body: it holds the code
  return event;
};
