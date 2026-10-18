import crypto from 'crypto';

export function hmacSign(body, secret) {
  if (!secret) return null;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body, 'utf8');
  return hmac.digest('hex');
}
