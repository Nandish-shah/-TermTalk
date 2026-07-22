const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CERT_FILE = path.join(__dirname, 'cert.pem');
const KEY_FILE = path.join(__dirname, 'key.pem');

if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
  console.log('✅ Certificates already exist');
  process.exit(0);
}

console.log('🔐 Generating self-signed certificate...');

try {
  execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${KEY_FILE}" -out "${CERT_FILE}" -days 365 -nodes -subj "/CN=localhost"`, { 
    stdio: 'inherit',
    shell: true
  });
  console.log('✅ Certificate generated successfully!');
  console.log(`📄 Files created: cert.pem, key.pem`);
} catch (e) {
  console.log('❌ OpenSSL not found or failed');
  console.log('');
  console.log('📥 Install OpenSSL:');
  console.log('   Windows: https://slproweb.com/products/Win32OpenSSL.html');
  console.log('   After install, restart this terminal and try again.');
  process.exit(1);
}
