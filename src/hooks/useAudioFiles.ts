import { useState, useEffect } from 'react';
import { useSupabase } from './useSupabase';
import { Database } from '../types/database';

type AudioFile = Database['public']['Tables']['audio_files']['Row'];

export const useAudioFiles = (category?: string, subcategory?: string) => {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { supabase } = useSupabase();

  useEffect(() => {
    const fetchAudioFiles = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase.from('audio_files').select('*');

        if (category) {
          query = query.eq('category', category);
        }

        if (subcategory) {
          query = query.eq('subcategory', subcategory);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        // Process URLs to ensure they are direct download links for Dropbox
        const processedFiles = data?.map(file => ({
          ...file,
          url: file.url.includes('dropbox.com') 
            ? file.url.replace(/[?&]dl=0/, '').replace(/[?&]dl=1/, '') + (file.url.includes('?') ? '&dl=1' : '?dl=1')
            : file.url
        })) || [];

        setAudioFiles(processedFiles);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAudioFiles();
  }, [supabase, category, subcategory]);

  return { audioFiles, loading, error };
};

export const useSubcategories = (category?: string) => {
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { supabase } = useSupabase();

  useEffect(() => {
    const fetchSubcategories = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from('audio_files')
          .select('subcategory')
          .not('subcategory', 'is', null);

        if (category) {
          query = query.eq('category', category);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        // Get unique subcategories
        const uniqueSubcategories = Array.from(
          new Set(data?.map(item => item.subcategory).filter(Boolean))
        ) as string[];

        setSubcategories(uniqueSubcategories);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSubcategories();
  }, [supabase, category]);

  return { subcategories, loading, error };
};