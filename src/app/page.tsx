import '../styles/global.css';
import { supabase } from '../../supabaseClient';
import { Component } from '@/components';

// Server Component: Fetches data from Supabase
export default async function HomePage() {
  const { data } = await supabase
    .from('test')
    .select('*')
    .order('created_at', { ascending: false });



  return <Component data={data || []} />;
}
