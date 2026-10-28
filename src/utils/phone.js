function normalizePhoneNumber(raw) {
  if (!raw) return '';
  const str = String(raw).trim();
  // Preserve WhatsApp Group JID (e.g. 120363025489123456@g.us)
  if (str.includes('@g.us') || str.includes('@s.whatsapp.net') || str.includes('@c.us')) {
    return str;
  }

  let cleanNumber = str.replace(/\D/g, '');
  if (cleanNumber.length === 10) {
    cleanNumber = '91' + cleanNumber;
  }
  return cleanNumber;
}

function extractPhoneNumber(params) {
  const raw = params.number || params.mobile || params.phone || params.to ||
    params.mobileNumber || params.mobile_number || params.phoneNumber || params.phone_number || '';
  return normalizePhoneNumber(raw);
}

module.exports = {
  normalizePhoneNumber,
  extractPhoneNumber
};
