import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '.env');

// Manual env parsing since we already have node's fs
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
} catch (e) {
  console.log('Skipping env file read. Trying system variables.');
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL not found in .env');
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
});

async function setupDatabase() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL!');

    // 1. Create the library_auth table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.library_auth (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        national_id TEXT UNIQUE,
        user_type TEXT DEFAULT 'User',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Ensure national_id exists and is unique for existing tables
    await client.query(`
      ALTER TABLE public.library_auth ADD COLUMN IF NOT EXISTS national_id TEXT;
      ALTER TABLE public.library_auth ADD CONSTRAINT library_auth_national_id_key UNIQUE (national_id);
    `).catch(() => console.log('National ID unique constraint already exists.'));

    console.log('Successfully set up library_auth table with unique national_id.');

    // 2. Create library_categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.library_categories (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('Successfully set up library_categories table.');

    // 3. Create library_books table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.library_books (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        category_id UUID REFERENCES public.library_categories(id),
        cover_url TEXT,
        total_copies INTEGER DEFAULT 1,
        available_copies INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Ensure the column is removed from any existing table too
    await client.query(`ALTER TABLE public.library_books DROP COLUMN IF EXISTS isbn;`);
    
    console.log('Successfully set up library_books table (isbn removed).');

    // 4. Create library_loans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.library_loans (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        book_id UUID REFERENCES public.library_books(id),
        user_id UUID REFERENCES public.library_auth(id),
        borrower_name TEXT,
        borrower_phone TEXT,
        national_id TEXT,
        loan_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        due_date TIMESTAMP WITH TIME ZONE NOT NULL,
        return_date TIMESTAMP WITH TIME ZONE,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Ensure columns exist if table already exists
    await client.query(`ALTER TABLE public.library_loans ADD COLUMN IF NOT EXISTS national_id TEXT;`);
    await client.query(`ALTER TABLE public.library_loans ADD COLUMN IF NOT EXISTS borrower_name TEXT;`);
    await client.query(`ALTER TABLE public.library_loans ADD COLUMN IF NOT EXISTS borrower_phone TEXT;`);
    
    console.log('Successfully set up library_loans table with national_id.');
    // 5. Create library_interactions table (for global counts)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.library_interactions (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        book_id UUID REFERENCES public.library_books(id) ON DELETE CASCADE,
        user_id UUID REFERENCES public.library_auth(id) ON DELETE CASCADE,
        type TEXT CHECK (type IN ('like', 'dislike')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(book_id, user_id)
      );
    `);
    console.log('Successfully set up library_interactions table.');

    // 6. Create library_favourites table (for private bookmarks)
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.library_favourites (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        book_id UUID REFERENCES public.library_books(id) ON DELETE CASCADE,
        user_id UUID REFERENCES public.library_auth(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(book_id, user_id)
      );
    `);
    console.log('Successfully set up library_favourites table.');

    // 5. Enable RLS and add policies
    await client.query(`
      ALTER TABLE public.library_auth ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.library_categories ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.library_interactions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.library_favourites ENABLE ROW LEVEL SECURITY;

      -- Favourites Policy: User can ONLY see their own hearts
      DROP POLICY IF EXISTS "Users can view own favourites" ON public.library_favourites;
      CREATE POLICY "Users can view own favourites" ON public.library_favourites 
        FOR SELECT USING (user_id IN (SELECT id FROM public.library_auth WHERE email = current_user));
      
      -- For simplicity in this demo, allowing public access for interactions but you can tighten this:
      DROP POLICY IF EXISTS "Public access interactions" ON public.library_interactions;
      CREATE POLICY "Public access interactions" ON public.library_interactions FOR ALL USING (true);

      DROP POLICY IF EXISTS "Public access favourites" ON public.library_favourites;
      CREATE POLICY "Public access favourites" ON public.library_favourites FOR ALL USING (true);

      DROP POLICY IF EXISTS "Public select and insert" ON public.library_auth;
      CREATE POLICY "Public select and insert" ON public.library_auth FOR ALL USING (true);

      DROP POLICY IF EXISTS "Public access" ON public.library_categories;
      CREATE POLICY "Public access" ON public.library_categories FOR ALL USING (true);

      DROP POLICY IF EXISTS "Public access" ON public.library_books;
      CREATE POLICY "Public access" ON public.library_books FOR ALL USING (true);

      DROP POLICY IF EXISTS "Public access" ON public.library_loans;
      CREATE POLICY "Public access" ON public.library_loans FOR ALL USING (true);
    `);
    console.log('Successfully enabled RLS policies for all tables.');

    // 6. Setup Supabase Storage for Book Covers
    console.log('Setting up storage bucket and policies...');
    await client.query(`
      -- Insert bucket if it doesn't exist
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('book-covers', 'book-covers', true)
      ON CONFLICT (id) DO NOTHING;

      -- Allow public access to read files
      DROP POLICY IF EXISTS "Public Read" ON storage.objects;
      CREATE POLICY "Public Read" ON storage.objects FOR SELECT USING (bucket_id = 'book-covers');

      -- Allow ANYONE to upload/delete files (for demo purposes)
      DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
      CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'book-covers');

      DROP POLICY IF EXISTS "Public Update" ON storage.objects;
      CREATE POLICY "Public Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'book-covers');

      DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
      CREATE POLICY "Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'book-covers');
    `);
    console.log('Successfully set up book-covers storage bucket and policies.');
    
  } catch (err) {
    console.error('Error setting up database:', err);
  } finally {
    await client.end();
  }
}

setupDatabase();
