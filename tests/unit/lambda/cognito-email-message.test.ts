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
  it('carries the AdAstra AI header and footer and says why the code came', () => {
    const m = buildMessage('CustomEmailSender_Authentication', '654321', 'u');
    expect(m.html).toContain('AdAstra AI');
    expect(m.html).toContain('Your Personal Vedic Astrology Assistant');
    expect(m.text).toMatch(/by signing in to the AdAstra AI app with this email address/);
    expect(m.text).toMatch(/replies are not read/);
    expect(m.text).toContain('It works for 3 minutes.');
  });
  it('puts the safety notes below the code, in text and html', () => {
    const m = buildMessage('CustomEmailSender_Authentication', '654321', 'u');
    for (const body of [m.text, m.html]) {
      const code = body.indexOf('654321');
      expect(body.indexOf('never email you personally')).toBeGreaterThan(code);
      expect(body.indexOf('never send you a link')).toBeGreaterThan(code);
    }
  });
  it('has no link to click', () => {
    const m = buildMessage('CustomEmailSender_SignUp', '111111', 'u');
    expect(m.html).not.toMatch(/<a\s|href=/i);
    expect(m.text).not.toMatch(/https?:\/\//);
  });
  it('escapes the user name in an invitation', () => {
    const m = buildMessage('CustomEmailSender_AdminCreateUser', 'Tmp#1', '<b>x</b>');
    expect(m.html).not.toContain('<b>x</b>');
    expect(m.html).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
