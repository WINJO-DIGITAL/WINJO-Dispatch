// Emails from the platform itself (to the platform owner), not from any business. Plain on purpose:
// no business brand, name or wordmark is used, so nothing belonging to one business can appear.

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The owner's one-time sign-in link. */
export function signInLinkPlatform({ url, platformName = "Winjo Digital" }) {
  const name = esc(platformName);
  const html = `<!doctype html><html lang="en-GB"><body style="margin:0;padding:24px;background:#f6f3ec;font-family:Arial,Helvetica,sans-serif;color:#17261f"><div style="max-width:520px;margin:0 auto;background:#fff;padding:28px;border:1px solid #cfc8b8"><p style="margin:0 0 6px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#4a574f">${name}</p><h1 style="margin:0 0 16px;font-size:22px;font-weight:600">Sign in</h1><p style="margin:0 0 16px;font-size:16px;line-height:24px">Use the button to sign in to the platform. You do not need a password. The link works once and expires in an hour.</p><p style="margin:0 0 20px"><a href="${esc(url)}" style="display:inline-block;background:#a9441f;color:#fff;text-decoration:none;font-weight:600;padding:13px 22px;border-radius:3px">Sign in</a></p><p style="margin:0;font-size:14px;line-height:21px;color:#4a574f">If you did not ask for this, ignore this email. Nobody can sign in without it.</p></div></body></html>`;
  const text = `${platformName}: sign in\n\nUse this link to sign in to the platform. You do not need a password. It works once and expires in an hour.\n\n${url}\n\nIf you did not ask for this, ignore this email. Nobody can sign in without it.`;
  return { subject: `Your ${platformName} sign-in link`, html, text };
}
