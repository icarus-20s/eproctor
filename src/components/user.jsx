import { React, useEffect } from 'react';
import NavbarU from './navUser';
import { useLocation, useNavigate } from "react-router-dom";
import logo from '../assets/logoexam.jpg'
import Ut2 from "./underline2"
import Marquee from "./textloop"

const User = () => {
  // Initialize the navigation hook
  const navigate = useNavigate();

  const startTest = () => {
    // Handle starting the test logic (optional)
    console.log('Test Started');
    
    // Redirect to the test page (replace '/user_test' with the correct route)
    navigate('/user_test', { state: { username } });
  };
  const location = useLocation();
  const username = location.state?.username;
  useEffect(() => {
    if (!username) {
      navigate("/login_user"); // Redirect to login page
    }
  }, [username, navigate]);
  return (
    <>
      <div className="min-h-screen flex flex-col md:flex-row bg-slate-100">
        {/* Sidebar: Profile Section */}
            <img className=" w-16 h-16 rounded-full m-2" alt="Logo" src={logo}>
          </img>
          <h1 className="font-Zen font-medium text-end text-2xl mt-6  ">eProctor</h1>
          <div className='flex-1 flex flex-col items-center justify-center max-w-72'>
        <aside className="w-[500px] h-full absolute left-0 b p-6 shadow-2xl flex flex-col justify-center items-center">
            
            
          <div className="flex flex-col justify-center items-center mt-8 ">
            <img
              className="w-52 h-52 rounded-full object-cover mb-4 border-4 border-blue-500"
              src="https://i.pinimg.com/originals/59/af/9c/59af9cd100daf9aa154cc753dd58316d.jpg"
              alt="Profile"
            />
            <h2 className="text-3xl font-Lex font-bold text-gray-800">{username}</h2>
            <p className="text-sm text-gray-500">Student</p>
          </div>
          <nav className="mt-8 space-y-4 w-full">
            
            <button className="w-full px-4 py-3 bg-red-50 text-red-600 font-medium rounded-lg font-Orbitron hover:bg-red-100 transition duration-300">
              Log Out
            </button>
          </nav>
        </aside>
          </div>

        {/* Main Section: Start Test Button */}
        <main className="flex-1 flex flex-col items-center justify-center p-2 space-y-6">
          <Marquee/>
          <Ut2/>
          <p className="text-gray-600 text-lg text-center max-w-md font-Mont">
            Click on the button below to start the exam. Please ensure you have a stable connection and adhere to the exam guidelines.
          </p>
          <button
            className="px-10 py-4 bg-blue-600 font-Orbitron text-white font-semibold text-lg rounded-full shadow-md hover:bg-blue-700 transition duration-300"
            onClick={startTest}
          >
            Start Exam
          </button>
        </main>
        <NavbarU />
      </div>
    </>
  );
};

export default User;