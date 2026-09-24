/**
 * Contact link builders. Bodies are ALWAYS encoded with encodeURIComponent
 * (never URLSearchParams, which turns spaces into "+").
 */
export const telHref = (e164: string): string => `tel:${e164}`;

/** sms:+381600287631?&body=… — the "?&" form works on both iOS and Android. */
export const smsHref = (e164: string, body?: string): string =>
  body ? `sms:${e164}?&body=${encodeURIComponent(body)}` : `sms:${e164}`;

export const mailtoHref = (email: string, subject?: string, body?: string): string => {
  const params = [
    subject ? `subject=${encodeURIComponent(subject)}` : "",
    body ? `body=${encodeURIComponent(body)}` : "",
  ].filter(Boolean);
  return params.length ? `mailto:${email}?${params.join("&")}` : `mailto:${email}`;
};

/** viber://chat?number=%2B381600287631 */
export const viberHref = (e164: string): string => `viber://chat?number=${encodeURIComponent(e164)}`;
