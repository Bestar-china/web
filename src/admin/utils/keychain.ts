// ==================== 密钥链工具（Web Crypto 封装） ====================
// 体系说明（按需求指定路径与格式，保留原样拼写）：
//
//   ① /api/encrypt_key/key_storage/key.xml
//        AES-256-GCM 对称密钥（raw 32 字节 → base64 编码存放，即"密钥由 base64 加密"）
//   ② /api/encypt_key/public/public_key.yml
//        RSA-OAEP-2048 公钥（SPKI → base64，YAML 格式）
//   ③ /api/encrypt_key/private/private_key_storage/key_storage.yml
//        RSA 私钥（PKCS8 → 用 ① 的 AES 密钥加密，YAML 格式）
//   ④ /api/key/api_key_storage.xml
//        API Key 主存储：whole_key 用 ② 的公钥 RSA-OAEP 加密（XML）
//   ⑤ /api/key/key1.xml + /api/key/key2.xml
//        API Key 拆分备份：whole_key 对半拆成两段，分别用从 ① 派生的不同密钥
//        （salt=key1 / salt=key2 → SHA-256 派生，密钥不一样）加密。
//        key1 解密段 + key2 解密段 = whole_key（base64）
//
// 读取还原：先解密主存储；失败再用 key1/key2 拼接还原；两套都成功则交叉校验。
// 任一文件丢失/损坏都有另一套兜底，实现容灾。
//
// 依赖：Web Crypto API（crypto.subtle），需要 https 或 localhost 安全上下文。

// ==================== 密钥文件路径（相对站点根） ====================
export const KEY_PATHS = {
  symmetricKey: 'api/encrypt_key/key_storage/key.xml',
  publicKey: 'api/encypt_key/public/public_key.yml',
  privateKey: 'api/encrypt_key/private/private_key_storage/key_storage.yml',
  apiKeyStorage: 'api/key/api_key_storage.xml',
  key1: 'api/key/key1.xml',
  key2: 'api/key/key2.xml',
} as const;

export const KEY_FILES: string[] = [
  KEY_PATHS.symmetricKey,
  KEY_PATHS.publicKey,
  KEY_PATHS.privateKey,
  KEY_PATHS.apiKeyStorage,
  KEY_PATHS.key1,
  KEY_PATHS.key2,
];

// ==================== Base64 / UTF-8 工具 ====================
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = (b64 || '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = clean.length % 4 === 0 ? '' : '='.repeat(4 - (clean.length % 4));
  const binary = atob(clean + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function strToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function bytesToStr(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// 判断是否处于安全上下文（crypto.subtle 可用）
export function isSecureContext(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

/** 把 Uint8Array 复制为 ArrayBuffer（解决 TS 5.7+ BufferSource 类型不兼容） */
export function toBuf(u8: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(u8.byteLength);
  copy.set(u8);
  return copy.buffer;
}

// ==================== AES-256-GCM ====================
export async function generateAesKey(): Promise<Uint8Array> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(raw);
}

/** 派生子密钥：SHA-256(母密钥 + salt) → 32 字节，供 key1/key2 使用不同密钥 */
export async function deriveAesKey(master: Uint8Array, salt: string): Promise<Uint8Array> {
  const input = new Uint8Array(master.length + strToBytes(salt).length);
  input.set(master, 0);
  input.set(strToBytes(salt), master.length);
  const digest = await crypto.subtle.digest('SHA-256', toBuf(input));
  return new Uint8Array(digest);
}

export interface AesCipher {
  iv: string; // base64
  data: string; // base64 ciphertext
}

export async function aesEncryptBytes(keyBytes: Uint8Array, data: Uint8Array): Promise<AesCipher> {
  const key = await crypto.subtle.importKey('raw', toBuf(keyBytes), { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, toBuf(data));
  return { iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(cipher)) };
}

export async function aesDecryptBytes(keyBytes: Uint8Array, ivB64: string, dataB64: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', toBuf(keyBytes), { name: 'AES-GCM' }, false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toBuf(base64ToBytes(ivB64)) }, key, toBuf(base64ToBytes(dataB64)));
  return new Uint8Array(plain);
}

// ==================== RSA-OAEP-2048 ====================
export interface RsaKeyPair {
  publicKeyB64: string; // SPKI base64
  privateKeyPkcs8: Uint8Array; // PKCS8 raw
}

export async function generateRsaKeyPair(): Promise<RsaKeyPair> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt']
  );
  const spki = await crypto.subtle.exportKey('spki', pair.publicKey);
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  return { publicKeyB64: bytesToBase64(new Uint8Array(spki)), privateKeyPkcs8: new Uint8Array(pkcs8) };
}

export async function importPublicKey(publicKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    toBuf(base64ToBytes(publicKeyB64)),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

export async function importPrivateKey(pkcs8: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'pkcs8',
    toBuf(pkcs8),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );
}

export async function rsaEncryptB64(publicKeyB64: string, data: Uint8Array): Promise<string> {
  const key = await importPublicKey(publicKeyB64);
  const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, toBuf(data));
  return bytesToBase64(new Uint8Array(cipher));
}

