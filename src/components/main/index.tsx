/* eslint-disable */
import { Form } from '@/components';

export function Component({ data }: { data: any[] }) {
  return (
    <main className="flex flex-col items-center justify-start gap-16 min-h-screen">
      <h1 className="text-4xl text-white pt-40">MONEY NERDS</h1>

      {/* Form for Client-side Interaction */}
      <Form />

      {/* Render List of Data */}
      <ul className="space-y-[40px] gap-4 pb-10">
        {data.map((item) => (
          <li
            key={item.id}
            className="font-mono p-4  min-w-[750px] bg-gray-50 border border-gray-300 text-gray-900 focus:ring-0 focus:outline-none text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
          >
            <div className="flex flex-col gap-4 ">
              <p>{'#' + item.id + ` by ${item.name}`}</p>
              <p>{item.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
