'use client';

import DinoGame from '@/components/DinoGame';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-4xl w-full">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Chrome Dino Game</h1>
          <p className="text-gray-600">Press SPACE to jump, DOWN arrow to duck</p>
        </div>
        
        <div className="flex justify-center">
          <DinoGame />
        </div>
        
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Use SPACE or click to jump • Use DOWN arrow to duck</p>
          <p>Avoid cacti and birds to survive as long as possible!</p>
        </div>
      </div>
    </div>
  );
}