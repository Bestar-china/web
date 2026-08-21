// 验证密钥链设计：AES-256-GCM + RSA-OAEP-2048 + key1/key2 拆分拼接
// 与浏览器端 keychain.ts 逻辑一致（Node 22 webcrypto 与浏览器 Web Crypto 同标准）
const webcrypto = globalThis.crypto;

// ---- helpers ----
function bytesToBase64(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return Buffer.from(binary, 'binary').toString('base64');
}
function base64ToBytes(b64) {
  const clean = (b64 || '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(clean, 'base64');
  return new Uint8Array(buf);
}
function strToBytes(s) { return new TextEncoder().encode(s); }
function bytesToStr(b) { return new TextDecoder().decode(b); }

// ---- AES ----
async function generateAesKey() {
  const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  return new Uint8Array(await webcrypto.subtle.exportKey('raw', key));
}
async function deriveAesKey(master, salt) {
  const input = new Uint8Array(master.length + strToBytes(salt).length);
  input.set(master, 0); input.set(strToBytes(salt), master.length);
  return new Uint8Array(await webcrypto.subtle.digest('SHA-256', input));
}
async function aesEncrypt(keyBytes, data) {
  const key = await webcrypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const cipher = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(cipher)) };
}
async function aesDecrypt(keyBytes, ivB64, dataB64) {
  const key = await webcrypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  return new Uint8Array(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(ivB64) }, key, base64ToBytes(dataB64)));
}

// ---- RSA ----
async function generateRsaPair() {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
  return {
    pub: bytesToBase64(new Uint8Array(await webcrypto.subtle.exportKey('spki', pair.publicKey))),
    priv: new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', pair.privateKey)),
  };
}
async function rsaEncrypt(pubB64, data) {
  const key = await webcrypto.subtle.importKey('spki', base64ToBytes(pubB64), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  return bytesToBase64(new Uint8Array(await webcrypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, data)));
}
async function rsaDecrypt(pkcs8, cipherB64) {
  const key = await webcrypto.subtle.importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  return new Uint8Array(await webcrypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, base64ToBytes(cipherB64)));
}

// ---- 拆分 ----
function splitWholeKey(whole) {
  const mid = Math.ceil(whole.length / 2);
  return [whole.slice(0, mid), whole.slice(mid)];
}
function joinWholeKey(a, b) { return a + b; }

// ---- 主流程 ----
async function main() {
  const apiKey = 'github_pat_TEST_TOKEN_abcdefghijklmnopqrstuvwxyz1234567890';
  const wholeKey = bytesToBase64(strToBytes(apiKey)); // whole_key(base64)
  const [seg1, seg2] = splitWholeKey(wholeKey);

  // 1) 生成密钥系统
  const aesMaster = await generateAesKey();
  const rsa = await generateRsaPair();
  const privCipher = await aesEncrypt(aesMaster, rsa.priv); // 私钥被对称密钥加密

  // 2) 加密 API Key：RSA 主存储 + key1/key2 拆分（不同派生密钥）
  const mainCipher = await rsaEncrypt(rsa.pub, strToBytes(wholeKey));
  const k1 = await deriveAesKey(aesMaster, 'key1');
  const k2 = await deriveAesKey(aesMaster, 'key2');
  const c1 = await aesEncrypt(k1, strToBytes(seg1));
  const c2 = await aesEncrypt(k2, strToBytes(seg2));
  const k1b64 = bytesToBase64(k1), k2b64 = bytesToBase64(k2);
  console.log('派生密钥不同:', k1b64 !== k2b64 ? 'PASS' : 'FAIL', `(k1=${k1b64.slice(0,12)}... k2=${k2b64.slice(0,12)}...)`);

  // 3) 方法1：RSA 主存储还原
  const privPlain = await aesDecrypt(aesMaster, privCipher.iv, privCipher.data);
  const privKey = await webcrypto.subtle.importKey('pkcs8', privPlain, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  const mainWhole = bytesToStr(await webcrypto.subtle.decrypt({ name: 'RSA-OAEP' }, privKey, base64ToBytes(mainCipher)));

  // 4) 方法2：key1 + key2 拆分还原
  const seg1Back = bytesToStr(await aesDecrypt(k1, c1.iv, c1.data));
  const seg2Back = bytesToStr(await aesDecrypt(k2, c2.iv, c2.data));
  const splitWhole = joinWholeKey(seg1Back, seg2Back);

  // 5) 交叉校验 + 还原 API Key
  console.log('RSA 主存储还原:', mainWhole === wholeKey ? 'PASS' : 'FAIL');
  console.log('拆分拼接还原:', splitWhole === wholeKey ? 'PASS' : 'FAIL');
  console.log('交叉校验一致:', mainWhole === splitWhole ? 'PASS' : 'FAIL');
  const apiKeyBack = bytesToStr(base64ToBytes(mainWhole || splitWhole));
  console.log('API Key 还原:', apiKeyBack === apiKey ? 'PASS' : 'FAIL');

  // 6) 容灾：主存储损坏 → 拆分兜底
  const backupOnly = bytesToStr(base64ToBytes(splitWhole));
  console.log('容灾(仅拆分):', backupOnly === apiKey ? 'PASS' : 'FAIL');

  // 7) 篡改检测：key1 段被改 → 交叉校验失败
  const c1Bad = { ...c1, data: bytesToBase64(new Uint8Array([...base64ToBytes(c1.data).slice(0, -1), base64ToBytes(c1.data)[0] ^ 1])) };
  let tamperDetected = false;
  try {
    const s1 = bytesToStr(await aesDecrypt(k1, c1Bad.iv, c1Bad.data));
    const s2 = bytesToStr(await aesDecrypt(k2, c2.iv, c2.data));
    if (joinWholeKey(s1, s2) !== mainWhole) tamperDetected = true;
  } catch { tamperDetected = true; }
  console.log('篡改检测(拆分不符):', tamperDetected ? 'PASS' : 'FAIL');

  // 8) 长度检查：RSA-OAEP-2048-SHA256 最大明文 190 字节
  console.log('whole_key 长度:', wholeKey.length, wholeKey.length <= 190 ? 'PASS(≤190)' : 'FAIL(超长)');
}

main().catch((e) => { console.error('ERROR', e); process.exit(1); });
