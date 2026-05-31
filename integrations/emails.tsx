function emailFooter(origin: string | undefined) {
  return `
<style>
  .wn-logo { display: none; }
  @media (prefers-color-scheme: dark) {
    .wn-logo { display: inline-block !important; vertical-align: middle; margin-right: 8px; }
  }
</style>

<div style='mso-element:para-border-div;border:none;border-bottom:solid #BFC3C8 1.0pt;
mso-border-bottom-alt:solid #BFC3C8 .75pt;padding:0in 0in 0in 0in'>
<p class=MsoNormal style='margin-top:6.0pt;margin-right:0in;margin-bottom:6.0pt;
margin-left:0in;line-height:0%;border:none;mso-border-bottom-alt:solid #BFC3C8 .75pt;
padding:0in;mso-padding-alt:0in 0in 0in 0in'><o:p>&nbsp;</o:p></p>
</div>

<p style='margin-top:6.0pt;margin-right:0in;margin-bottom:6.0pt;margin-left:0in;text-align:center;line-height:normal'>
<img class="wn-logo" src="${origin}/images/booklogoWN_white.png" height="100" alt="WordNorms" style="display:none">WordNorms

<p style='margin-top:6.0pt;margin-right:0in;margin-bottom:6.0pt;margin-left:0in;text-align:center;line-height:normal'>
${origin}

<p style='margin-top:6.0pt;margin-right:0in;margin-bottom:6.0pt;margin-left:0in;text-align:center;line-height:normal'>
buchananlab@gmail.com
`
}

export function createForgotPasswordMsg(to: string, resetUrl: string) {
  const origin = process.env.APP_ORIGIN || process.env.BLITZ_DEV_SERVER_ORIGIN
  return {
    from: "WordNorms <noreply@wordnorms.com>",
    to,
    subject: "Your Password Reset Instructions",
    replyTo: "Erin Buchanan <buchananlab@gmail.com>",
    html: `
    <html>
    <body>
    <center><img src="${origin}/images/bannerWN_white.jpg"
alt="WordNorms" style="max-width:600px;width:100%"></center>

<h3>Your Password Reset Instructions</h3>

You requested a new password for your WordNorms account. <a href="${resetUrl}">Click here to set a new password.</a>
<p>
If you need more help, you can reply to this email.
<p>
Thanks,
<br>
WordNorms Team

${emailFooter(origin)}
</body>
</html>
    `,
  }
}

export function createSignUpMsg(email: string) {
  const origin = process.env.APP_ORIGIN || process.env.BLITZ_DEV_SERVER_ORIGIN
  return {
    from: "WordNorms <noreply@wordnorms.com>",
    to: email.toLowerCase().trim(),
    subject: "WordNorms Account Created",
    replyTo: "Erin Buchanan <buchananlab@gmail.com>",
    html: `
      <html>
    <body>
    <center><img src="${origin}/images/bannerWN_white.jpg"
alt="WordNorms" style="max-width:600px;width:100%"></center>

      <h3>Welcome to WordNorms</h3>

      Your WordNorms account has been created. You may now log in at ${origin}.
      <p>
      If you did not request an account, you can reply to this email.
      <p>
      Thanks,
      <br>
      WordNorms Team

${emailFooter(origin)}
</body>
</html>
    `,
  }
}

export function createEditPasswordMsg(currentUser: { email: string }) {
  const origin = process.env.APP_ORIGIN || process.env.BLITZ_DEV_SERVER_ORIGIN
  return {
    from: "WordNorms <noreply@wordnorms.com>",
    to: currentUser!.email,
    subject: "WordNorms Password Change",
    replyTo: "Erin Buchanan <buchananlab@gmail.com>",
    html: `
    <html>
    <body>
    <center><img src="${origin}/images/bannerWN_white.jpg"
alt="WordNorms" style="max-width:600px;width:100%"></center>

      <h3>WordNorms Password Change</h3>

      This email is to notify you that you recently updated your password. If you did not make this change, please contact us immediately.
      <p>
      If you need more help, you can reply to this email.
      <p>
      Thanks,
      <br>
      WordNorms Team

${emailFooter(origin)}
</body>
</html>
    `,
  }
}

