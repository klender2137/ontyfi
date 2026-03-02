// Test Firebase Admin SDK connection
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  console.log('Testing Firebase Admin SDK...');
  
  const serviceAccountPath = join(__dirname, './public/crypto-explorer-2137-39f8d27496da.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  
  console.log('Service account:', {
    project_id: serviceAccount.project_id,
    client_email: serviceAccount.client_email
  });
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    console.log('✅ Firebase Admin initialized');
  }
  
  // Test auth service
  console.log('Testing auth service...');
  const auth = admin.auth();
  console.log('Auth service available:', !!auth);
  
  // Test creating a user (this will fail if permissions are wrong)
  console.log('Testing user creation...');
  try {
    const testUser = await auth.createUser({
      email: 'test@example.com',
      password: 'test123456',
      displayName: 'Test User'
    });
    console.log('✅ User created successfully:', testUser.uid);
    
    // Clean up
    await auth.deleteUser(testUser.uid);
    console.log('✅ Test user deleted');
  } catch (error) {
    console.error('❌ User creation failed:', error.message);
    console.error('Error code:', error.code);
  }
  
  console.log('Test completed');
  
} catch (error) {
  console.error('❌ Test failed:', error);
}
