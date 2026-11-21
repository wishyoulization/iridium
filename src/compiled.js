// A cell's compiled record is saved next to its source, so a notebook can be
// run without loading the compiler (src/compile.js). It is only used while it
// matches the source and the current record format.
//
//   { v, hash, body, inputs, outputs, output, autodisplay, autoview, automutable,
//     summary }   // summary: highlighted HTML for import cells
//   { v, hash, error }   // the cell does not compile; error is the message

// Bump when the compiler or the record shape changes, to recompile old records.
export const FORMAT = 1;

// FNV-1a: a small, fast fingerprint of the source the record was built from.
export const hashSource = (source) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};

export const isCurrent = (record, source) =>
  record?.v === FORMAT && record.hash === hashSource(source);
