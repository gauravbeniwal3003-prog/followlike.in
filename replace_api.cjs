const fs = require('fs');
const files = ['src/App.tsx', 'src/components/Dashboard.tsx', 'src/components/AdminPanel.tsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/fetch\('\/api/g, "fetch('https://followlike-in.onrender.com/api");
  fs.writeFileSync(file, content);
});
