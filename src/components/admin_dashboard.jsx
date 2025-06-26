import React, { useEffect, useState } from 'react';
import Navbar from './navbar';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Ut3 from "./underline3";

const Dashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [tests, setTests] = useState([]); // State to hold fetched tests
  const [userDetails, setUserDetails] = useState([]); // State to hold user-specific details

  // Fetch tests on component mount
  useEffect(() => {
    fetchTests();
    fetchUserDetails(); // Fetch user details as well
  }, []);

  const fetchTests = () => {
    axios.get('http://localhost:5000/get-all-tests')
      .then(response => {
        setTests(response.data);
      })
      .catch(error => {
        console.error("There was an error fetching the tests!", error);
      });
  };

  // New function to fetch only user details
  const fetchUserDetails = () => {
    axios.get('http://localhost:5000/get-user-sessions')
      .then(response => {
        // Extract user-related fields from the response data
        const userDetailsData = response.data.map(test => ({
          user_name: test.username,
          ip_address: test.ip_address,
          session_login: test.session_login
        }));
        console.log(userDetailsData);
        setUserDetails(userDetailsData);
      })
      .catch(error => {
        console.error("There was an error fetching the user details!", error);
      });
  };

  const handleStartTest = (testCode) => {
    axios.post('http://localhost:5000/start-test', { testCode })
      .then(response => {
        console.log("Test Started");
        alert("Test Started!");
        fetchTests();
      })
      .catch(error => {
        console.error("Error starting the test", error);
      });
  };

  const handleEndTest = (testCode) => {
    axios.post('http://localhost:5000/end-test', { testCode })
      .then(response => {
        console.log("Test Ended");
        alert("Test Ended!");
        fetchTests();
      })
      .catch(error => {
        console.error("Error ending the test", error);
      });
  };

  const handleResetTest = (testCode) => {
    axios.post('http://localhost:5000/reset-test', { testCode })
      .then(response => {
        console.log("Test Reset");
        alert("Test Reset!");
        fetchTests();
      })
      .catch(error => {
        console.error("Error resetting the test", error);
      });
  };

  return (
    <div className="flex items-center h-screen justify-left font-Orbitron bg-white p-4 bg-profile">
      <div className="flex flex-col min-h-screen w-full items-center justify-start mt-8">
        <Ut3 />
        <div className="w-full">
          <table className='table-auto w-11/12 border border-zinc-500 bg-white font-Orbitron mt-8 ml-12'>
            <thead>
              <tr>
                <th className='text-2xl border border-zinc-500 bg-black text-white p-2'>Test Code</th>
                <th className='text-2xl border border-zinc-500 bg-black text-white p-2'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test, index) => (
                <tr key={index} className="font-medium text-center">
                  <td className="border border-zinc-500 hover:bg-sky-200 text-medium">
                    {test.test_code}
                  </td>
                  <td className="border border-zinc-500 flex justify-around items-center p-2">
                    {!test.is_test_started ? (
                      <button
                        onClick={() => handleStartTest(test.test_code)}
                        className="flex justify-center items-center bg-green-500 text-white p-2 w-40 rounded-xl hover:bg-green-700">
                        Start Test
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEndTest(test.test_code)}
                        className="bg-red-500 flex justify-center items-center text-white p-2 w-40 rounded-xl hover:bg-red-700">
                        End Test
                      </button>
                    )}
                    <button
                      onClick={() => handleResetTest(test.test_code)}
                      className="bg-yellow-400 flex justify-center items-center text-white w-40 p-2 rounded-xl hover:bg-yellow-700 ml-2">
                      Reset Test
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="w-full">
          <table className='table-auto border border-zinc-500 w-11/12 bg-white font-Orbitron mt-8 ml-12'>
            <thead>
              <tr>
                <th className='text-2xl border border-zinc-500 bg-black text-white p-2'>User Name</th>
                <th className='text-2xl border border-zinc-500 bg-black text-white p-2'>IP Address</th>
                <th className='text-2xl border border-zinc-500 bg-black text-white p-2'>Session Login</th>
              </tr>
            </thead>
            <tbody>
              {userDetails.map((user, index) => (
                <tr key={index} className="font-medium text-center">
                  <td className="border border-zinc-500 hover:bg-sky-200 p-4 text-medium">
                    {user.user_name}
                  </td>
                  <td className="border border-zinc-500 hover:bg-sky-200 p-4 text-medium">
                    {user.ip_address}
                  </td>
                  <td className="border border-zinc-500 hover:bg-sky-200 p-4 text-medium">
                    {user.session_login}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Navbar />
    </div>
  );
};

export default Dashboard;
