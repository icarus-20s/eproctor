import React from "react";
import "../App.css"; // Contains the .animate-marquee animation

const Marquee = () => {
  return (
    <div className="absolute top-4 left-0 right-0 overflow-hidden whitespace-nowrap pointer-events-none">
      <div className="animate-marquee inline-block px-4">
        <p className="text-base md:text-xl font-bold text-gray-900 font-Mont">
          Kindly ensure that you have a stable internet connection.
        </p>
      </div>
    </div>
  );
};

export default Marquee;