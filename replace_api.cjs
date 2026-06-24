const fs = require('fs');
const files = [
  'src/components/Dashboard.tsx',
  'src/components/AdminPanel.tsx',
  'src/components/GmailAuthModal.tsx',
  'src/App.tsx'
];
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/\$\{API_BASE\}\/api\/(.*?)'/g, '${API_BASE}/api/$1`');
  fs.writeFileSync(f, content);
});
