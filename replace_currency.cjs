const fs = require('fs');
const files = [
  'src/components/Dashboard.tsx',
  'src/components/AdminPanel.tsx',
  'src/components/LandingPage.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // Replace \$ with ₹ but be careful not to replace template literals like ${
    // Actually, template literal placeholders are standard ${x}, so we can replace \$ with ₹ 
    // EXCEPT when followed by { ? No, in JSX template strings we write `${something}`.
    // If it's a dollar sign for currency: `$${something}` -> `₹${something}`.
    // Let's replace `$${` with `₹${`
    content = content.replace(/\$\$\{/g, '₹${');
    // For static amounts like `Rate/1k USD` to `Rate/1k INR`
    content = content.replace(/USD/g, 'INR');
    // For fixed amounts like `$1.00`, `$5.00`
    content = content.replace(/\$([0-9]+)/g, '₹$1');
    // For fixed text like `Pay \$` or `Add \$` -> wait, just $ followed by something.
    content = content.replace(/\$/g, (match, offset, string) => {
        if (string[offset+1] === '{') return '$'; // don't replace in ${}
        return '₹';
    });
    fs.writeFileSync(file, content);
  }
});
