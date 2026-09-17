// Builds approved preview data from the samples already bundled with this project.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'supabase-config.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function getMockBranches()')), context);
const data = JSON.parse(vm.runInContext('JSON.stringify({properties:getMockProperties(),images:getMockPropertyImages()})', context));
data.images = data.images.filter(row => !row.image_url.includes('example.com'));
for (const property of data.properties.filter(row => row.property_type === 'Land')) {
  data.images.push({property_id:property.id,image_url:'assets/sample-land.png',display_order:1,is_cover:true});
}
fs.writeFileSync(path.join(root, 'listings-preview-data.js'), '// Approved bundled samples; illustrative content only. No network data connection.\nwindow.propertyPreviewData = ' + JSON.stringify(data, null, 2).replace(/</g, '\\u003c') + ';\n');
fs.writeFileSync(path.join(root, 'listings-preview.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=listings.html"><title>Property listings preview</title></head><body><a href="listings.html">Open the property results page</a></body></html>');
console.log('Built listings-preview-data.js; open listings.html.');
