export const hexToBase64 = (hex: string) => {
  const clean = hex.replace(/[\s\n]/g, '').replace(/^0x/i, '')
  if (clean.length % 2 !== 0) return '' 
  try {
    const bytes = new Uint8Array(clean.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [])
    let binary = ''
    bytes.forEach(b => binary += String.fromCharCode(b))
    return window.btoa(binary)
  } catch (e) {
    return ''
  }
}

export const base64ToHex = (base64: string) => {
  try {
    const binary = window.atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  } catch (e) {
    return ''
  }
}

export const safeParse = (json: string) => {
    try {
        return json ? JSON.parse(json) : undefined;
    } catch {
        return undefined;
    }
}

export const hexTo0xHex = (hex: string) => {
    const clean = hex.replace(/[\s\n]/g, '').replace(/^0x/i, '');
    if (!clean) return '';
    const chunks = clean.match(/.{1,2}/g) || [];
    return chunks.map(b => '0x' + b.toUpperCase()).join(', ');
};

export const xHexToHex = (xHex: string) => {
    let clean = xHex.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
    return clean.toUpperCase();
};

