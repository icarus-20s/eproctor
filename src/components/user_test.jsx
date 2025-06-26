import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import axios from 'axios';
import FaceOrientationChecker from './video';

const McqTest = () => {
  const navigate = useNavigate(); // Initialize useNavigate
  
  const [testCode, setTestCode] = useState(''); // User-entered test code
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answers, setAnswers] = useState({});
  const [isTestStarted, setIsTestStarted] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [countdown, setCountdown] = useState(6);
  const [remainingWarnings, setRemainingWarnings] = useState(4);
  const countdownIntervalRef = useRef(null);
  const isCountdownActiveRef = useRef(false);
  const [timer, setTimer] = useState(90 * 60); // 23 minutes timer in seconds
  const timerRef = useRef(null); // Ref for interval function
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    if (isTestStarted && timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer(prevTimer => prevTimer - 1);
      }, 1000);
    } else if (timer === 0) {
      handleSubmitTest(); // Submit the test when time is up
    }
    
    // Cleanup interval when component unmounts
    return () => clearInterval(timerRef.current);
  }, [isTestStarted, timer]);

  // Convert seconds to minutes and seconds format
  const formatTime = () => {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  
  const location = useLocation();
  const username = location.state?.username;
  useEffect(() => {
    if (!username) {
      navigate("/login_user"); // Redirect to login page
    }
  }, [username, navigate]);

  
  useEffect(() => {

    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        //handleSubmitTest(); // Automatically submit the test if the document is hidden
      }
    };
    

    // Add event listener for visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); //

  useEffect(() => {
    
    const handleRightClick = (event) => {
      event.preventDefault();
    };
    const handleKeyDown = (event) => {
      if (isFullscreen) {
        const charCode = event.charCode || event.keyCode || event.which;
    
        // Check for the Escape key (27)
        if (charCode === 27) {
          alert('Escape key is not allowed');
          event.preventDefault();
        }
    
        if (event.ctrlKey && event.altKey) {
          // Check if the Delete key (46) is pressed
          if (event.key === 'Delete') {
            // Trigger the test submission
            handleSubmitTest();
            event.preventDefault(); // Prevent the default action
          } else {
            // Optionally show a warning if only Control + Alt is pressed
            showWarning(); // Show the warning modal
            event.preventDefault();
          }
        }
        // Detect if the Windows key (meta key) is pressed
        if (event.metaKey) {
          showWarning(); // Show the warning modal and decrement warnings
          event.preventDefault();
        }
    
        // Prevent Ctrl + A / Command + A
        if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'i' || event.key === 'c' || event.key === 'u' || event.key === 'T' || event.key === 'alt'  )) {
          event.preventDefault();
        }
    
        // Check for Alt + Tab
        if (event.altKey && event.key === 'Tab') {
          alert('Switching to another application is not allowed!'); // Show alert

        }
    
        // Prevent Ctrl + Tab (switching tabs)
        if (event.ctrlKey && event.key === 'Tab') {
          event.preventDefault();
        }
    
        // Prevent both Control and Alt keys
        if (event.ctrlKey || event.altKey) {
          event.preventDefault();
        }
      }
    };
    
    
    document.addEventListener('contextmenu', handleRightClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleRightClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
    
  }, [isFullscreen]);


  const fetchTest = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/get-test-data/${testCode}`);  // Fetch data from Flask backend
      const data = response.data;

      if (testCode == data.test_code) {
        setQuestions(data.questions);
        setIsTestStarted(true);
        enterFullscreen(); // Enter fullscreen on valid code
      }else if (!data.error) {
        setQuestions(data.questions);
        setIsTestStarted(true);
        enterFullscreen();  // Enter fullscreen on valid code
      } else {
        alert('The test code you entered is invalid. Please try again.');
        setQuestions([]);
      }
    } catch (error) {
      console.error('Error fetching test data:', error);
    }
  };

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
    setIsFullscreen(true);
    resetCountdown();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  };

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) {
      showWarning();
      setIsFullscreen(false);
    } else {
      resetCountdown();
      setIsFullscreen(true);
    }
  };

  const showWarning = () => {
    if (remainingWarnings > 0) {
      setWarningVisible(true);
      setModalVisible(true);
      setRemainingWarnings((prev) => {
        const newRemaining = prev - 1;
        // Check if remaining warnings are 0 and submit test
        if (newRemaining <= 0) {
          handleSubmitTest(); // Auto-submit if warnings reach 0
        }
        return newRemaining;
      });
  
      if (!isCountdownActiveRef.current) {
        startCountdown();
      }
    } else {
      handleSubmitTest(); // Auto-submit if warnings reach 0
    }
  };

  const startCountdown = () => {
    setCountdown(6);
    isCountdownActiveRef.current = true;
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          isCountdownActiveRef.current = false;
          handleSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetCountdown = () => {
    clearInterval(countdownIntervalRef.current);
    setCountdown(10);
    setWarningVisible(false);
    setModalVisible(false);
    isCountdownActiveRef.current = false;
  };

  const handleOptionChange = (index) => {
    setSelectedOption(index);
  };

  const handleNextQuestion = () => {
    // Store the answer using the question text
    const currentQuestion = questions[currentQuestionIndex]?.question;
    setAnswers((prevAnswers) => ({
      ...prevAnswers,
      [currentQuestion]: questions[currentQuestionIndex]?.options[selectedOption],
    }));
    
    setSelectedOption(null);
    setCurrentQuestionIndex((prevIndex) => prevIndex + 1);
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      const previousQuestion = questions[currentQuestionIndex - 1]?.question;
      const previousAnswer = answers[previousQuestion];
      setSelectedOption(
        previousAnswer
          ? questions[currentQuestionIndex - 1]?.options.indexOf(previousAnswer)
          : null
      );
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const [sessionLogin, setSessionLogin] = useState('');
    useEffect(() => {
      setSessionLogin(new Date().toISOString());
    }, []);
  const [message, setMessage] = useState('');

  // Function to handle form submission

  const handleSubmitTest = async (e) => {
    e.preventDefault();
    let updatedAnswers = { ...answers };

    // Check if there is a selected option for the current question and update the answers
    if (selectedOption !== null) {
      const currentQuestion = questions[currentQuestionIndex]?.question;
      updatedAnswers[currentQuestion] = questions[currentQuestionIndex]?.options[selectedOption];
    }
        try {
            const response = await fetch('http://localhost:5000/submit-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    test_id: testCode,
                    answers: updatedAnswers,
                    session_login: sessionLogin,
                }),
            });

            if (response.ok) {
                setMessage('Test submitted successfully.');
            } else {
                const errorData = await response.json();
                setMessage(`Error: ${errorData.message}`);
            }
        } catch (error) {
            setMessage('Failed to submit the test.');
            console.error('Error submitting test:', error);
        }
      
    console.log(updatedAnswers);
    // Add a slight delay to ensure the state is updated before submission
    setTimeout(() => {
      console.log('Submitted Answers:', updatedAnswers);
      
      // Exit fullscreen and navigate away from the test page
      exitFullscreen();
      navigate('/user');
    }, 0); // Delay can be 0 since setState is asynchronous
  };


  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }

    document.removeEventListener('fullscreenchange', handleFullscreenChange);
  };

  const handleTestCodeChange = (e) => {
    setTestCode(e.target.value);
  };

  const handleModalClose = () => {
    if (remainingWarnings === 0) {
      handleSubmitTest();
    } else {
      resetCountdown();
      startCountdown();
      enterFullscreen();
    }
    
  };

  const [ip, setIp] = useState('');
  useEffect(() => {
    const fetchIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setIp(data.ip);
      } catch (error) {
        console.error('Error fetching IP address:', error);
      }
    };

    fetchIp();
  }, []);
  return (
    <div className="flex user-select-none flex-col items-center justify-center  p-4">
      <div className="w-full max-w-4xl">
        {!isTestStarted ? (
          <>
            <h1 className="text-3xl font-bold text-gray-900 mb-4 ml-40 mt-24 font-Orbitron  ">Enter Test Code:</h1>
            <input
              type="text"
              placeholder="Enter Test Code"
              value={testCode}
              onChange={handleTestCodeChange}
              className="w-full max-w-xs p-2 border rounded mb-4 ml-40 font-Lex"
            />
            <button
              onClick={fetchTest}
              className="bg-blue-500 text-white px-4 py-2 rounded ml-4 font-Orbitron "
            >
              Submit Code
            </button>
            
          <div className=" font-Cabin bg-slate-200 hover:shadow-xl  m-8 p-4 rounded-lg text-xl">
            <h1 className=' text-3xl mb-4 font-Orbitron' >Rules:</h1>
            <ul className="list-disc list-inside space-y-2 font-Lex">
            <li>Upon the end of time, the exam will be automatically submitted.
            </li>
            <li>Students should not switch tabs during examinations.
            </li>
            <li>
            Students should not exit fullscreen mode during examination.
            </li>
            <li>
            Students must make sure that they are facing the camera.
            </li>
            <li>
            Repeated offenses will lead to exam termination.
            </li>
            </ul>
          </div>
          </>
        ) : (

          <div>
            <div className="flex w-full mt-4space-x-4">
              
              <div className="flex-grow absolute left-0 w-[70%] m-8   h-[70%] bg-gray-100 rounded-sm p-4  shadow-xl">
                <div className='flex justify-between items-center  mx-24 mt-4  '>
                <h2 className="text-5xl font-semibold mb-9 font-Orbitron">
                  Question {currentQuestionIndex + 1} :
                </h2>
                  <h1 className="text-2xl font-bold text-gray-900 mb-4 text-right font-Orbitron">Test Code: {testCode}</h1>
                  </div>
                <p className="mb-9 text-3xl  font-lex ml-24">{questions[currentQuestionIndex]?.question}</p>
                <h1 className='text-2xl font-bold text-gray-900 mb-4 text-left ml-24 font-Orbitron'>Options:</h1>
                {questions[currentQuestionIndex]?.options.map((option, index) => (
                  
        <div key={index} className="mb-2 text-2xl ml-24">
      
        <label className="flex items-center font-lex  cursor-pointer">
          <input
            type="radio"
            name={`question-${currentQuestionIndex}`}
            checked={selectedOption === index}
            onChange={() => handleOptionChange(index)}
            className="hidden peer"
          />
          <span className="w-4 h-4 rounded-full border border-gray-400 peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all"></span>
          <span className="ml-3 text-gray-800 font-lex">{option}</span>
        </label>
      </div>
      
                ))}
                <div className="flex start mx-2 mt-20 font-Orbitron">
                  <button
                    onClick={handlePrevQuestion}
                    className="bg-gray-300 text-gray-800 px-4 py-2 mx-4 ml-24 rounded"
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </button>
                  <button
                    onClick={
                      currentQuestionIndex === questions.length - 1
                        ? handleSubmitTest
                        : handleNextQuestion
                    }
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                  >
                    {currentQuestionIndex === questions.length - 1 ? 'Submit Test' : 'Next'}
                  </button>
                </div>
              </div>
              <div className=" absolute bottom-0 right-3 w-[25%] h-[40%] bg-gray-100 p-4 m-4 rounded-md shadow-md">
                <h2 className="text-xl font-semibold mb-4 font-Orbitron   ">Navigate Questions</h2>
                <div className="flex flex-wrap gap-2">
                  {questions.map((_, index) => (
                    <button
                    key={index}
                    className={`px-5 py-3 border rounded ${
                      index === currentQuestionIndex ? 'bg-blue-500 text-white' : 'bg-gray-300'
                    }`}
                    onClick={() => setCurrentQuestionIndex(index)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-black absolute top-0 right-7 mt-16 w-[25%] h-[45%] rounded-md shadow-md">
                  <FaceOrientationChecker />
              </div>
              <div className="absolute flex flex-row justify-start items-center bottom-8 py-10 px-24 bg-gray-100 shadow-xl rounded-md ml-4 left-3 w-[70%] m-2">
                <p className="text-5xl font-medium">Timer:</p>
                <h1 className="text-8xl mx-4">{formatTime()}</h1>
                <div className="text-3xl">Minutes</div>
              </div>
            </div>
          </div>
        )}

        {/* Warning Modal */}
        {modalVisible && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
            <div className="bg-white p-8 rounded shadow-lg w-1/2">
              <h2 className="text-2xl font-bold mb-4 font-Lex text-red-700">Warning!!!</h2>
              <p>
                You've exited fullscreen mode. Please return to fullscreen to continue the test. You have{' '}
                {remainingWarnings} warnings left. The test will be submitted in {countdown} seconds if you don't return
                to fullscreen.
              </p>
              <div className="flex justify-end mt-4">
                <button onClick={handleModalClose} className="bg-blue-500 text-white px-4 py-2 rounded">
                  Return to Fullscreen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default McqTest;
