import React from 'react'
import Underline from "./underline"
import logo from '../assets/logoexam.jpg'



const Docs = () => {
  return (
   <>

   <div className="flex justify-between items-center bg-slate-100 h-auto p-2 drop-shadow-xl overscroll-contain  ">
    <div className="flex justify-start items-center">
   <img className=" w-16 h-16 rounded-full m-4" alt="Logo" src={logo}>
          </img>
          <h1 className=" font-medium text-end text-2xl font-Zen  ">eProctor</h1>
    </div>
    <div className="flex justify-end items-center">
    <button class="relative bg-transparent text-black w-24 h-12 border-2 border-blue-500 rounded-[11px] m-2 transition-all duration-600 ease-in-out hover:bg-blue-600 hover:text-white  cursor-pointer"><a href="/login_user">
  Login User
  </a>
</button>
<button class="relative bg-transparent text-black w-28 h-12 border-2 border-blue-500 m-2 rounded-[11px]  transition-all duration-600 ease-in-out hover:bg-blue-600 hover:text-white cursor-pointer"><a href="/login_admin">
  Login Admin
  </a>
  
</button>
<button class="relative bg-transparent text-black w-24 h-12 border-2  border-blue-500 m-2 rounded-[11px]  transition-all duration-600 ease-in-out hover:bg-blue-600 hover:text-white cursor-pointer"><a href="/register">
  Sign-up
  </a>
  
</button>
      </div> 
   

      </div>
   <div className="flex flex-col justify-center items-center  min-h-screen bg-slate-100 bg-custom-pattern ">
   <img className=" w-24 h-24 rounded-full m-4" alt="Logo" src={logo}>
   </img>
    <h1 className="font-Zen text-7xl  hover:scale-125 mb-8 transition transition-linear duration-200 ">
    Welcome to eProctor
    </h1>
   <Underline/>
    <ul className="list-disc list-inside space-y-2 font-mono m-8 text-xl" >
      <li>Blocks copying and pasting, and prevents right-click actions to limit access to external resources.</li>
      <li>Tracks and limits tab switches, issuing warnings or penalties if multiple changes are detected.</li>
      <li>Repeated violations trigger warnings, and persistent issues can result in automatic exam termination.</li>
      <li>Instructors can create tests, receive alerts and monitor user from dashboard.      </li>

    </ul>
   </div>
   </>
  )
}

export default Docs;