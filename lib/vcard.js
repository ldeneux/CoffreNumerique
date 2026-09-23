// Parseur vCard (.vcf) minimal, pour les exports de contacts Android / iPhone.
// Gère vCard 2.1, 3.0 et 4.0 (les variantes les plus courantes de TEL/EMAIL/ADR/N/BDAY).

function decodeVCardValue(v) {
  if (!v) return "";
  return v
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function normalizeVCardDate(v) {
  if (!v) return null;
  if (v.startsWith("--")) return null; // anniversaire sans année, non exploitable
  const digits = v.replace(/[^0-9]/g, "");
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return null;
}

function finalizeCard(c) {
  const phones = c.phones || [];
  const mobile = phones.find((p) => /CELL|MOBILE/.test(p.type));
  const other = phones.find((p) => p !== mobile);
  const fullName = c.fn || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.org || "(Sans nom)";
  return {
    fullName,
    firstName: c.firstName || "",
    lastName: c.lastName || "",
    org: c.org || "",
    mobile: mobile ? mobile.value : phones[0]?.value || "",
    phone2: other ? other.value : "",
    email: (c.emails || [])[0] || "",
    birthday: c.bday || null,
    address: c.address || null,
  };
}

export function parseVCardFile(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // "Dépliage" des lignes coupées (RFC 6350 : une ligne de continuation
  // commence par une espace ou une tabulation).
  const unfolded = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else if (line.trim() !== "") {
      unfolded.push(line);
    }
  }

  const cards = [];
  let current = null;

  for (const line of unfolded) {
    if (/^BEGIN:VCARD/i.test(line)) {
      current = {};
      continue;
    }
    if (/^END:VCARD/i.test(line)) {
      if (current) cards.push(finalizeCard(current));
      current = null;
      continue;
    }
    if (!current) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const rawKey = line.slice(0, idx);
    const rawValue = line.slice(idx + 1);
    const [key, ...paramParts] = rawKey.split(";");
    const params = paramParts.join(";").toUpperCase();
    const keyUpper = key.toUpperCase();
    const value = rawValue.trim();

    switch (keyUpper) {
      case "FN":
        current.fn = decodeVCardValue(value);
        break;
      case "N": {
        const parts = value.split(";").map(decodeVCardValue);
        current.lastName = parts[0] || "";
        current.firstName = parts[1] || "";
        break;
      }
      case "ORG":
        current.org = decodeVCardValue(value.split(";")[0]);
        break;
      case "TEL":
        current.phones = current.phones || [];
        current.phones.push({ type: params, value: decodeVCardValue(value).replace(/^tel:/i, "") });
        break;
      case "EMAIL":
        current.emails = current.emails || [];
        current.emails.push(decodeVCardValue(value));
        break;
      case "BDAY":
        current.bday = normalizeVCardDate(value);
        break;
      case "ADR": {
        const parts = value.split(";").map(decodeVCardValue);
        current.address = {
          street: parts[2] || "",
          city: parts[3] || "",
          region: parts[4] || "",
          postalCode: parts[5] || "",
          country: parts[6] || "",
        };
        break;
      }
      default:
        break;
    }
  }

  return cards;
}
