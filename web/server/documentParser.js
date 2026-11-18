import zlib from 'zlib';

const ZIP_LOCAL_FILE_SIG = 0x04034b50;
const ZIP_CENTRAL_DIR_SIG = 0x02014b50;
const ZIP_EOCD_SIG = 0x06054b50;

const XML_ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function decodeXmlEntities(str) {
  return String(str || '')
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITY_MAP[m] || m)
    .replace(/&#(\d+);/g, (_, num) => {
      const cp = Number(num);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const cp = parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    });
}

function extractZipEntryBuffer(zipBuffer, targetEntryName) {
  if (!Buffer.isBuffer(zipBuffer) || zipBuffer.length < 22) {
    throw new Error('File is not a valid ZIP/DOCX archive.');
  }

  // Locate End of Central Directory record scanning backwards up to 64KB
  const minOffset = Math.max(0, zipBuffer.length - 65557);
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= minOffset; i -= 1) {
    if (zipBuffer.readUInt32LE(i) === ZIP_EOCD_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('DOCX archive directory footer not found.');
  }

  const centralDirSize = zipBuffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  let cursor = centralDirOffset;
  const end = Math.min(zipBuffer.length, centralDirOffset + centralDirSize);

  while (cursor + 46 <= end) {
    if (zipBuffer.readUInt32LE(cursor) !== ZIP_CENTRAL_DIR_SIG) break;
    const compressionMethod = zipBuffer.readUInt16LE(cursor + 10);
    const compressedSize = zipBuffer.readUInt32LE(cursor + 20);
    const fileNameLength = zipBuffer.readUInt16LE(cursor + 28);
    const extraLength = zipBuffer.readUInt16LE(cursor + 30);
    const commentLength = zipBuffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(cursor + 42);

    const nameStart = cursor + 46;
    const nameEnd = nameStart + fileNameLength;
    const entryName = zipBuffer.slice(nameStart, nameEnd).toString('utf8');

    if (entryName === targetEntryName) {
      if (localHeaderOffset + 30 > zipBuffer.length) {
        throw new Error('Corrupt DOCX local header offset.');
      }
      if (zipBuffer.readUInt32LE(localHeaderOffset) !== ZIP_LOCAL_FILE_SIG) {
        throw new Error('Invalid DOCX local file signature.');
      }
      const localNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > zipBuffer.length) {
        throw new Error('Truncated DOCX entry payload.');
      }
      const rawSlice = zipBuffer.slice(dataStart, dataEnd);
      if (compressionMethod === 0) {
        return rawSlice;
      }
      if (compressionMethod === 8) {
        return zlib.inflateRawSync(rawSlice);
      }
      throw new Error(`Unsupported ZIP compression method (${compressionMethod}) in DOCX.`);
    }

    cursor = nameEnd + extraLength + commentLength;
  }

  return null;
}

export function extractTextFromDocxBuffer(buffer) {
  const xmlBuf = extractZipEntryBuffer(buffer, 'word/document.xml');
  if (!xmlBuf) {
    throw new Error('DOCX archive does not contain word/document.xml.');
  }
  const xml = xmlBuf.toString('utf8');
  // Preserve paragraph breaks, line breaks, and tabs cleanly before stripping tags
  const withLayout = xml
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tr>/g, '\n')
    .replace(/<\/w:tc>/g, ' | ')
    .replace(/<[^>]+>/g, '');

  const decoded = decodeXmlEntities(withLayout)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return decoded;
}

export function parseDocumentPayload({ fileName = 'document', mimeType = '', fileBase64 = '', textContent = '' }) {
  const lowerName = String(fileName || '').toLowerCase();
  const safeMime = String(mimeType || '').toLowerCase();

  if (typeof textContent === 'string' && textContent.trim()) {
    const clean = textContent.trim().slice(0, 120000);
    return {
      kind: 'text',
      fileName,
      mimeType: safeMime || 'text/plain',
      text: clean,
      charCount: clean.length,
      wordCount: clean.split(/\s+/).filter(Boolean).length,
    };
  }

  if (!fileBase64 || typeof fileBase64 !== 'string') {
    throw new Error('Either fileBase64 or textContent is required to parse a document.');
  }

  const cleanBase64 = fileBase64.replace(/^data:[^;]+;base64,/, '').trim();
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (buffer.length === 0) {
    throw new Error('Uploaded document payload is empty.');
  }

  const isDocx =
    lowerName.endsWith('.docx') ||
    safeMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (isDocx) {
    const extracted = extractTextFromDocxBuffer(buffer).slice(0, 120000);
    return {
      kind: 'docx',
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      text: extracted,
      charCount: extracted.length,
      wordCount: extracted.split(/\s+/).filter(Boolean).length,
    };
  }

  const isText =
    safeMime.startsWith('text/') ||
    safeMime === 'application/json' ||
    /\.(txt|md|markdown|csv|json|log|yaml|yml|xml|js|ts|py|kt|java|html|css)$/i.test(lowerName);

  if (isText) {
    const extracted = buffer.toString('utf8').trim().slice(0, 120000);
    return {
      kind: 'text',
      fileName,
      mimeType: safeMime || 'text/plain',
      text: extracted,
      charCount: extracted.length,
      wordCount: extracted.split(/\s+/).filter(Boolean).length,
    };
  }

  if (safeMime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return {
      kind: 'pdf',
      fileName,
      mimeType: 'application/pdf',
      cleanBase64,
      byteLength: buffer.length,
      text: '',
      charCount: 0,
      wordCount: 0,
    };
  }

  throw new Error(
    `Unsupported document type "${safeMime || lowerName}". Supported formats: PDF, DOCX, TXT, MD, CSV, JSON.`
  );
}
