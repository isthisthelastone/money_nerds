import '../styles/global.css';
import { supabase } from '../../supabaseClient';
import { Component } from '@/components';

// Server Component: Fetches data from Supabase
export default async function HomePage() {
  const { data, error } = await supabase
    .from('test')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching data:', error.message);
  }

  return <Component data={data || []} />;
}
