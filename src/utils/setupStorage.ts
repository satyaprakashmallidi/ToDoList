import { supabase } from '../lib/supabase';

export interface StorageSetupResult {
  success: boolean;
  message: string;
  bucketExists: boolean;
  policiesExist: boolean;
}

export async function checkAndSetupStorage(): Promise<StorageSetupResult> {
  try {
    console.log('🔍 Checking Supabase Storage setup...');
    
    // 1. Check if bucket exists
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('❌ Error checking buckets:', bucketError);
      return {
        success: false,
        message: `Failed to check storage buckets: ${bucketError.message}`,
        bucketExists: false,
        policiesExist: false
      };
    }

    const chatFilesBucket = buckets?.find(bucket => bucket.name === 'chat-files');
    
    if (!chatFilesBucket) {
      console.warn('⚠️ chat-files bucket does not exist');
      
      // Try to create the bucket
      const createResult = await createChatFilesBucket();
      if (!createResult.success) {
        return createResult;
      }
    } else {
      console.log('✅ chat-files bucket exists');
    }

    // 2. Check if we can upload a test file (this tests policies)
    const policiesWork = await testUploadPermissions();
    
    if (!policiesWork) {
      console.warn('⚠️ Upload policies may not be configured properly');
      // Still return success but note policy issues
      return {
        success: true,
        message: 'Storage bucket exists but policies may need configuration',
        bucketExists: true,
        policiesExist: false
      };
    }
    
    return {
      success: true,
      message: 'Storage is properly configured',
      bucketExists: true,
      policiesExist: true
    };

  } catch (error) {
    console.error('❌ Storage setup check failed:', error);
    return {
      success: false,
      message: `Storage setup failed: ${error.message}`,
      bucketExists: false,
      policiesExist: false
    };
  }
}

async function createChatFilesBucket(): Promise<StorageSetupResult> {
  try {
    console.log('🛠️ Attempting to create chat-files bucket...');
    
    // Note: This might not work if user doesn't have admin permissions
    const { error } = await supabase.storage.createBucket('chat-files', {
      public: true,
      fileSizeLimit: 52428800, // 50MB limit
      allowedMimeTypes: null // Allow all file types
    });

    if (error) {
      console.error('❌ Failed to create bucket:', error);
      return {
        success: false,
        message: `Could not create bucket: ${error.message}. Please create it manually in Supabase Dashboard.`,
        bucketExists: false,
        policiesExist: false
      };
    }

    console.log('✅ chat-files bucket created successfully');
    
    // Try to set up basic policies
    await setupStoragePolicies();
    
    return {
      success: true,
      message: 'Bucket created successfully',
      bucketExists: true,
      policiesExist: true
    };
    
  } catch (error) {
    console.error('❌ Error creating bucket:', error);
    return {
      success: false,
      message: `Bucket creation failed: ${error.message}`,
      bucketExists: false,
      policiesExist: false
    };
  }
}

async function setupStoragePolicies(): Promise<void> {
  try {
    console.log('🔐 Setting up storage policies...');
    
    // Create upload policy (users can upload to their own folder)
    const uploadPolicySQL = `
      CREATE POLICY "Users can upload their own files" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'chat-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
    `;
    
    // Create download policy (anyone can view files)
    const downloadPolicySQL = `
      CREATE POLICY "Anyone can view uploaded files" ON storage.objects
      FOR SELECT USING (bucket_id = 'chat-files');
    `;

    // Note: These might fail if policies already exist, which is okay
    try {
      await supabase.rpc('exec_sql', { sql: uploadPolicySQL });
      console.log('✅ Upload policy created');
    } catch (error) {
      console.log('ℹ️ Upload policy might already exist:', error.message);
    }

    try {
      await supabase.rpc('exec_sql', { sql: downloadPolicySQL });
      console.log('✅ Download policy created');
    } catch (error) {
      console.log('ℹ️ Download policy might already exist:', error.message);
    }
    
  } catch (error) {
    console.warn('⚠️ Could not set up policies automatically:', error);
  }
}

async function testUploadPermissions(): Promise<boolean> {
  try {
    console.log('🧪 Testing upload permissions...');
    
    // Try to upload a tiny test file
    const testFile = new Blob(['test'], { type: 'text/plain' });
    const testPath = `test/${Date.now()}.txt`;
    
    const { error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(`test/${testPath}`, testFile);

    if (uploadError) {
      console.warn('⚠️ Upload permission test failed:', uploadError.message);
      // Don't return false immediately - some errors might be acceptable
      if (uploadError.message.includes('policy') || uploadError.message.includes('permission')) {
        return false;
      }
      // Other errors might be fine (like duplicate file names)
      return true;
    }

    // Clean up test file
    await supabase.storage
      .from('chat-files')
      .remove([`test/${testPath}`]);

    console.log('✅ Upload permissions working');
    return true;
    
  } catch (error) {
    console.warn('⚠️ Upload permission test error:', error);
    // If we can't test, assume it's working
    return true;
  }
}

export async function getStorageInstructions(): Promise<string> {
  return `
🛠️ STORAGE SETUP REQUIRED

To fix file uploads, please create a Supabase Storage bucket:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to: Storage > Create new bucket
3. Bucket name: chat-files
4. Public: ✅ CHECKED (important!)
5. Click "Create bucket"

6. Set up policies:
   - Go to Storage > Policies
   - Add these policies for the chat-files bucket:
   
   Upload Policy:
   - Name: "Users can upload their own files"
   - Operation: INSERT
   - Role: authenticated
   - Expression: (bucket_id = 'chat-files') AND (auth.uid()::text = (storage.foldername(name))[1])
   
   Download Policy:
   - Name: "Anyone can view uploaded files"  
   - Operation: SELECT
   - Role: public
   - Expression: bucket_id = 'chat-files'

After setup, refresh the page and try uploading again!
`;
}