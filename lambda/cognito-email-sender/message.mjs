/** The wording of each Cognito email. Pure, so it is tested without AWS. */

const SUBJECT = {
  CustomEmailSender_SignUp: 'Your AdAstra AI sign-up code',
  CustomEmailSender_ResendCode: 'Your AdAstra AI code',
  CustomEmailSender_ForgotPassword: 'Your AdAstra AI password reset code',
  CustomEmailSender_AdminCreateUser: 'Your AdAstra AI invitation',
  CustomEmailSender_VerifyUserAttribute: 'Verify your AdAstra AI email',
  CustomEmailSender_UpdateUserAttribute: 'Verify your new AdAstra AI email',
  CustomEmailSender_Authentication: 'Your AdAstra AI sign-in code',
};

/** Why this email came: the person asked for it, with this address (Sachin, 2026-11-05). */
const REASON = {
  CustomEmailSender_SignUp: 'You asked for this code to create an AdAstra AI account with this email address.',
  CustomEmailSender_ResendCode: 'You asked for a new AdAstra AI code for this email address.',
  CustomEmailSender_ForgotPassword: 'You asked for this code to reset the password of the AdAstra AI account that uses this email address.',
  CustomEmailSender_VerifyUserAttribute: 'You asked for this code to confirm this email address for your AdAstra AI account.',
  CustomEmailSender_UpdateUserAttribute: 'You asked for this code to change your AdAstra AI account to this email address.',
  CustomEmailSender_Authentication: 'You asked for this code by signing in to the AdAstra AI app with this email address.',
};

/**
 * Below the code, because people copy the code and may stop reading there. The email itself carries no link, so "we never
 * send a link" stays true; the site name is written so mail apps are less likely to turn it into one.
 */
const SAFETY = [
  'AdAstra AI will never email you personally, phone you or message you to ask for this code. Never share it with anyone, even someone who says they are from AdAstra AI.',
  'We will never send you a link to click to verify or unlock your account. Do not click links in any email that claims to be from us.',
  'Enter this code only in the AdAstra AI app, at vedic-astrology.app, typed into your browser yourself.',
  'If you did not ask for this code, do not use it and do not reply. You can ignore this email: nothing changes on your account without the code.',
];

const SITE_HTML = 'vedic-astrology<span>.</span>app';
const FOOTER = 'AdAstra AI · Your Personal Vedic Astrologer · vedic-astrology.app. This is an automatic email: replies are not read.';

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function buildMessage(triggerSource, code, username) {
  const subject = SUBJECT[triggerSource];
  if (!subject) return null; // account take-over notices and anything new are not sent from here
  const invited = triggerSource === 'CustomEmailSender_AdminCreateUser';
  const intro = invited
    ? `You have been invited to AdAstra AI. Your user name is ${username} and your temporary password is:`
    : `${REASON[triggerSource]} Your code is:`;
  // a sign-in code lasts as long as the app client's AuthSessionValidity (3 minutes on 2026-11-05)
  const after = invited
    ? 'Change it when you first sign in.'
    : triggerSource === 'CustomEmailSender_Authentication'
      ? 'It works for 3 minutes.'
      : 'It expires soon.';

  const text = [
    'AdAstra AI',
    intro,
    code,
    after,
    'Keep your account safe:',
    ...SAFETY.map((s) => `- ${s}`),
    '--',
    FOOTER,
  ].join('\n\n');

  const site = (s) => escape(s).replace('vedic-astrology.app', SITE_HTML);
  const html = `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;color:#2b1d12;background:#fbf6ee;border:1px solid #e6d8c3;border-radius:12px;overflow:hidden">
<div style="background:#2a1747;color:#f5e9ff;padding:16px 24px"><div style="font-size:20px;font-weight:bold">&#9734; AdAstra AI</div><div style="font-size:13px;color:#d9c2f0">Your Personal Vedic Astrologer</div></div>
<div style="padding:20px 24px">
<p style="margin:0 0 12px">${escape(intro)}</p>
<p style="font-family:Consolas,Menlo,monospace;font-size:30px;letter-spacing:6px;font-weight:bold;margin:8px 0;text-align:center;background:#fff;border:1px solid #e6d8c3;border-radius:8px;padding:12px">${escape(code)}</p>
<p style="margin:12px 0 0;color:#5b4632">${after}</p>
<div style="margin-top:20px;padding:14px 16px;background:#fff4e5;border-left:4px solid #c2410c;border-radius:6px">
<p style="margin:0 0 8px;font-weight:bold;color:#9a3412">Keep your account safe</p>
<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.5">${SAFETY.map((s) => `<li style="margin-bottom:6px">${site(s)}</li>`).join('')}</ul>
</div>
</div>
<div style="padding:12px 24px;border-top:1px solid #e6d8c3;font-size:12px;color:#7a6650">${site(FOOTER)}</div>
</div>`;
  return { subject, text, html };
}
