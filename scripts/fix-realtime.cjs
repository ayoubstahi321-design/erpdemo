// Script temporal para fix useRealtime.ts
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'hooks', 'useRealtime.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Reemplazar todas las ocurrencias
content = content.replace(/supabase\.removeChannel\(/g, 'realtimeClient.removeChannel(');
content = content.replace(/const channel = supabase\s+\.channel\(/g, 'const channel = realtimeClient\n      .channel(');
content = content.replace(/\.on\(\s*'postgres_changes',\s*\{\s*event:\s*'\*',\s*schema:\s*'public',\s*table:\s*'[^']+',?\s*\},\s*\(payload\)\s*=>/g, (match) => {
  return match.replace('(payload)', '(payload: any)');
});
content = content.replace(/\.subscribe\(\(status\)\s*=>/g, '.subscribe((status: any) =>');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ useRealtime.ts fixed');