export function createEditProfileMsg(user: { email: string }) {
  const origin = process.env.APP_ORIGIN || process.env.BLITZ_DEV_SERVER_ORIGIN
  return {
    from: "WordNorms <noreply@wordnorms.com>",
    to: user!.email,
    subject: "WordNorms Profile Change",
    replyTo: "Erin Buchanan <buchananlab@gmail.com>",
    html: `
    <html>
    <body>
    <center><img src="${origin}/images/bannerWN_white.jpg"
alt="WordNorms" style="max-width:600px;width:100%"></center>

      <h3>WordNorms Profile Change</h3>

      This email is to notify you that you recently updated your profile information. If you did not make this change, please contact us immediately.
      <p>
      If you need more help, you can reply to this email.
      <p>
      Thanks,
      <br>
      WordNorms Team

${emailFooter(origin)}
</body>
</html>
    `,
  }
}

export function createAdminRequestMsg({
  name,
  email,
  institution,
  reason,
}: {
  name?: string | null
  email: string
  institution?: string | null
  reason?: string | null
}) {
  const origin = process.env.APP_ORIGIN || process.env.BLITZ_DEV_SERVER_ORIGIN
  const rows = [
    `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">Email</td><td style="padding:4px 0">${email}</td></tr>`,
    name ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">Name</td><td style="padding:4px 0">${name}</td></tr>` : "",
    institution ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">Institution</td><td style="padding:4px 0">${institution}</td></tr>` : "",
    reason ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">Reason</td><td style="padding:4px 0">${reason}</td></tr>` : "",
  ].filter(Boolean).join("")

  return {
    from: "WordNorms <noreply@wordnorms.com>",
    to: "buchananlab@gmail.com",
    replyTo: email,
    subject: "Admin Access Request – WordNorms",
    html: `
<html><body>
<center><img src="${origin}/images/bannerWN_white.jpg" alt="WordNorms" style="max-width:600px;width:100%"></center>
<h3>Admin Access Request</h3>
<p>A user has requested admin access.</p>
<table style="border-collapse:collapse;margin-top:12px">${rows}</table>
<p style="margin-top:16px"><a href="${origin}/admin/users" style="background:#3b82f6;color:#fff;padding:8px 16px;border-radius:4px;text-decoration:none">Review in Admin Panel</a></p>
${emailFooter(origin)}
</body></html>
    `,
  }
}

export function createFeedbackMsg({
  message,
  name,
  email,
}: {
  message: string
  name?: string
  email?: string
}) {
  const origin = process.env.APP_ORIGIN || process.env.BLITZ_DEV_SERVER_ORIGIN
  const rows = [
    name ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">Name</td><td style="padding:4px 0">${name}</td></tr>` : "",
    email ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">Email</td><td style="padding:4px 0">${email}</td></tr>` : "",
    `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">Message</td><td style="padding:4px 0;white-space:pre-wrap">${message}</td></tr>`,
  ].filter(Boolean).join("")

  return {
    from: "WordNorms <noreply@wordnorms.com>",
    to: "buchananlab@gmail.com",
    replyTo: email ?? "noreply@wordnorms.com",
    subject: "Feedback – WordNorms",
    html: `
<html><body>
<center><img src="${origin}/images/bannerWN_white.jpg" alt="WordNorms" style="max-width:600px;width:100%"></center>
<h3>New Feedback</h3>
<table style="border-collapse:collapse;margin-top:12px">${rows}</table>
${emailFooter(origin)}
</body></html>
    `,
  }
}

export function createDatasetSuggestionMsg({
  datasetUrl,
  doi,
  contactEmail,
  note,
}: {
  datasetUrl: string
  doi?: string
  contactEmail?: string
  note?: string
}) {
  const origin = process.env.APP_ORIGIN || process.env.BLITZ_DEV_SERVER_ORIGIN
  const rows = [
    `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">Dataset URL</td><td style="padding:4px 0"><a href="${datasetUrl}">${datasetUrl}</a></td></tr>`,
    doi ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">DOI</td><td style="padding:4px 0">${doi}</td></tr>` : "",
    contactEmail ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">Contact</td><td style="padding:4px 0">${contactEmail}</td></tr>` : "",
    note ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">Note</td><td style="padding:4px 0">${note}</td></tr>` : "",
  ].filter(Boolean).join("")

  return {
    from: "WordNorms <noreply@wordnorms.com>",
    to: "buchananlab@gmail.com",
    replyTo: contactEmail ?? "buchananlab@gmail.com",
    subject: "New Dataset Suggestion – WordNorms",
    html: `
<html><body>
<center><img src="${origin}/images/bannerWN_white.jpg" alt="WordNorms" style="max-width:600px;width:100%"></center>
<h3>New Dataset Suggestion</h3>
<p>Someone suggested a dataset via the WordNorms datasets page.</p>
<table style="border-collapse:collapse;margin-top:12px">${rows}</table>
${emailFooter(origin)}
</body></html>
    `,
  }
}
