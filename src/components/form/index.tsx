'use client';

import { useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { supabase } from '../../../supabaseClient';

export const Form = () => {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <FormContent />
    </QueryClientProvider>
  );
};

export function FormContent() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  // Mutation for inserting data
  const mutation = useMutation({
    mutationFn: async ({
      name,
      message,
    }: {
      name: string;
      message: string;
    }) => {
      const { error } = await supabase.from('test').insert([{ name, message }]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fetchData'] });
      setName('');
      setMessage('');
    },
  });

  const handleSubmit = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (name.trim() && message.trim()) {
        mutation.mutate(
          { name, message },
          {
            onSuccess: () => {
              // Refresh the page after successful mutation
              window.location.reload();
            },
          }
        );
      }
    }
  };

  return (
    <form className="flex flex-col p-4 gap-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleSubmit}
        className="resize-none max-w-[250px] min-h-[40px] bg-gray-50 border border-gray-300 text-gray-900 text-sm focus:ring-0 focus:outline-none rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        placeholder="Enter your name"
        required
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleSubmit}
        className="resize-none min-w-[750px] min-h-[155px] bg-gray-50 border border-gray-300 text-gray-900 focus:ring-0 focus:outline-none text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        placeholder="Type here to get money"
        required
      />
    </form>
  );
}