export async function rsaDecryptB64(privateKey: CryptoKey, cipherB64: string): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, toBuf(base64ToBytes(cipherB64)));
  return new Uint8Array(plain);
}

// ==================== API Key 拆分 / 拼接 ====================
// whole_key(base64) 对半拆成两段；解密后 key1 段 + key2 段 = whole_key
export function splitWholeKey(wholeKey: string): [string, string] {
  const mid = Math.ceil(wholeKey.length / 2);
  return [wholeKey.slice(0, mid), wholeKey.slice(mid)];
}

export function joinWholeKey(seg1: string, seg2: string): string {
  return seg1 + seg2;
}

// ==================== 简单 YAML / XML 格式 ====================
export function buildYml(fields: Record<string, string>): string {
  const lines = ['# Auto-generated by enterprise-website keychain', '---'];
  for (const [k, v] of Object.entries(fields)) {
    lines.push(`${k}: ${v}`);
  }
  return lines.join('\n') + '\n';
}

export function parseYml(yml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of (yml || '').split('\n')) {
    const m = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildSimpleXml(tag: string, fields: Record<string, string>): string {
  const inner = Object.entries(fields)
    .map(([k, v]) => `  <${k}>${escapeXml(v)}</${k}>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${tag}>\n${inner}\n</${tag}>\n`;
}

export function parseSimpleXml(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!xml || typeof DOMParser === 'undefined') return out;
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (!root) return out;
  for (let i = 0; i < root.children.length; i++) {
    const child = root.children[i];
    out[child.tagName] = child.textContent ?? '';
  }
  return out;
}

// ==================== 密钥系统文件构建 ====================
export interface KeySystemFiles {
  /** path → 文件内容（文本） */
  [path: string]: string;
}

/**
 * 生成整套密钥文件（不含 api_key_storage.xml / key1 / key2，那些在保存 API Key 时生成）。
 * @returns 文件路径 → 文本内容
 */
export async function generateKeySystemFiles(): Promise<KeySystemFiles> {
  const now = new Date().toISOString();
  const aesKey = await generateAesKey();
  const { publicKeyB64, privateKeyPkcs8 } = await generateRsaKeyPair();

  // 私钥用对称密钥加密
  const privCipher = await aesEncryptBytes(aesKey, privateKeyPkcs8);

  return {
    [KEY_PATHS.symmetricKey]: buildSimpleXml('keyStorage', {
      algorithm: 'AES-256-GCM',
      encoding: 'base64',
      key: bytesToBase64(aesKey),
      createdAt: now,
    }),
    [KEY_PATHS.publicKey]: buildYml({
      algorithm: 'RSA-OAEP-2048-SHA256',
      format: 'SPKI-BASE64',
      publicKey: publicKeyB64,
      createdAt: now,
    }),
    [KEY_PATHS.privateKey]: buildYml({
      algorithm: 'RSA-OAEP-2048-SHA256',
      format: 'PKCS8-AES256-GCM',
      aesIv: privCipher.iv,
      privateKey: privCipher.data,
      createdAt: now,
    }),
  };
}

// ==================== API Key 加密 / 解密 ====================
export interface KeyMaterial {
  /** 已导入的 RSA 私钥（用于解密主存储） */
  rsaPrivateKey: CryptoKey;
  /** AES 对称密钥（用于解密 key1/key2） */
  aesKey: Uint8Array;
}

/**
 * 从密钥文件内容加载密钥材料（解密私钥）。
 * @param files 已拉取到的密钥文件内容
 */
export async function loadKeyMaterial(files: Record<string, string>): Promise<KeyMaterial> {
  const keyXml = parseSimpleXml(files[KEY_PATHS.symmetricKey] || '');
  const aesKey = base64ToBytes(keyXml.key || '');

  const privYml = parseYml(files[KEY_PATHS.privateKey] || '');
  const pkcs8 = await aesDecryptBytes(aesKey, privYml.aesIv || '', privYml.privateKey || '');
  const rsaPrivateKey = await importPrivateKey(pkcs8);

  return { rsaPrivateKey, aesKey };
}

/**
 * 用公钥 + 派生密钥加密 API Key，生成三个存储文件。
 * @param files 密钥系统文件（需含 publicKey）
 * @param apiKey 明文 API Key
 */
export async function encryptApiKey(files: Record<string, string>, apiKey: string): Promise<KeySystemFiles> {
  const now = new Date().toISOString();
  const wholeKey = bytesToBase64(strToBytes(apiKey.trim())); // whole_key（base64）
  const [seg1, seg2] = splitWholeKey(wholeKey);

  const pubYml = parseYml(files[KEY_PATHS.publicKey] || '');
  const mainCipher = await rsaEncryptB64(pubYml.publicKey || '', strToBytes(wholeKey));

  const keyXml = parseSimpleXml(files[KEY_PATHS.symmetricKey] || '');
  const aesMaster = base64ToBytes(keyXml.key || '');
  const k1 = await deriveAesKey(aesMaster, 'key1');
  const k2 = await deriveAesKey(aesMaster, 'key2');
  const c1 = await aesEncryptBytes(k1, strToBytes(seg1));
  const c2 = await aesEncryptBytes(k2, strToBytes(seg2));

  return {
    [KEY_PATHS.apiKeyStorage]: buildSimpleXml('apiKeyStorage', {
      algorithm: 'RSA-OAEP-2048-SHA256',
      encoding: 'base64',
      ciphertext: mainCipher,
      createdAt: now,
    }),
    [KEY_PATHS.key1]: buildSimpleXml('apiKeySegment', {
      algorithm: 'AES-256-GCM',
      salt: 'key1',
      iv: c1.iv,
      segment: c1.data,
      createdAt: now,
    }),
    [KEY_PATHS.key2]: buildSimpleXml('apiKeySegment', {
      algorithm: 'AES-256-GCM',
      salt: 'key2',
      iv: c2.iv,
      segment: c2.data,
      createdAt: now,
    }),
  };
}

export interface DecryptResult {
  ok: boolean;
  wholeKey: string;
  apiKey: string;
  method: 'rsa-main' | 'split-backup' | 'none';
  error?: string;
}

/**
 * 解密还原 API Key。
 * 优先主存储（RSA），失败用拆分备份（key1+key2），两套都成功则交叉校验。
 */
export async function decryptApiKey(files: Record<string, string>): Promise<DecryptResult> {
  const empty: DecryptResult = { ok: false, wholeKey: '', apiKey: '', method: 'none', error: '缺少必要的密钥文件' };

  // ---- 方法 1：RSA 主存储 ----
  let mainWhole = '';
  try {
    const material = await loadKeyMaterial(files);
    const mainXml = parseSimpleXml(files[KEY_PATHS.apiKeyStorage] || '');
    if (mainXml.ciphertext) {
      mainWhole = bytesToStr(await rsaDecryptB64(material.rsaPrivateKey, mainXml.ciphertext));
    }
  } catch {
    mainWhole = '';
  }

  // ---- 方法 2：key1 + key2 拆分还原 ----
  let splitWhole = '';
  try {
    const keyXml = parseSimpleXml(files[KEY_PATHS.symmetricKey] || '');
    const aesMaster = base64ToBytes(keyXml.key || '');
    const k1 = await deriveAesKey(aesMaster, 'key1');
    const k2 = await deriveAesKey(aesMaster, 'key2');
    const x1 = parseSimpleXml(files[KEY_PATHS.key1] || '');
    const x2 = parseSimpleXml(files[KEY_PATHS.key2] || '');
    if (x1.segment && x2.segment) {
      const seg1 = bytesToStr(await aesDecryptBytes(k1, x1.iv, x1.segment));
      const seg2 = bytesToStr(await aesDecryptBytes(k2, x2.iv, x2.segment));
      splitWhole = joinWholeKey(seg1, seg2);
    }
  } catch {
    splitWhole = '';
  }

  // ---- 交叉校验 ----
  if (mainWhole && splitWhole && mainWhole !== splitWhole) {
    return { ok: false, wholeKey: '', apiKey: '', method: 'none', error: '主存储与拆分备份不一致，文件可能被篡改，拒绝使用' };
  }

  const wholeKey = mainWhole || splitWhole;
  if (!wholeKey) {
    return { ok: false, wholeKey: '', apiKey: '', method: 'none', error: '所有密钥文件均无法解密，请重新初始化密钥系统' };
  }

  let apiKey = '';
  try {
    apiKey = bytesToStr(base64ToBytes(wholeKey));
  } catch {
    return { ok: false, wholeKey: '', apiKey: '', method: 'none', error: '还原的密钥格式异常' };
  }

  return { ok: true, wholeKey, apiKey, method: mainWhole ? 'rsa-main' : 'split-backup' };
}
