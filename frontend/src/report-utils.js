export function csvText(rows) {
  return rows.map(row=>row.map(value=>{
    let text=String(value??'');
    if(/^\s*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  }).join(',')).join('\r\n');
}
