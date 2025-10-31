
import React from 'react';

interface IllustrationDisplayProps {
  imageUrl: string | null;
  isLoading: boolean;
}

const IllustrationDisplay: React.FC<IllustrationDisplayProps> = ({ imageUrl, isLoading }) => {
  return (
    <div className="w-full lg:w-1/2 h-64 md:h-96 lg:h-full flex-shrink-0">
      <div className="relative w-full h-full bg-blue-200 rounded-3xl shadow-lg overflow-hidden border-4 border-white">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-purple-500"></div>
          </div>
        )}
        {imageUrl ? (
          <img src={imageUrl} alt="Story illustration" className="w-full h-full object-cover transition-opacity duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-8">
            <svg className="w-24 h-24 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
};

export default IllustrationDisplay;
