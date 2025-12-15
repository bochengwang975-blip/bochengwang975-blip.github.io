export const uuid = () =>
  ([1e7] + -1e3 + -4e3 + -8e3 + -1e11)
    .replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));

export const formatDate = (date = new Date()) =>
  new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));

const toHex = buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");

export const sha256 = async text => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return toHex(hashBuffer);
};

export const randomSalt = () => crypto.getRandomValues(new Uint8Array(8)).join("-");

export const hashPassword = async (password, salt) => sha256(`${salt}:${password}`);

export const downloadJSON = (obj, filename = "backup.json") => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const parseCSV = text => {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",").map(h => h.trim());
  return lines.map(line => {
    const values = line.split(",").map(v => v.trim());
    return headers.reduce((acc, h, i) => ({ ...acc, [h]: values[i] || "" }), {});
  });
};

export const createElement = (tag, className, children) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (children) {
    if (Array.isArray(children)) children.forEach(child => el.append(child));
    else el.append(children);
  }
  return el;
};
