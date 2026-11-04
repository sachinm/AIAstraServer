import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM file that ships to Lambda
import { buildMessage } from '../../../lambda/cognito-email-sender/message.mjs';

describe('cognito email wording', () => {
  it('puts the code in a sign-up email', () => {
    const m = buildMessage('CustomEmailSender_SignUp', '123456', 'u');
    expect(m.subject).toMatch(/sign-up/);
    expect(m.text).toContain('123456');
    expect(m.html).toContain('123456');
  });
  it('sends nothing for account take-over notices', () => {
    expect(buildMessage('CustomEmailSender_AccountTakeOverNotification', 'x', 'u')).toBeNull();
  });
});
