import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_URL = 'http://localhost:4000';

const TEST_USERS = {
  admin: { email: 'admin@qametrics.com', password: 'QaMetrics2024!' },
  lead: { email: 'laura.gomez@qametrics.com', password: 'Lead2024!' },
  analyst: { email: 'ana.garcia@qametrics.com', password: 'Analyst2024!' },
};

async function globalSetup() {
  const authDir = path.join(__dirname, '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Login each user via API and save their tokens
  for (const [role, creds] of Object.entries(TEST_USERS)) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    });

    if (!response.ok) {
      console.error(`Failed to login ${role}: ${response.status} - ${await response.text()}`);
      continue;
    }

    const data = await response.json();

    // Save tokens to file for use in tests
    const tokenPath = path.join(authDir, `${role}-tokens.json`);
    fs.writeFileSync(tokenPath, JSON.stringify(data, null, 2));
    console.log(`Saved auth tokens for ${role}`);
  }
}

export default globalSetup;
