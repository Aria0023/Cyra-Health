/** Pages in a PDF: its /Type /Page objects (not /Pages). */
export const pdfPages = (bytes) => (Buffer.from(bytes).toString("latin1").match(/\/Type\s*\/Page(?![s])/g) || []).length;
