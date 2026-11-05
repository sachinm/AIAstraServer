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

export function buildMessage(triggerSource, code, username) {
  const subject = SUBJECT[triggerSource];
  if (!subject) return null; // account take-over notices and anything new are not sent from here
  const invited = triggerSource === 'CustomEmailSender_AdminCreateUser';
  const lines = invited
    ? [`You have been invited to AdAstra AI. Your user name is ${username} and your temporary password is:`, code]
    : ['Your code is:', code, 'It expires soon. If you did not ask for it, you can ignore this email.'];
  const text = lines.join('\n\n');
  const html = `<div style="font-family:Georgia,serif;max-width:480px;margin:auto;color:#2b1d12">
<p>${lines[0]}</p><p style="font-size:28px;letter-spacing:4px;font-weight:bold">${code}</p>${lines[2] ? `<p>${lines[2]}</p>` : ''}</div>`;
  return { subject, text, html };
}
