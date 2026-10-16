// Minimal JSON Schema validator (the subset used by kingdom.schema.json):
// type, required, properties, additionalProperties(false), items, enum, minimum, $ref to #/$defs.
export function validate(schema, value, root = schema, at = '$') {
  if (schema.$ref) return validate(resolve(root, schema.$ref), value, root, at);
  const errs = [];
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some((t) => typeOk(t, value))) return [`${at}: expected ${types.join('|')}`];
  }
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: not one of ${schema.enum.join(',')}`);
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errs.push(`${at}: < ${schema.minimum}`);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${at}: missing ${k}`);
    for (const [k, sub] of Object.entries(schema.properties || {})) if (k in value) errs.push(...validate(sub, value[k], root, `${at}.${k}`));
    if (schema.additionalProperties === false)
      for (const k of Object.keys(value)) if (!(k in (schema.properties || {}))) errs.push(`${at}: unexpected ${k}`);
  }
  if (Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length && errs.length < 20; i++) errs.push(...validate(schema.items, value[i], root, `${at}[${i}]`));
  }
  return errs;
}

function typeOk(t, v) {
  switch (t) {
    case 'integer': return Number.isInteger(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'array': return Array.isArray(v);
    case 'object': return v !== null && typeof v === 'object' && !Array.isArray(v);
    case 'null': return v === null;
    default: return typeof v === t;
  }
}

function resolve(root, ref) {
  return ref.replace(/^#\//, '').split('/').reduce((o, k) => o[k], root);
}
